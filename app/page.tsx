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
interface Task {
  id: number;
  name: string;
  elapsedTime: number; // ms
  parentId: number | null;
}

interface AppState {
  tasks: Task[];
  activeTaskId: number;
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
  | { type: 'DELETE_TASK'; payload: number };



const initialState: AppState = {
  tasks: [],
  activeTaskId: 1,
  sessionStartTime: Date.now(),
  editingTaskId: null,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  const getNewId = () => (state.tasks.length > 0 ? Math.max(...state.tasks.map(t => t.id)) : 0) + 1;

  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload, editingTaskId: null };
    case 'START_NEW_DAY':
      const newDayInitialTasks: Task[] = [
        { id: 1, name: '毎日行うこと', elapsedTime: 0, parentId: null },
        { id: 2, name: '朝・夕会関連', elapsedTime: 0, parentId: 1 },
        { id: 3, name: '休憩', elapsedTime: 0, parentId: 1 },
        { id: 4, name: '未分類', elapsedTime: 0, parentId: 1 },
      ];
      return { ...initialState, tasks: newDayInitialTasks, activeTaskId: 1, sessionStartTime: Date.now() };
    case 'SWITCH_TASK':
      if (state.editingTaskId) return state;
      const duration = action.payload.switchTime - state.sessionStartTime;
      const updatedTasks = state.tasks.map(task =>
        task.id === state.activeTaskId ? { ...task, elapsedTime: task.elapsedTime + duration } : task
      );
      return { ...state, tasks: updatedTasks, activeTaskId: action.payload.newTaskId, sessionStartTime: action.payload.switchTime };
    case 'START_EDIT':
      return { ...state, editingTaskId: action.payload };
    case 'UPDATE_TASK_NAME':
      return { ...state, editingTaskId: null, tasks: state.tasks.map(task => task.id === action.payload.id ? { ...task, name: action.payload.newName } : task) };
    case 'ADD_PLANNED_TASK':
      const newPlannedTask: Task = { id: getNewId(), name: action.payload, elapsedTime: 0, parentId: null };
      return { ...state, tasks: [...state.tasks, newPlannedTask] };
    case 'ADD_SUB_TASK':
      const newSubTask: Task = { id: getNewId(), name: action.payload.name, elapsedTime: 0, parentId: action.payload.parentId };
      return { ...state, tasks: [...state.tasks, newSubTask] };
    case 'ADD_QUICK_TASK':
    case 'ADD_QUICK_SUB_TASK':
      const isSub = action.type === 'ADD_QUICK_SUB_TASK';
      const parentId = isSub ? action.payload.parentId : null;
      const namePrefix = isSub ? '臨時サブタスク' : '臨時タスク';
      const count = state.tasks.filter(t => t.name.startsWith(namePrefix) && t.parentId === parentId).length + 1;
      const quickTaskName = `${namePrefix} ${count}`;
      const newQuickId = getNewId();
      const newQuickTask: Task = { id: newQuickId, name: quickTaskName, elapsedTime: 0, parentId };
      const durationForQuickAdd = action.payload.switchTime - state.sessionStartTime;
      const tasksWithOldTime = state.tasks.map(task =>
        task.id === state.activeTaskId ? { ...task, elapsedTime: task.elapsedTime + durationForQuickAdd } : task
      );
      return { ...state, tasks: [...tasksWithOldTime, newQuickTask], activeTaskId: newQuickId, sessionStartTime: action.payload.switchTime };
    case 'ADJUST_TIME':
      return { ...state, tasks: state.tasks.map(task => task.id === action.payload.taskId ? { ...task, elapsedTime: Math.max(0, task.elapsedTime + action.payload.amount) } : task) };
    case 'RESET_TIME':
      return { ...state, tasks: state.tasks.map(task => task.id === action.payload ? { ...task, elapsedTime: 0 } : task) };
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
        const newActiveTask = remainingTasks.length > 0 ? remainingTasks[0] : { id: getNewId(), name: '未分類', elapsedTime: 0, parentId: null };
        return { ...state, tasks: remainingTasks.length > 0 ? remainingTasks : [newActiveTask], activeTaskId: newActiveTask.id, sessionStartTime: Date.now() };
      }
      return { ...state, tasks: remainingTasks };
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
        // If no saved state, initialize with a default "毎日行うこと" task
        const initialTasks: Task[] = [
          { id: 1, name: '毎日行うこと', elapsedTime: 0, parentId: null },
          { id: 2, name: '朝・夕会関連', elapsedTime: 0, parentId: 1 },
          { id: 3, name: '休憩', elapsedTime: 0, parentId: 1 },
          { id: 4, name: '未分類', elapsedTime: 0, parentId: 1 },
        ];
        dispatch({
          type: 'LOAD_STATE',
          payload: {
            tasks: initialTasks,
            activeTaskId: 1,
            sessionStartTime: Date.now(),
          },
        });
      }
    } catch (error) {
      console.error("Failed to load data", error);
      // Fallback to initial state if loading fails, creating a default task structure
      const initialTasks: Task[] = [
        { id: 1, name: '毎日行うこと', elapsedTime: 0, parentId: null },
        { id: 2, name: '朝・夕会関連', elapsedTime: 0, parentId: 1 },
        { id: 3, name: '休憩', elapsedTime: 0, parentId: 1 },
        { id: 4, name: '未分類', elapsedTime: 0, parentId: 1 },
      ];
      dispatch({
        type: 'LOAD_STATE',
        payload: {
          tasks: initialTasks,
          activeTaskId: 1,
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
  const handleQuickAddTask = () => dispatch({ type: 'ADD_QUICK_TASK', payload: { switchTime: Date.now() } });
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

  const { taskTree, tasksById } = useMemo(() => {
    const tasksById = new Map(state.tasks.map(t => [t.id, { ...t, children: [] as (Task & { children: any[] })[] }]));
    const tree: (Task & { children: any[] })[] = [];
    for (const task of tasksById.values()) {
      if (task.parentId) {
        tasksById.get(task.parentId)?.children.push(task);
      } else {
        tree.push(task);
      }
    }
    return { taskTree: tree, tasksById };
  }, [state.tasks]);

  const getTaskDisplayedTime = (task: Task, children: Task[]) => {
    const isParent = children.length > 0;
    let displayedTime = isParent ? children.reduce((acc, child) => acc + child.elapsedTime, 0) : task.elapsedTime;
    if (task.id === state.activeTaskId && !isParent && !state.editingTaskId) {
      const sessionDuration = Math.max(0, currentTime - state.sessionStartTime);
      displayedTime += sessionDuration;
    }
    return displayedTime;
  };

  if (!isLoaded) {
    return <Container maxWidth="sm"><Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box></Container>;
  }

  const renderTask = (task: Task & { children: Task[] }, level: number) => {
    const isTopLevel = task.parentId === null;
    const isParent = task.children.length > 0;
    const canBeActive = !isParent;

    if (state.editingTaskId === task.id) {
      return <ListItem key={task.id} sx={{ pl: level * 4 }}><TextField defaultValue={task.name} variant="standard" fullWidth autoFocus onBlur={(e) => dispatch({ type: 'UPDATE_TASK_NAME', payload: { id: task.id, newName: e.target.value } })} onKeyDown={(e) => { if (e.key === 'Enter') dispatch({ type: 'UPDATE_TASK_NAME', payload: { id: task.id, newName: (e.target as HTMLInputElement).value } }); }} /></ListItem>;
    }

    return (
      <Box key={task.id}>
        <ListItem disablePadding secondaryAction={<IconButton edge="end" onClick={(e) => handleMenuOpen(e, task.id)}><MoreVertIcon /></IconButton>}>
          <ListItemButton selected={canBeActive && task.id === state.activeTaskId} onClick={() => canBeActive && handleSwitchTask(task.id)} sx={{ pl: level * 2 }}>
            <ListItemText primary={task.name} primaryTypographyProps={{ fontWeight: isParent || isTopLevel ? 'bold' : 'normal' }} />
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {isTopLevel ? (
                <>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAddingSubtaskTo(task.id); }}><AddCircleOutlineIcon fontSize="small" /></IconButton>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADD_QUICK_SUB_TASK', payload: { parentId: task.id, switchTime: Date.now() } })}}><BoltIcon fontSize="small" /></IconButton>
                </>
              ) : (
                <>
                  {state.activeTaskId === task.id && (
                    <ButtonGroup size="small" variant="text" color="inherit" sx={{ mr: 2 }}>
                      <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: task.id, amount: -300000 } })}}>-5m</Button>
                      <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: task.id, amount: -60000 } })}}>-1m</Button>
                      <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: task.id, amount: 60000 } })}}>+1m</Button>
                      <Button onClick={(e) => { e.stopPropagation(); dispatch({ type: 'ADJUST_TIME', payload: { taskId: task.id, amount: 300000 } })}}>+5m</Button>
                    </ButtonGroup>
                  )}
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', minWidth: '80px', textAlign: 'right' }}>{formatTime(getTaskDisplayedTime(task, []))}</Typography>
                </>
              )}
            </Box>
          </ListItemButton>
        </ListItem>
        {addingSubtaskTo === task.id && (
          <ListItem sx={{ pl: (level + 2) * 4 }}>
            <TextField label="新しいサブタスク名" variant="standard" fullWidth autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(task.id, (e.target as HTMLInputElement).value); }} onBlur={() => setAddingSubtaskTo(null)} />
          </ListItem>
        )}
        {isParent && <List disablePadding>{task.children.map(child => renderTask(child, level + 1))}</List>}
      </Box>
    );
  };

  const selectedMenuTask = state.tasks.find(t => t.id === menuTaskId);

  return (
    <Box>
      <AppBar position="static"><Toolbar><Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>Time Logger</Typography><IconButton color="inherit" onClick={() => setSettingsOpen(true)}><SettingsIcon /></IconButton><IconButton color="inherit" onClick={() => { if (window.confirm('新しい一日を開始しますか？\n本日追加したタスクはリセットされます。')) dispatch({ type: 'START_NEW_DAY' }); }}><RefreshIcon /></IconButton></Toolbar></AppBar>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} tasks={state.tasks} dispatch={dispatch} />
      <Container maxWidth="sm">
        <Box sx={{ my: 2 }}>
          <Typography variant="subtitle1" color="text.secondary">現在記録中のタスク: {state.tasks.find(t => t.id === state.activeTaskId)?.name}</Typography>
          <List>
            {taskTree.map(task => renderTask(task, 0))}
          </List>
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
            {isAdding ? (
              <TextField label="新しい親タスク名" variant="standard" fullWidth autoFocus value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddPlannedTask(); }} onBlur={() => setIsAdding(false)} />
            ) : (
              <>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsAdding(true)}>親タスクを追加</Button>
                <Button variant="outlined" startIcon={<BoltIcon />} onClick={handleQuickAddTask} sx={{ ml: 2 }}>割り込み開始</Button>
              </>
            )}
          </Box>
        </Box>
      </Container>
      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleMenuClose}>
        <MenuItem onClick={() => { dispatch({ type: 'START_EDIT', payload: menuTaskId }); handleMenuClose(); }}><EditIcon sx={{ mr: 1 }} fontSize="small" />名前を編集</MenuItem>,
        <MenuItem onClick={() => { dispatch({ type: 'RESET_TIME', payload: menuTaskId }); handleMenuClose(); }}><AccessTimeIcon sx={{ mr: 1 }} fontSize="small" />時間をリセット</MenuItem>,
        <MenuItem sx={{ color: 'error.main' }} onClick={() => { if(window.confirm(`タスク「${selectedMenuTask?.name}」を削除しますか？`)) dispatch({ type: 'DELETE_TASK', payload: menuTaskId }); handleMenuClose(); }}><DeleteIcon sx={{ mr: 1 }} fontSize="small" />タスクを削除</MenuItem>
      </Menu>
    </Box>
  );
}