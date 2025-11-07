'use client';

import { useState, useEffect, useReducer, useMemo } from 'react';
import {
  AppBar,
  Toolbar,
  Container,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
  CircularProgress,
  IconButton,
  TextField,
  Button,
  Divider,
  ButtonGroup,
  Menu,
  MenuItem,
  Paper,
  keyframes, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  TextareaAutosize,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import BoltIcon from '@mui/icons-material/Bolt';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SettingsIcon from '@mui/icons-material/Settings';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsDialog from './components/SettingsDialog';

// D&Dユーティリティのみインポート (SortableContextなどは削除)
// 🚨 [新規追加] arrayMove ユーティリティの定義 🚨
const arrayMove = (array: any[], from: number, to: number) => {
  const newArray = [...array];
  const element = newArray.splice(from, 1)[0];
  newArray.splice(to, 0, element);
  return newArray;
};
// --- State, Actions, and Reducer ---

const DEFAULT_INITIAL_TASKS: AppItem[] = [
    { id: 1, name: 'デイリー', type: 'grouping', parentId: null },
    { id: 2, name: '朝・夕会関連', type: 'task', elapsedTime: 0, parentId: 1 },
    { id: 3, name: '休憩', type: 'task', elapsedTime: 0, parentId: 1 },
    { id: 4, name: '質問対応', type: 'task', elapsedTime: 0, parentId: 1 },
    { id: 5, name: '読書・学習', type: 'task', elapsedTime: 0, parentId: 1 },
];
const DEFAULT_ACTIVE_TASK_ID = 2; 

interface BaseItem {
  id: number;
  name: string;
  parentId: number | null;
}

interface GroupingItem extends BaseItem {
  type: 'grouping';
}

interface TimedTaskItem extends BaseItem {
  type: 'task';
  elapsedTime: number; // ms
}

type AppItem = GroupingItem | TimedTaskItem;

interface AppState {
  tasks: AppItem[];
  activeTaskId: number | null; 
  sessionStartTime: number;
  editingTaskId: number | null;
  editingTimeId: number | null; // 💡新規追加
}

type AppAction =
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'START_NEW_DAY' }
  | { type: 'SWITCH_TASK'; payload: { newTaskId: number; switchTime: number } }
  | { type: 'START_EDIT'; payload: number }
  | { type: 'UPDATE_TASK_NAME'; payload: { id: number; newName: string } }
  | { type: 'ADD_PLANNED_TASK'; payload: string }
  | { type: 'ADD_SUB_TASK'; payload: { parentId: number; name: string } }
  | { type: 'ADD_QUICK_TASK'; payload: { switchTime: number } }
  | { type: 'ADD_QUICK_SUB_TASK'; payload: { parentId: number; switchTime: number } }
  | { type: 'ADJUST_TIME'; payload: { taskId: number; amount: number } }
  | { type: 'RESET_TIME'; payload: number } 
  | { type: 'STOP_ALL_TIMERS' }
  | { type: 'ADD_GROUPING'; payload: string }
  | { type: 'DELETE_TASK'; payload: number } 
  | { type: 'IMPORT_TASKS_BATCH'; payload: { name: string; parentName: string | null }[] }
  | { type: 'MOVE_UP'; payload: number }
  | { type: 'START_TIME_EDIT'; payload: number } // 💡新規追加
  | { type: 'FINISH_TIME_EDIT'; payload: { id: number; newTimeMs: number } }; // 💡新規追加


