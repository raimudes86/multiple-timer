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
    { id: 1, name: '毎日行うこと', type: 'grouping', parentId: null },
    { id: 2, name: '朝・夕会関連', type: 'task', elapsedTime: 0, parentId: 1 },
    { id: 3, name: '休憩', type: 'task', elapsedTime: 0, parentId: 1 },
    { id: 4, name: '質問対応', type: 'task', elapsedTime: 0, parentId: 1 },
    { id: 5, name: '未分類', type: 'task', elapsedTime: 0, parentId: 1 },
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
  | { type: 'MOVE_UP'; payload: number }; // 🚨 新規追加: MOVE_UPアクション


const initialState: AppState = {
  tasks: [],
  activeTaskId: DEFAULT_ACTIVE_TASK_ID,
  sessionStartTime: Date.now(),
  editingTaskId: null,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  const getNewId = () => (state.tasks.length > 0 ? Math.max(...state.tasks.map(t => t.id)) : 0) + 1;

  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload, editingTaskId: null };
    case 'START_NEW_DAY':
      return { ...initialState, tasks: DEFAULT_INITIAL_TASKS, activeTaskId: DEFAULT_ACTIVE_TASK_ID, sessionStartTime: Date.now() };
    case 'SWITCH_TASK':
      if (state.editingTaskId) return state;

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
      return { ...state, editingTaskId: action.payload };
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
  
  const [expandedTimeButtonId, setExpandedTimeButtonId] = useState<number | null>(null);
  const [showActiveTaskDetails, setShowActiveTaskDetails] = useState(false);

  // 🚨 D&D関連の未使用なセンサーを削除 (コードは簡略化)
  // const sensors = useSensors(...) は削除

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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, taskId: number) => { setMenuAnchorEl(event.currentTarget); setMenuTaskId(taskId); };
  const handleMenuClose = () => { setMenuAnchorEl(null); setMenuTaskId(null); };
  const handleSwitchTask = (newTaskId: number) => {
    const hasChildren = state.tasks.some(t => t.parentId === newTaskId);
    if (hasChildren || state.editingTaskId || state.activeTaskId === newTaskId) return;
    dispatch({ type: 'SWITCH_TASK', payload: { newTaskId, switchTime: Date.now() } });
    setExpandedTimeButtonId(null);
  };
  const handleAddPlannedTask = () => {
    if (newTaskName.trim() !== '') {
      dispatch({ type: 'ADD_PLANNED_TASK', payload: newTaskName });
      setNewTaskName('');
      setIsAdding(false);
    }
  };
  const handleAddSubtask = (parentId: number, name: string) => {
    if (name.trim() !== '') {
      dispatch({ type: 'ADD_SUB_TASK', payload: { parentId, name } });
      setAddingSubtaskTo(null);
    }
  };
  
  const handleAddGrouping = () => {
    if (newTaskName.trim() !== '') {
      dispatch({ type: 'ADD_GROUPING', payload: newTaskName });
      setNewTaskName('');
      setIsAdding(false);
    }
  };

  // D&D関連の不要な関数は削除（ここではMOVE_UPに置き換え）
  // const handleDragEnd = (event: DragEndEvent) => { ... } は削除

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

    if (isGrouping) {
      displayedTime = children.filter(child => child.type === 'task').reduce((acc, child) => {
        let childTime = (child as TimedTaskItem).elapsedTime;
        if (child.id === state.activeTaskId && child.type === 'task' && !state.editingTaskId) {
          const sessionDuration = Math.max(0, currentTime - state.sessionStartTime);
          childTime += sessionDuration;
        }
        return acc + childTime;
      }, 0);
    } else { // item.type === 'task'
      displayedTime = (item as TimedTaskItem).elapsedTime;
    }

    if (!isGrouping && item.id === state.activeTaskId && item.type === 'task' && !state.editingTaskId) {
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

  // 🚨 D&Dコンポーネントを削除し、renderTaskを元に戻す 🚨
  const renderTask = (item: AppItem & { children: AppItem[] }, level: number) => {
    const isTopLevel = item.parentId === null;
    const isGrouping = item.type === 'grouping';
    const canBeActive = item.type === 'task';
    const isExpanded = state.activeTaskId === item.id && expandedTimeButtonId === item.id;

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
          <ListItem disablePadding secondaryAction={<IconButton edge="end" onClick={(e) => handleMenuOpen(e, item.id)}><MoreVertIcon /></IconButton>}>
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
          <ListItem disablePadding secondaryAction={<IconButton edge="end" onClick={(e) => handleMenuOpen(e, item.id)}><MoreVertIcon /></IconButton>}>
            <ListItemButton
              disabled={!canBeActive}
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
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: -300000 } })}}>-5m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: -60000 } })}}>-1m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: 60000 } })}}>+1m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: 300000 } })}}>+5m</Button>
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
            <TextField label="新しいサブタスク名" variant="standard" fullWidth autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(item.id, (e.target as HTMLInputElement).value); }} />
          </ListItem>
        )}
        {renderChildren}
      </Paper>
    ) : (
      <Box key={item.id} sx={{ mb: 0 }}>
        {isGrouping ? (
          <ListItem disablePadding secondaryAction={<IconButton edge="end" onClick={(e) => handleMenuOpen(e, item.id)}><MoreVertIcon /></IconButton>}>
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
          <ListItem disablePadding secondaryAction={<IconButton edge="end" onClick={(e) => handleMenuOpen(e, item.id)}><MoreVertIcon /></IconButton>}>
            <ListItemButton
              disabled={!canBeActive}
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
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: -300000 } })}}>-5m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: -60000 } })}}>-1m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: 60000 } })}}>+1m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: 300000 } })}}>+5m</Button>
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
            <TextField label="新しいサブタスク名" variant="standard" fullWidth autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(item.id, (e.target as HTMLInputElement).value); }} />
          </ListItem>
        )}
        {renderChildren}
      </Box>
    );
  };

  const selectedMenuTask = state.tasks.find(t => t.id === menuTaskId);

  return (
    <Box>
      <AppBar position="fixed"><Toolbar><Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>Time Logger</Typography><IconButton color="inherit" onClick={() => setSettingsOpen(true)}><SettingsIcon /></IconButton><IconButton color="inherit" onClick={() => { if (window.confirm('現在記録中のタスクを停止しますか？')) dispatch({ type: 'STOP_ALL_TIMERS' }); }}><AccessTimeIcon /></IconButton><IconButton color="inherit" onClick={() => { if (window.confirm(`新しい一日を開始しますか？
本日追加したタスクはリセットされます。`)) dispatch({ type: 'START_NEW_DAY' }); }}><RefreshIcon /></IconButton></Toolbar></AppBar>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} tasks={state.tasks} dispatch={dispatch} />
      <Container maxWidth="sm" sx={{ paddingTop: '90px' }}>
        <Box sx={{ my: 2 }}>
          {/* 🚨 修正: 現在のタスク強調表示 (NOW hoge!!!) 🚨 */}
          <Paper 
              elevation={4} 
              sx={{ 
                  p: 1, 
                  mb: 2, 
                  textAlign: 'center',
                  bgcolor: 'background.paper', 
                  animation: isTimerActive ? `${pulse} 1.5s infinite` : 'none',
                  transformOrigin: 'center',
                  cursor: isTimerActive ? 'pointer' : 'default',
                  position: 'fixed',
                  top: 60, 
                  left: 0,
                  right: 0,
                  margin: 'auto',
                  width: '100%',
                  maxWidth: (theme) => theme.breakpoints.values.sm,
                  zIndex: 1000, 
              }}
              onClick={() => isTimerActive && setShowActiveTaskDetails(prev => !prev)} 
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
              <TextField label="新しい親タスク名" variant="standard" fullWidth autoFocus value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddGrouping(); }} />
            ) : (
              <>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsAdding(true)}>親タスクを追加</Button>
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
              }}>
                  <Box component="span" sx={{ mr: 1, color: 'text.secondary', fontWeight: 'bold', fontSize: '1rem' }}>↑</Box> 上に移動
              </MenuItem>
          ),
          // --------------------------
          selectedMenuTask && selectedMenuTask.parentId === null && (
            <MenuItem key="add-subtask" onClick={() => { 
              if (menuTaskId !== null) setAddingSubtaskTo(menuTaskId); 
              handleMenuClose(); 
            }}><AddCircleOutlineIcon sx={{ mr: 1 }} fontSize="small" />サブタスクを追加</MenuItem>
          ),
          selectedMenuTask && selectedMenuTask.parentId === null && (
            <MenuItem key="add-quick-subtask" onClick={() => {
              if (menuTaskId !== null) {
                dispatch({ type: 'ADD_QUICK_SUB_TASK', payload: { parentId: menuTaskId, switchTime: Date.now() } });
              }
              handleMenuClose();
            }}><BoltIcon sx={{ mr: 1 }} fontSize="small" />クイックサブタスク</MenuItem>
          ),
          // 🚨 エラー箇所 (538行目) 修正済み 🚨
          <MenuItem key="edit" onClick={() => { 
            if (menuTaskId !== null) { 
              dispatch({ type: 'START_EDIT', payload: menuTaskId });
            }
            handleMenuClose(); 
          }}><EditIcon sx={{ mr: 1 }} fontSize="small" />名前を編集</MenuItem>,
          
          selectedMenuTask && selectedMenuTask.type === 'task' && (
            <MenuItem key="reset" onClick={() => { 
              if (menuTaskId !== null) { // 🚨 修正済み (6)
                dispatch({ type: 'RESET_TIME', payload: menuTaskId });
              }
              handleMenuClose(); 
            }}><AccessTimeIcon sx={{ mr: 1 }} fontSize="small" />時間をリセット</MenuItem>
          ),          
          <MenuItem key="delete" sx={{ color: 'error.main' }} onClick={() => { 
            if(menuTaskId !== null && window.confirm(`タスク「${selectedMenuTask?.name}」を削除しますか？`)) 
              dispatch({ type: 'DELETE_TASK', payload: menuTaskId }); 
            handleMenuClose(); 
          }}><DeleteIcon sx={{ mr: 1 }} fontSize="small" />タスクを削除</MenuItem>,
        ].filter(Boolean)}
      </Menu>
    </Box>
  );
}