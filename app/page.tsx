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

// --- State, Actions, and Reducer ---

// 🌟 1. 初期タスクのリストを外部定数として定義 (保守性向上のため)
const DEFAULT_INITIAL_TASKS: AppItem[] = [
    { id: 1, name: '毎日行うこと', type: 'grouping', parentId: null },
    { id: 2, name: '朝・夕会関連', type: 'task', elapsedTime: 0, parentId: 1 },
    { id: 3, name: '休憩', type: 'task', elapsedTime: 0, parentId: 1 },
    { id: 4, name: '質問対応', type: 'task', elapsedTime: 0, parentId: 1 },
    { id: 5, name: '未分類', type: 'task', elapsedTime: 0, parentId: 1 },
];
const DEFAULT_ACTIVE_TASK_ID = 2; // activeTaskIdをGroupingではないID 2に設定

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
  activeTaskId: number | null; // nullも許容
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
  | { type: 'DELETE_TASK'; payload: number } // 追加されているアクション
  | { type: 'IMPORT_TASKS_BATCH'; payload: { name: string; parentName: string | null }[] };



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
      // 2. Reducer内で定数を参照する
      return { ...initialState, tasks: DEFAULT_INITIAL_TASKS, activeTaskId: DEFAULT_ACTIVE_TASK_ID, sessionStartTime: Date.now() };
    case 'SWITCH_TASK':
      if (state.editingTaskId) return state;

      const currentActiveTask = state.tasks.find(t => t.id === state.activeTaskId);
      const newActiveTask = state.tasks.find(t => t.id === action.payload.newTaskId);

      // Only allow switching to a 'task' type item
      if (!newActiveTask || newActiveTask.type !== 'task') return state;

      let tasksAfterSwitch = state.tasks;

      // Update elapsed time for the previously active task if it was a 'task' type
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
      const tasksWithOldTime = state.tasks.map(task =>
        task.id === state.activeTaskId ? { ...task, elapsedTime: task.elapsedTime + durationForQuickAdd } : task
      );
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
      if (descendantIds.has(state.activeTaskId)) {
        const newActiveTask: TimedTaskItem = remainingTasks.length > 0 && remainingTasks[0].type === 'task' ? remainingTasks[0] as TimedTaskItem : { id: getNewId(), name: '未分類', type: 'task', elapsedTime: 0, parentId: null };
        return { ...state, tasks: remainingTasks.length > 0 ? remainingTasks : [newActiveTask], activeTaskId: newActiveTask.id, sessionStartTime: Date.now() };
      }
      return { ...state, tasks: remainingTasks, activeTaskId: state.activeTaskId };
    case 'STOP_ALL_TIMERS':
      if (state.activeTaskId === null) return state; // No active task to stop

      const stopDuration = Date.now() - state.sessionStartTime;
      const tasksAfterStop = state.tasks.map(task =>
        task.id === state.activeTaskId ? { ...task, elapsedTime: task.elapsedTime + stopDuration } : task
      );
      return { ...state, tasks: tasksAfterStop, activeTaskId: null, sessionStartTime: Date.now() };
    case 'IMPORT_TASKS_BATCH':
      let currentMaxId = getNewId() - 1; // getNewId() returns maxId + 1, so subtract 1
      const newTasks: AppItem[] = [];
      const parentNameToIdMap = new Map<string, number>();

      action.payload.forEach(item => {
        currentMaxId++;
        if (item.parentName === null) {
          // This is a parent task (grouping)
          const newParentTask: GroupingItem = { id: currentMaxId, name: item.name, type: 'grouping', parentId: null };
          newTasks.push(newParentTask);
          parentNameToIdMap.set(item.name, currentMaxId);
        } else {
          // This is a child task (timed task)
          const parentId = parentNameToIdMap.get(item.parentName);
          if (parentId !== undefined) {
            const newChildTask: TimedTaskItem = { id: currentMaxId, name: item.name, type: 'task', elapsedTime: 0, parentId: parentId };
            newTasks.push(newChildTask);
          } else {
            // If parent not found, add as a top-level timed task (fallback)
            const newTopLevelTask: TimedTaskItem = { id: currentMaxId, name: item.name, type: 'task', elapsedTime: 0, parentId: null };
            newTasks.push(newTopLevelTask);
          }
        }
      });
      return { ...state, tasks: [...state.tasks, ...newTasks] };
    case 'ADD_GROUPING':
      const newGrouping: GroupingItem = { id: getNewId(), name: action.payload, type: 'grouping', parentId: null };
      return { ...state, tasks: [...state.tasks, newGrouping] };
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
        // 3. HomePageのuseEffect内で定数を参照する (elseブロック)
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
      // 4. HomePageのuseEffect内で定数を参照する (catchブロック)
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
  // 🌟 handleAddGrouping関数を修正後の定義で追加
  const handleAddGrouping = () => {
    if (newTaskName.trim() !== '') {
      dispatch({ type: 'ADD_GROUPING', payload: newTaskName });
      setNewTaskName('');
      setIsAdding(false);
    }
  };

  const { taskTree, tasksById } = useMemo(() => {
    const tasksById = new Map(state.tasks.map(t => [t.id, { ...t, children: [] as (AppItem & { children: AppItem[] })[] }]));
    const tree: (AppItem & { children: AppItem[] })[] = [];
    for (const item of tasksById.values()) {
      if (item.parentId) {
        tasksById.get(item.parentId)?.children.push(item);
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
      displayedTime = children.filter(child => child.type === 'task').reduce((acc, child) => acc + (child as TimedTaskItem).elapsedTime, 0);
    } else { // item.type === 'task'
      displayedTime = (item as TimedTaskItem).elapsedTime;
    }

    if (item.id === state.activeTaskId && item.type === 'task' && !state.editingTaskId) {
      const sessionDuration = Math.max(0, currentTime - state.sessionStartTime);
      displayedTime += sessionDuration;
    }
    return displayedTime;
  };

  if (!isLoaded) {
    return <Container maxWidth="sm"><Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box></Container>;
  }

  const renderTask = (item: AppItem & { children: AppItem[] }, level: number) => {
    const isTopLevel = item.parentId === null;
    const isGrouping = item.type === 'grouping';
    const canBeActive = item.type === 'task';

    if (state.editingTaskId === item.id) {
      return <ListItem key={item.id} sx={{ pl: level * 4 }}><TextField defaultValue={item.name} variant="standard" fullWidth autoFocus onBlur={(e) => dispatch({ type: 'UPDATE_TASK_NAME', payload: { id: item.id, newName: (e.target as HTMLInputElement).value } })} onKeyDown={(e) => { if (e.key === 'Enter') dispatch({ type: 'UPDATE_TASK_NAME', payload: { id: item.id, newName: (e.target as HTMLInputElement).value } }); }} /></ListItem>;
    }

    return isTopLevel ? (
      <Paper key={item.id} elevation={2} sx={{ mb: 2, p: 1 }}>
        {isGrouping ? (
          <ListItem disablePadding secondaryAction={<IconButton edge="end" onClick={(e) => handleMenuOpen(e, item.id)}><MoreVertIcon /></IconButton>}>
            <ListItemText
              primary={item.name}
              primaryTypographyProps={{ fontWeight: 'bold', fontSize: '1.1rem' }}
              sx={{ pl: isTopLevel ? 2 : level * 2 }}
            />
            <Box sx={{ minWidth: '80px', textAlign: 'right' }} />
          </ListItem>
        ) : (
          <ListItem disablePadding secondaryAction={<IconButton edge="end" onClick={(e) => handleMenuOpen(e, item.id)}><MoreVertIcon /></IconButton>}>
            <ListItemButton
              disabled={!canBeActive}
              selected={canBeActive && item.id === state.activeTaskId}
              onClick={() => canBeActive && handleSwitchTask(item.id)}
              sx={{
                pl: isTopLevel ? 2 : level * 2,
                ...(isTopLevel && item.children.length > 0 && { borderBottom: '1px solid', borderColor: 'divider' }),
              }}
            >
              <ListItemText primary={item.name} primaryTypographyProps={{ fontWeight: 'normal' }} />
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {state.activeTaskId === item.id && (
                  <ButtonGroup size="small" variant="text" color="inherit" sx={{ mr: 2 }}>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: -300000 } })}}>-5m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: -60000 } })}}>-1m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: 60000 } })}}>+1m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: 300000 } })}}>+5m</Button>
                  </ButtonGroup>
                )}
                <Typography variant="body1" sx={{ fontFamily: 'monospace', minWidth: '80px', textAlign: 'right' }}>{formatTime(getTaskDisplayedTime(item, item.children))}</Typography>
              </Box>
            </ListItemButton>
          </ListItem>
        )}
        {addingSubtaskTo === item.id && (
          <ListItem sx={{ pl: (level + 2) * 4 }}>
            <TextField label="新しいサブタスク名" variant="standard" fullWidth autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(item.id, (e.target as HTMLInputElement).value); }} />
          </ListItem>
        )}
        {item.children.length > 0 && <List disablePadding>{item.children.map(child => renderTask(child, level + 1))}</List>}
      </Paper>
    ) : (
      <Box key={item.id} sx={{ mb: 0 }}>
        {isGrouping ? (
          <ListItem disablePadding secondaryAction={<IconButton edge="end" onClick={(e) => handleMenuOpen(e, item.id)}><MoreVertIcon /></IconButton>}>
            <ListItemText
              primary={item.name}
              primaryTypographyProps={{ fontWeight: 'bold', fontSize: '1.1rem' }}
              sx={{ pl: isTopLevel ? 2 : level * 2 }}
            />
            <Box sx={{ minWidth: '80px', textAlign: 'right' }} />
          </ListItem>
        ) : (
          <ListItem disablePadding secondaryAction={<IconButton edge="end" onClick={(e) => handleMenuOpen(e, item.id)}><MoreVertIcon /></IconButton>}>
            <ListItemButton
              disabled={!canBeActive}
              selected={canBeActive && item.id === state.activeTaskId}
              onClick={() => canBeActive && handleSwitchTask(item.id)}
              sx={{
                pl: isTopLevel ? 2 : level * 2,
                ...(isTopLevel && item.children.length > 0 && { borderBottom: '1px solid', borderColor: 'divider' }),
              }}
            >
              <ListItemText primary={item.name} primaryTypographyProps={{ fontWeight: 'normal' }} />
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                {state.activeTaskId === item.id && (
                  <ButtonGroup size="small" variant="text" color="inherit" sx={{ mr: 2 }}>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: -300000 } })}}>-5m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: -60000 } })}}>-1m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: 60000 } })}}>+1m</Button>
                    <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: item.id, amount: 300000 } })}}>+5m</Button>
                  </ButtonGroup>
                )}
                <Typography variant="body1" sx={{ fontFamily: 'monospace', minWidth: '80px', textAlign: 'right' }}>{formatTime(getTaskDisplayedTime(item, item.children))}</Typography>
              </Box>
            </ListItemButton>
          </ListItem>
        )}
        {addingSubtaskTo === item.id && (
          <ListItem sx={{ pl: (level + 2) * 4 }}>
            <TextField label="新しいサブタスク名" variant="standard" fullWidth autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(item.id, (e.target as HTMLInputElement).value); }} />
          </ListItem>
        )}
        {item.children.length > 0 && <List disablePadding>{item.children.map(child => renderTask(child, level + 1))}</List>}
      </Box>
    );
  };

  const selectedMenuTask = state.tasks.find(t => t.id === menuTaskId);

  return (
    <Box>
      <AppBar position="static"><Toolbar><Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>Time Logger</Typography><IconButton color="inherit" onClick={() => setSettingsOpen(true)}><SettingsIcon /></IconButton><IconButton color="inherit" onClick={() => { if (window.confirm('現在記録中のタスクを停止しますか？')) dispatch({ type: 'STOP_ALL_TIMERS' }); }}><AccessTimeIcon /></IconButton><IconButton color="inherit" onClick={() => { if (window.confirm(`新しい一日を開始しますか？
本日追加したタスクはリセットされます。`)) dispatch({ type: 'START_NEW_DAY' }); }}><RefreshIcon /></IconButton></Toolbar></AppBar>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} tasks={state.tasks} dispatch={dispatch} />
      <Container maxWidth="sm">
        <Box sx={{ my: 2 }}>
          <Typography variant="subtitle1" color="text.secondary">現在記録中のタスク: {state.tasks.find(t => t.id === state.activeTaskId)?.name}</Typography>
          <List>
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
          selectedMenuTask && selectedMenuTask.parentId === null && (
            <MenuItem key="add-subtask" onClick={() => { setAddingSubtaskTo(selectedMenuTask.id); handleMenuClose(); }}><AddCircleOutlineIcon sx={{ mr: 1 }} fontSize="small" />サブタスクを追加</MenuItem>
          ),
          selectedMenuTask && selectedMenuTask.parentId === null && (
            <MenuItem key="add-quick-subtask" onClick={() => {
              dispatch({ type: 'ADD_QUICK_SUB_TASK', payload: { parentId: selectedMenuTask.id, switchTime: Date.now() } });
              handleMenuClose();
            }}><BoltIcon sx={{ mr: 1 }} fontSize="small" />クイックサブタスク</MenuItem>
          ),
          <MenuItem key="edit" onClick={() => { dispatch({ type: 'START_EDIT', payload: menuTaskId }); handleMenuClose(); }}><EditIcon sx={{ mr: 1 }} fontSize="small" />名前を編集</MenuItem>,
          selectedMenuTask && selectedMenuTask.type === 'task' && (
            <MenuItem key="reset" onClick={() => { dispatch({ type: 'RESET_TIME', payload: menuTaskId }); handleMenuClose(); }}><AccessTimeIcon sx={{ mr: 1 }} fontSize="small" />時間をリセット</MenuItem>
          ),          <MenuItem key="delete" sx={{ color: 'error.main' }} onClick={() => { if(window.confirm(`タスク「${selectedMenuTask?.name}」を削除しますか？`)) dispatch({ type: 'DELETE_TASK', payload: menuTaskId }); handleMenuClose(); }}><DeleteIcon sx={{ mr: 1 }} fontSize="small" />タスクを削除</MenuItem>,
        ].filter(Boolean)}
      </Menu>
    </Box>
  );
}