const initialState: AppState = {
  tasks: [],
  activeTaskId: DEFAULT_ACTIVE_TASK_ID,
  sessionStartTime: Date.now(),
  editingTaskId: null,
  editingTimeId: null, // 💡新規追加
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  const getNewId = () => (state.tasks.length > 0 ? Math.max(...state.tasks.map(t => t.id)) : 0) + 1;

  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload, editingTaskId: null, editingTimeId: null }; // 💡修正: editingTimeIdもリセット
    case 'START_NEW_DAY':
      return { ...initialState, tasks: DEFAULT_INITIAL_TASKS, activeTaskId: DEFAULT_ACTIVE_TASK_ID, sessionStartTime: Date.now() };
    case 'SWITCH_TASK':
      if (state.editingTaskId || state.editingTimeId) return state; // 💡修正: 時間編集中はブロック

      const currentActiveTask = state.tasks.find(t => t.id === state.activeTaskId);
      const newActiveTask = state.tasks.find(t => t.id === action.payload.newTaskId);

      if (!newActiveTask || newActiveTask.type !== 'task') return state;

      let tasksAfterSwitch = state.tasks;

      if (currentActiveTask && currentActiveTask.type === 'task') {
        const duration = action.payload.switchTime - state.sessionStartTime;
        tasksAfterSwitch = state.tasks.map(task =>{
          if (task.id === state.activeTaskId && task.type === 'task'){
            return { ...task, elapsedTime: task.elapsedTime + duration }
          }
          return task;
      });
      }

      return { ...state, tasks: tasksAfterSwitch, activeTaskId: action.payload.newTaskId, sessionStartTime: action.payload.switchTime };
    case 'START_EDIT':
      return { ...state, editingTaskId: action.payload, editingTimeId: null }; // 💡修正: 時間編集をリセット
    case 'UPDATE_TASK_NAME':
      return { ...state, editingTaskId: null, tasks: state.tasks.map(task => task.id === action.payload.id ? { ...task, name: action.payload.newName } : task) };
    case 'ADD_PLANNED_TASK':
      const newPlannedTask: TimedTaskItem = { id: getNewId(), name: action.payload, type: 'task', elapsedTime: 0, parentId: null };
      return { ...state, tasks: [...state.tasks, newPlannedTask] };
    case 'ADD_SUB_TASK':
      const newSubTask: TimedTaskItem = { id: getNewId(), name: action.payload.name, type: 'task', elapsedTime: 0, parentId: action.payload.parentId };
      return { ...state, tasks: [...state.tasks, newSubTask] };
    case 'ADD_QUICK_TASK':
    case 'ADD_QUICK_SUB_TASK':
      if (state.editingTimeId) return state; // 💡修正: 時間編集中はブロック

      const isSub = action.type === 'ADD_QUICK_SUB_TASK';
      const parentId = isSub ? action.payload.parentId : null;
      const namePrefix = isSub ? '臨時サブタスク' : '臨時タスク';
      const count = state.tasks.filter(t => t.name.startsWith(namePrefix) && t.parentId === parentId).length + 1;
      const quickTaskName = `${namePrefix} ${count}`;
      const newQuickId = getNewId();
      const newQuickTask: TimedTaskItem = { id: newQuickId, name: quickTaskName, type: 'task', elapsedTime: 0, parentId };
      const durationForQuickAdd = action.payload.switchTime - state.sessionStartTime;
      const tasksWithOldTime = state.tasks.map(task => {
      if (task.id === state.activeTaskId && task.type === 'task') {
        return { ...task, elapsedTime: task.elapsedTime + durationForQuickAdd };
      }
        return task;
      });
      return { ...state, tasks: [...tasksWithOldTime, newQuickTask], activeTaskId: newQuickId, sessionStartTime: action.payload.switchTime };
    case 'ADJUST_TIME':
      return { ...state, tasks: state.tasks.map(task => task.id === action.payload.taskId && task.type === 'task' ? { ...task, elapsedTime: Math.max(0, task.elapsedTime + action.payload.amount) } : task) };
    case 'RESET_TIME':
      return { ...state, tasks: state.tasks.map(task => task.id === action.payload && task.type === 'task' ? { ...task, elapsedTime: 0 } : task) };
    case 'DELETE_TASK':
      const taskToDelete = state.tasks.find(t => t.id === action.payload);
      if (!taskToDelete) return state;
      const descendantIds = new Set<number>([action.payload]);
      if (taskToDelete.parentId === null) {
        const children = state.tasks.filter(t => t.parentId === action.payload);
        for (const child of children) descendantIds.add(child.id);
      }
      const remainingTasks = state.tasks.filter(task => !descendantIds.has(task.id));
      
      if (state.activeTaskId !== null && descendantIds.has(state.activeTaskId)) {
        const firstTimed = remainingTasks.find((t): t is TimedTaskItem => t.type === 'task');

        if (firstTimed) {
          return { ...state, tasks: remainingTasks, activeTaskId: firstTimed.id, sessionStartTime: Date.now() };
        }

        const newUncategorized: TimedTaskItem = {
          id: getNewId(),
          name: '未分類',
          type: 'task',
          elapsedTime: 0,
          parentId: null,
        };
        const newTasksList = [...remainingTasks, newUncategorized];
        return { ...state, tasks: newTasksList, activeTaskId: newUncategorized.id, sessionStartTime: Date.now() };
      }
      
      return { ...state, tasks: remainingTasks, activeTaskId: state.activeTaskId };

    case 'STOP_ALL_TIMERS':
      if (state.activeTaskId === null) return state;

      const stopDuration = Date.now() - state.sessionStartTime;
      const tasksAfterStop = state.tasks.map(task => {
        if (task.id === state.activeTaskId && task.type === 'task') {
            return { ...task, elapsedTime: task.elapsedTime + stopDuration };
        }
        return task;
      });
      return { ...state, tasks: tasksAfterStop, activeTaskId: null, sessionStartTime: Date.now() };

    case 'IMPORT_TASKS_BATCH':
      let currentMaxId = getNewId() - 1; 
      const newTasks: AppItem[] = [];
      const parentNameToIdMap = new Map<string, number>();

      action.payload.forEach(item => {
        currentMaxId++;
        if (item.parentName === null) {
          const newParentTask: GroupingItem = { id: currentMaxId, name: item.name, type: 'grouping', parentId: null };
          newTasks.push(newParentTask);
          parentNameToIdMap.set(item.name, currentMaxId);
        } else {
          const parentId = parentNameToIdMap.get(item.parentName);
          if (parentId !== undefined) {
            const newChildTask: TimedTaskItem = { id: currentMaxId, name: item.name, type: 'task', elapsedTime: 0, parentId: parentId };
            newTasks.push(newChildTask);
          } else {
            const newTopLevelTask: TimedTaskItem = { id: currentMaxId, name: item.name, type: 'task', elapsedTime: 0, parentId: null };
            newTasks.push(newTopLevelTask);
          }
        }
      });
      return { ...state, tasks: [...state.tasks, ...newTasks] };
    case 'ADD_GROUPING':
      const newGrouping: GroupingItem = { id: getNewId(), name: action.payload, type: 'grouping', parentId: null };
      return { ...state, tasks: [...state.tasks, newGrouping] };
    
    // 🚨 [新規追加] MOVE_UP Reducerロジック 🚨
    case 'MOVE_UP': {
        const taskId = action.payload;
        const tasks = state.tasks;
        const oldIndex = tasks.findIndex(t => t.id === taskId);

        // タスクが見つからない、または既にリストの先頭の場合は何もしない
        if (oldIndex <= 0) return state;

        const newIndex = oldIndex - 1;
        const activeTask = tasks[oldIndex];
        const overTask = tasks[newIndex];

        // 親IDが異なる場合は移動させない (親のグループ内のみで移動)
        if (activeTask.parentId !== overTask.parentId) {
            return state;
        }

        const newTasks = arrayMove(tasks, oldIndex, newIndex);
        return { ...state, tasks: newTasks };
    }
    // 💡 [新規追加] 時間編集アクション 💡
    case 'START_TIME_EDIT':
      const taskToEditTime = state.tasks.find(t => t.id === action.payload);
      if (taskToEditTime && taskToEditTime.type === 'task') {
        return { ...state, editingTimeId: action.payload, editingTaskId: null };
      }
      return state;

    case 'FINISH_TIME_EDIT':
      return {
        ...state,
        editingTimeId: null,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id && task.type === 'task'
            ? { ...task, elapsedTime: action.payload.newTimeMs }
            : task
        ),
      };
    // ----------------------------
    
    default:
      return state;
  }
};

const formatTime = (totalMilliseconds: number) => {
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours.toString().padStart(2, '0'), minutes.toString().padStart(2, '0'), seconds.toString().padStart(2, '0')].join(':');
};

const formatMinutes = (totalMilliseconds: number) => {
  const totalMinutes = Math.floor(totalMilliseconds / (1000 * 60));
  if (totalMinutes < 60) {
    return `${totalMinutes}分`;
  } else {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}時間${minutes}分`;
  }
};

const pulse = keyframes`
  0% { transform: scale(1.0); background-color: rgba(255, 255,0, 0.8); }
  50% { transform: scale(1.02); background-color: rgba(255, 255, 0, 0.9); }
  100% { transform: scale(1.0); background-color: rgba(255, 255, 0, 0.8); }
`;

// 💡新規追加: 時間文字列をミリ秒に変換するヘルパー関数
const parseTimeToMs = (timeString: string): number | null => {
    // H:MM:SS または H:MM 形式を解析
    const parts = timeString.split(':').map(p => p.trim());
    
    if (parts.length === 3) {
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const seconds = parseInt(parts[2], 10);

        if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || hours < 0 || minutes < 0 || seconds < 0 || minutes > 59 || seconds > 59) {
            return null;
        }
        return (hours * 3600 + minutes * 60 + seconds) * 1000;
    } 
    else if (parts.length === 2) {
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
            return null;
        }
        // H:MM と解釈 (秒は 00)
        return (hours * 3600 + minutes * 60) * 1000;
    }
    
    return null;
};

// --- 時間編集ダイアログコンポーネント (HomePage内で定義) ---

interface TimeEditDialogProps {
  open: boolean;
  onClose: (initialTimeMs: number) => void;
  task: TimedTaskItem | null;
  onSave: (id: number, newTimeMs: number) => void;
  initialTimeMs: number;
}

const TimeEditDialog: React.FC<TimeEditDialogProps> = ({ open, onClose, task, onSave, initialTimeMs }) => {
    const [timeInput, setTimeInput] = useState('');
    const [error, setError] = useState('');
    
    // ダイアログが開かれたとき、初期時間を H:MM:SS 形式で設定
    useEffect(() => {
        if (open && task) {
            setTimeInput(formatTime(initialTimeMs));
            setError('');
        }
    }, [open, task, initialTimeMs]);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value.trim();
        setTimeInput(value);
        
        if (!value) {
            setError('時間を入力してください。');
            return;
        }
        
        const newTimeMs = parseTimeToMs(value);
        
        if (newTimeMs === null) {
            setError('無効な時間形式です。H:MM:SS または H:MM 形式で入力してください。');
        } else if (newTimeMs < 0) {
            setError('時間はマイナスにできません。');
        } else {
            setError('');
        }
    };

    const handleSave = () => {
        if (!task || error) return;
        
        const newTimeMs = parseTimeToMs(timeInput);
        if (newTimeMs !== null) {
            onSave(task.id, newTimeMs);
        } else {
            setError('保存できません。正しい時間形式を確認してください。');
        }
    };

    if (!task) return null;

    return (
        <Dialog open={open} onClose={() => onClose(initialTimeMs)} maxWidth="sm" fullWidth>
            <DialogTitle>{task.name} の時間編集</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    経過時間を **H:MM:SS** (時間:分:秒) 形式で入力してください。
                </Typography>
                <TextField
                    autoFocus
                    margin="dense"
                    id="time-edit-input"
                    label="経過時間 (H:MM:SS / H:MM)"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={timeInput}
                    onChange={handleChange}
                    error={!!error}
                    helperText={error || "例: 1:05:30 (1時間5分30秒) または 2:30 (2時間30分)"}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <AccessTimeIcon />
                            </InputAdornment>
                        ),
                    }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onClose(initialTimeMs)} color="inherit">
                    キャンセル
                </Button>
                <Button onClick={handleSave} color="primary" variant="contained" disabled={!!error || !timeInput}>
                    保存
                </Button>
            </DialogActions>
        </Dialog>
    );
};

// --- Export Dialog Component ---
interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  exportText: string;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ open, onClose, exportText }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(exportText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  useEffect(() => {
    if (open) {
      setCopied(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>今日の結果をエクスポート</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          以下のテキストをコピーして、他のアプリケーションに貼り付けることができます。
        </Typography>
        <TextareaAutosize
          readOnly
          value={exportText}
          minRows={10}
          style={{ width: '100%', padding: '8px', fontFamily: 'monospace', border: '1px solid #ccc', borderRadius: '4px', whiteSpace: 'pre-wrap' }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCopy} color="primary" variant="contained" startIcon={<ContentCopyIcon />}>
          {copied ? 'コピーしました！' : 'クリップボードにコピー'}
        </Button>
        <Button onClick={onClose} color="inherit">閉じる</Button>
      </DialogActions>
    </Dialog>
  );
};


// --- Component ---
export default function HomePage() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [addingSubtaskTo, setAddingSubtaskTo] = useState<number | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuTaskId, setMenuTaskId] = useState<null | number>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportText, setExportText] = useState('');
  
  const [expandedTimeButtonId, setExpandedTimeButtonId] = useState<number | null>(null);
  const [showActiveTaskDetails, setShowActiveTaskDetails] = useState(true);

  // 💡新規追加: 時間編集ダイアログで使用する一時的な入力値
  const [editingTimeValue, setEditingTimeValue] = useState('');

  // --- Effect & Persistence ---

  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem('tasks');
      const savedActiveTaskId = localStorage.getItem('activeTaskId');
      const savedSessionStartTime = localStorage.getItem('sessionStartTime');

      if (savedTasks && savedActiveTaskId && savedSessionStartTime) {
        dispatch({
          type: 'LOAD_STATE',
          payload: {
            tasks: JSON.parse(savedTasks),
            activeTaskId: JSON.parse(savedActiveTaskId),
            sessionStartTime: JSON.parse(savedSessionStartTime),
          },
        });
      } else {
        dispatch({
          type: 'LOAD_STATE',
          payload: {
            tasks: DEFAULT_INITIAL_TASKS,
            activeTaskId: DEFAULT_ACTIVE_TASK_ID,
            sessionStartTime: Date.now(),
          },
        });
      }
    } catch (error) {
      console.error("Failed to load data", error);
      dispatch({
        type: 'LOAD_STATE',
        payload: {
          tasks: DEFAULT_INITIAL_TASKS,
          activeTaskId: DEFAULT_ACTIVE_TASK_ID,
          sessionStartTime: Date.now(),
        },
      });
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('tasks', JSON.stringify(state.tasks));
    localStorage.setItem('activeTaskId', JSON.stringify(state.activeTaskId));
    localStorage.setItem('sessionStartTime', JSON.stringify(state.sessionStartTime));
  }, [state, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    const timerId = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timerId);
  }, [isLoaded]);


  // --- Handlers ---

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, taskId: number) => { setMenuAnchorEl(event.currentTarget); setMenuTaskId(taskId); };
  const handleMenuClose = () => { setMenuAnchorEl(null); setMenuTaskId(null); };
  
  const handleSwitchTask = (newTaskId: number) => {
    const hasChildren = state.tasks.some(t => t.parentId === newTaskId);
    if (hasChildren || state.editingTaskId || state.activeTaskId === newTaskId || state.editingTimeId) return; // 💡修正: 時間編集中はブロック
    dispatch({ type: 'SWITCH_TASK', payload: { newTaskId, switchTime: Date.now() } });
    setExpandedTimeButtonId(null);
  };
  
  const handleAddPlannedTask = () => {
    if (newTaskName.trim() !== '' && !state.editingTimeId) { // 💡修正: 時間編集中はブロック
      dispatch({ type: 'ADD_PLANNED_TASK', payload: newTaskName });
      setNewTaskName('');
      setIsAdding(false);
    }
  };
  
  const handleAddSubtask = (parentId: number, name: string) => {
    if (name.trim() !== '' && !state.editingTimeId) { // 💡修正: 時間編集中はブロック
      dispatch({ type: 'ADD_SUB_TASK', payload: { parentId, name } });
      setAddingSubtaskTo(null);
    }
  };
  
  const handleAddGrouping = () => {
    if (newTaskName.trim() !== '' && !state.editingTimeId) { // 💡修正: 時間編集中はブロック
      dispatch({ type: 'ADD_GROUPING', payload: newTaskName });
      setNewTaskName('');
      setIsAdding(false);
    }
  };

  // 💡新規追加: 時間編集の開始ハンドラ
  const handleStartTimeEdit = (id: number) => {
    dispatch({ type: 'START_TIME_EDIT', payload: id });
    handleMenuClose();
  };

  // 💡新規追加: 時間編集の保存ハンドラ
  const handleFinishTimeEdit = (id: number, newTimeMs: number) => {
    dispatch({ type: 'FINISH_TIME_EDIT', payload: { id, newTimeMs } });
  };
  
  // 💡新規追加: 時間編集のキャンセルハンドラ
  const handleCloseTimeEdit = (initialTimeMs: number) => {
    // キャンセル時は時間を変更せずに編集モードを終了
    dispatch({ type: 'FINISH_TIME_EDIT', payload: { id: state.editingTimeId!, newTimeMs: initialTimeMs } });
  };

  const handleExport = () => {
    let totalMilliseconds = 0;
    const reportParts: string[] = [];

    const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
    reportParts.push(`# ${today}`);

    taskTree.forEach(item => {
      const itemTime = getTaskDisplayedTime(item, item.children);

      if (item.type === 'grouping') {
        totalMilliseconds += itemTime;
        reportParts.push(`## ${item.name} (合計: ${formatMinutes(itemTime)})`);
        
        item.children.forEach(child => {
          if (child.type === 'task') {
            const childTime = getTaskDisplayedTime(child, []);
            reportParts.push(`- ${child.name}: ${formatMinutes(childTime)}`);
          }
        });
        reportParts.push('');
      } else { // Top-level task
        const taskTime = getTaskDisplayedTime(item, []);
        totalMilliseconds += taskTime;
        reportParts.push(`- ${item.name}: ${formatMinutes(taskTime)}`);
      }
    });
    
    if (taskTree.some(t => t.type === 'grouping') && taskTree.length > 1) {
        reportParts.push('---');
        reportParts.push(`**総合計: ${formatMinutes(totalMilliseconds)}**`);
    }

    setExportText(reportParts.join('\n'));
    setExportDialogOpen(true);
    setSettingsOpen(false); // Close settings dialog
  };


  // --- Data Computation ---

  const { taskTree, tasksById } = useMemo(() => {
    const tasksById = new Map(state.tasks.map(t => [t.id, { ...t, children: [] as (AppItem & { children: AppItem[] })[] }]));
    const tree: (AppItem & { children: AppItem[] })[] = [];

    for (const item of tasksById.values()) {
      if (item.parentId) {
        const parent = tasksById.get(item.parentId);
        if(parent) {
            parent.children.push(item);
        }
      } else {
        tree.push(item);
      }
    }
    return { taskTree: tree, tasksById };
  }, [state.tasks]);

  const getTaskDisplayedTime = (item: AppItem, children: AppItem[]) => {
    const isGrouping = item.type === 'grouping';
    let displayedTime = 0;

    // 💡修正: 時間編集中はタイマーを加算しない
    const isTimerRunning = !state.editingTaskId && state.editingTimeId === null; 

    if (isGrouping) {
      displayedTime = children.filter(child => child.type === 'task').reduce((acc, child) => {
        let childTime = (child as TimedTaskItem).elapsedTime;
        if (child.id === state.activeTaskId && child.type === 'task' && isTimerRunning) {
          const sessionDuration = Math.max(0, currentTime - state.sessionStartTime);
          childTime += sessionDuration;
        }
        return acc + childTime;
      }, 0);
    } else { // item.type === 'task'
      displayedTime = (item as TimedTaskItem).elapsedTime;
    }

    if (!isGrouping && item.id === state.activeTaskId && item.type === 'task' && isTimerRunning) {
      const sessionDuration = Math.max(0, currentTime - state.sessionStartTime);
      displayedTime += sessionDuration;
    }
    return displayedTime;
  };

  if (!isLoaded) {
    return <Container maxWidth="sm"><Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box></Container>;
  }

  const activeTask = state.tasks.find(t => t.id === state.activeTaskId);
  const activeTaskName = activeTask?.name || 'タスク停止中';
  const isTimerActive = activeTask?.type === 'task';

  // --- Task Rendering ---

  const renderTask = (item: AppItem & { children: AppItem[] }, level: number) => {
    const isTopLevel = item.parentId === null;
    const isGrouping = item.type === 'grouping';
    const canBeActive = item.type === 'task';
    const isExpanded = state.activeTaskId === item.id && expandedTimeButtonId === item.id;
    const isDisabled = !!state.editingTimeId; // 💡新規追加: 時間編集中は無効化

    if (state.editingTaskId === item.id) {
      return <ListItem key={item.id} sx={{ pl: level * 4 }}><TextField defaultValue={item.name} variant="standard" fullWidth autoFocus onBlur={(e) => dispatch({ type: 'UPDATE_TASK_NAME', payload: { id: item.id, newName: (e.target as HTMLInputElement).value } })} onKeyDown={(e) => { if (e.key === 'Enter') dispatch({ type: 'UPDATE_TASK_NAME', payload: { id: item.id, newName: (e.target as HTMLInputElement).value } }); }} /></ListItem>;
    }

    const hasChildrenAndIsObject = item.children && item.children.length > 0;
    
    const renderChildren = hasChildrenAndIsObject ? (
      <List disablePadding>
        {item.children.map(child =>
          renderTask(child as AppItem & { children: AppItem[] }, level + 1)
        )}
      </List>
    ) : null;


    return isTopLevel ? (
      <Paper key={item.id} elevation={2} sx={{ mb: 2, p: 1 }}>
        {isGrouping ? (
          <ListItem disablePadding secondaryAction={<IconButton edge="end" onClick={(e) => handleMenuOpen(e, item.id)} disabled={isDisabled}><MoreVertIcon /></IconButton>}>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography component="span" variant="h6" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {item.name}
                  </Typography>
                  <Typography component="span" variant="body1" sx={{ fontFamily: 'monospace', ml: 1, color: 'text.secondary' }}>
                    計 {formatMinutes(getTaskDisplayedTime(item, item.children))}
                  </Typography>
                </Box>
              }
              primaryTypographyProps={{ sx: { pl: isTopLevel ? 2 : level * 2 } }}
            />
          </ListItem>
        ) : (
          <ListItem disablePadding secondaryAction={<IconButton edge="end" onClick={(e) => handleMenuOpen(e, item.id)} disabled={isDisabled}><MoreVertIcon /></IconButton>}>
            <ListItemButton
              disabled={!canBeActive || isDisabled} // 💡修正: 時間編集中は無効化
              selected={canBeActive && item.id === state.activeTaskId}
              onClick={() => canBeActive && handleSwitchTask(item.id)}
              sx={{
                pl: isTopLevel ? 2 : level * 2,
                ...(isTopLevel && hasChildrenAndIsObject ? { borderBottom: '1px solid', borderColor: 'divider' } : {}),
              }}
            >
              <ListItemText primary={item.name} primaryTypographyProps={{ fontWeight: 'normal' }} />
              <Box 
                  sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      minWidth: isExpanded ? '300px' : '100px', 
                      justifyContent: 'flex-end',
                  }}
              >
                {isExpanded && (
                  <ButtonGroup size="small" variant="text" color="inherit" sx={{ mr: 1, minWidth: '180px' }}>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: -300000 } })}} disabled={isDisabled}>-5m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: -60000 } })}} disabled={isDisabled}>-1m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: 60000 } })}} disabled={isDisabled}>+1m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: 300000 } })}} disabled={isDisabled}>+5m</Button>
                  </ButtonGroup>
                )}
                <Box 
                    onClick={(e) => {
                        e.stopPropagation(); // ListItemButtonのタスク切り替えを抑制
                        if (state.activeTaskId === item.id) {
                            // アクティブタスクの場合のみ、展開状態を切り替える
                            setExpandedTimeButtonId(prevId => prevId === item.id ? null : item.id);
                        }
                    }}
                    sx={{ 
                        cursor: state.activeTaskId === item.id ? 'pointer' : 'default',
                        minWidth: '80px', 
                        textAlign: 'right'
                    }}
                >
                    <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                        {formatTime(getTaskDisplayedTime(item, item.children))}
                    </Typography>
                </Box>
              </Box>
            </ListItemButton>
          </ListItem>
        )}
        {addingSubtaskTo === item.id && (
          <ListItem sx={{ pl: (level + 2) * 4 }}>
            <TextField label="新しいサブタスク名" variant="standard" fullWidth autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(item.id, (e.target as HTMLInputElement).value); }} disabled={isDisabled} />
          </ListItem>
        )}
        {renderChildren}
      </Paper>
    ) : (
      <Box key={item.id} sx={{ mb: 0 }}>
        {isGrouping ? (
          <ListItem disablePadding secondaryAction={<IconButton edge="end" onClick={(e) => handleMenuOpen(e, item.id)} disabled={isDisabled}><MoreVertIcon /></IconButton>}>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography component="span" variant="h6" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {item.name}
                  </Typography>
                  <Typography component="span" variant="body1" sx={{ fontFamily: 'monospace', ml: 1, color: 'text.secondary' }}>
                    計 {formatMinutes(getTaskDisplayedTime(item, item.children))}
                  </Typography>
                </Box>
              }
              primaryTypographyProps={{ sx: { pl: isTopLevel ? 2 : level * 2 } }}
            />
          </ListItem>
        ) : (
          <ListItem disablePadding secondaryAction={<IconButton edge="end" onClick={(e) => handleMenuOpen(e, item.id)} disabled={isDisabled}><MoreVertIcon /></IconButton>}>
            <ListItemButton
              disabled={!canBeActive || isDisabled} // 💡修正: 時間編集中は無効化
              selected={canBeActive && item.id === state.activeTaskId}
              onClick={() => canBeActive && handleSwitchTask(item.id)}
              sx={{
                pl: isTopLevel ? 2 : level * 2,
                ...(isTopLevel && hasChildrenAndIsObject ? { borderBottom: '1px solid', borderColor: 'divider' } : {}),
              }}
            >
              <ListItemText primary={item.name} primaryTypographyProps={{ fontWeight: 'normal' }} />
              <Box 
                  sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      minWidth: isExpanded ? '300px' : '100px', 
                      justifyContent: 'flex-end',
                  }}
              >
                {isExpanded && (
                  <ButtonGroup size="small" variant="text" color="inherit" sx={{ mr: 1, minWidth: '180px' }}>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: -300000 } })}} disabled={isDisabled}>-5m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: -60000 } })}} disabled={isDisabled}>-1m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: 60000 } })}} disabled={isDisabled}>+1m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: 300000 } })}} disabled={isDisabled}>+5m</Button>
                  </ButtonGroup>
                )}
                <Box 
                    onClick={(e) => {
                        e.stopPropagation(); // ListItemButtonのタスク切り替えを抑制
                        if (state.activeTaskId === item.id) {
                            // アクティブタスクの場合のみ、展開状態を切り替える
                            setExpandedTimeButtonId(prevId => prevId === item.id ? null : item.id);
                        }
                    }}
                    sx={{ 
                        cursor: state.activeTaskId === item.id ? 'pointer' : 'default',
                        minWidth: '80px', 
                        textAlign: 'right'
                    }}
                >
                    <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                        {formatTime(getTaskDisplayedTime(item, item.children))}
                    </Typography>
                </Box>
              </Box>
            </ListItemButton>
          </ListItem>
        )}
        {addingSubtaskTo === item.id && (
          <ListItem sx={{ pl: (level + 2) * 4 }}>
            <TextField label="新しいサブタスク名" variant="standard" fullWidth autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(item.id, (e.target as HTMLInputElement).value); }} disabled={isDisabled} />
          </ListItem>
        )}
        {renderChildren}
      </Box>
    );
  };

  const selectedMenuTask = state.tasks.find(t => t.id === menuTaskId);
  
  // 💡新規追加: 時間編集ダイアログ用のデータ
  const taskToEditTime = state.tasks.find((t): t is TimedTaskItem => t.id === state.editingTimeId && t.type === 'task') || null;
  const currentTaskTimeMs = taskToEditTime ? taskToEditTime.elapsedTime : 0;
  

  return (
    <Box>
      <AppBar position="fixed"><Toolbar><Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>Time Logger</Typography><IconButton color="inherit" onClick={() => setSettingsOpen(true)}><SettingsIcon /></IconButton><IconButton color="inherit" onClick={() => { if (window.confirm('現在記録中のタスクを停止しますか？')) dispatch({ type: 'STOP_ALL_TIMERS' }); }} disabled={!!state.editingTimeId}><AccessTimeIcon /></IconButton><IconButton color="inherit" onClick={() => { if (window.confirm(`新しい一日を開始しますか？\n本日追加したタスクはリセットされます。`)) dispatch({ type: 'START_NEW_DAY' }); }} disabled={!!state.editingTimeId}><RefreshIcon /></IconButton></Toolbar></AppBar>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} tasks={state.tasks} dispatch={dispatch} onExport={handleExport} />
      <Container maxWidth="sm" sx={{ paddingTop: '150px' }}>
        <Box sx={{ my: 2 }}>
          {/* 🚨 修正: 現在のタスク強調表示 (NOW hoge!!!) 🚨 */}
          <Paper 
              elevation={4} 
              sx={{ 
                  p: 1, 
                  mb: 2, 
                  textAlign: 'center',
                  bgcolor: 'background.paper', 
                  // 💡修正: 時間編集中はアニメーションを停止
                  animation: isTimerActive && !state.editingTimeId ? `${pulse} 1.5s infinite` : 'none',
                  transformOrigin: 'center',
                  cursor: isTimerActive && !state.editingTimeId ? 'pointer' : 'default',
                  position: 'fixed',
                  top: 60, 
                  left: 0,
                  right: 0,
                  margin: 'auto',
                  width: '100%',
                  maxWidth: (theme) => theme.breakpoints.values.sm,
                  zIndex: 1000, 
              }}
              onClick={() => isTimerActive && !state.editingTimeId && setShowActiveTaskDetails(prev => !prev)} 
          >
              <Typography 
                  variant="h5" 
                  component="div" 
                  sx={{ 
                      fontWeight: 'bold', 
                      color: 'primary.main',
                      textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                  }}
              >
                  {isTimerActive ? `「${activeTaskName}」 進行中` : 'タイマー停止中'}
              </Typography>
              {isTimerActive && showActiveTaskDetails && (
                  <Box sx={{ mt: 1 }}>
                      <Typography variant="body2" color="textSecondary">
                          開始: {new Date(state.sessionStartTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                          継続時間: {formatTime(currentTime - state.sessionStartTime)}
                      </Typography>
                  </Box>
              )}
          </Paper>
          
          <List>
            {/* 🚨 D&Dコンポーネントを削除し、renderTaskを直接呼び出しに戻す 🚨 */}
            {taskTree.map(task => renderTask(task, 0))}
          </List>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
            {isAdding ? (
              <TextField label="新しい親タスク名" variant="standard" fullWidth autoFocus value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddGrouping(); }} disabled={!!state.editingTimeId} />
            ) : (
              <>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsAdding(true)} disabled={!!state.editingTimeId}>親タスクを追加</Button>
              </>
            )}
          </Box>
        </Box>
      </Container>
      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>
        {[
          // 🚨 [新規追加] 一つ上に移動 🚨
          selectedMenuTask && selectedMenuTask.type !== 'grouping'　&& (
              <MenuItem key="move-up" onClick={() => {
                  if (menuTaskId !== null) {
                      dispatch({ type: 'MOVE_UP', payload: menuTaskId });
                  }
                  handleMenuClose();
              }} disabled={!!state.editingTimeId}>
                  <Box component="span" sx={{ mr: 1, color: 'text.secondary', fontWeight: 'bold', fontSize: '1rem' }}>↑</Box> 上に移動
              </MenuItem>
          ),
          // --------------------------
          // 💡新規追加: 時間編集メニュー項目
          selectedMenuTask && selectedMenuTask.type === 'task' && (
            <MenuItem key="edit-time" onClick={() => handleStartTimeEdit(menuTaskId!)} disabled={!!state.editingTimeId}>
                <AccessTimeIcon sx={{ mr: 1 }} fontSize="small" />時間を編集 (入力)
            </MenuItem>
          ),
          // --------------------------
          selectedMenuTask && selectedMenuTask.parentId === null && (
            <MenuItem key="add-subtask" onClick={() => { 
              if (menuTaskId !== null) setAddingSubtaskTo(menuTaskId); 
              handleMenuClose(); 
            }} disabled={!!state.editingTimeId}><AddCircleOutlineIcon sx={{ mr: 1 }} fontSize="small" />サブタスクを追加</MenuItem>
          ),
          selectedMenuTask && selectedMenuTask.parentId === null && (
            <MenuItem key="add-quick-subtask" onClick={() => {
              if (menuTaskId !== null) {
                dispatch({ type: 'ADD_QUICK_SUB_TASK', payload: { parentId: menuTaskId, switchTime: Date.now() } });
              }
              handleMenuClose();
            }} disabled={!!state.editingTimeId}><BoltIcon sx={{ mr: 1 }} fontSize="small" />クイックサブタスク</MenuItem>
          ),
          <MenuItem key="edit" onClick={() => { 
            if (menuTaskId !== null) { 
              dispatch({ type: 'START_EDIT', payload: menuTaskId });
            }
            handleMenuClose(); 
          }} disabled={!!state.editingTimeId}><EditIcon sx={{ mr: 1 }} fontSize="small" />名前を編集</MenuItem>,
          
          selectedMenuTask && selectedMenuTask.type === 'task' && (
            <MenuItem key="reset" onClick={() => { 
              if (menuTaskId !== null) { 
                dispatch({ type: 'RESET_TIME', payload: menuTaskId });
              }
              handleMenuClose(); 
            }} disabled={!!state.editingTimeId}><AccessTimeIcon sx={{ mr: 1 }} fontSize="small" />時間をリセット</MenuItem>
          ),          
          <MenuItem key="delete" sx={{ color: 'error.main' }} onClick={() => { 
            if(menuTaskId !== null && window.confirm(`タスク「${selectedMenuTask?.name}」を削除しますか？`)) 
              dispatch({ type: 'DELETE_TASK', payload: menuTaskId }); 
            handleMenuClose(); 
          }} disabled={!!state.editingTimeId}><DeleteIcon sx={{ mr: 1 }} fontSize="small" />タスクを削除</MenuItem>,
        ].filter(Boolean)}
      </Menu>

      {/* 💡新規追加: 時間編集ダイアログのレンダリング */}
      <TimeEditDialog
          open={!!state.editingTimeId}
          onClose={handleCloseTimeEdit}
          task={taskToEditTime}
          onSave={handleFinishTimeEdit}
          initialTimeMs={currentTaskTimeMs} // 現在のタスクの経過時間を渡す
      />

      {/* 💡新規追加: エクスポートダイアログのレンダリング */}
      <ExportDialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          exportText={exportText}
      />
    </Box>
  );
}