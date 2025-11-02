'use client';

import { useState, useEffect, useReducer } from 'react';
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
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import BoltIcon from '@mui/icons-material/Bolt'; // 稲妻アイコン

// --- State, Actions, and Reducer ---
interface Task {
  id: number;
  name: string;
  elapsedTime: number;
  isTemplate: boolean;
}

interface AppState {
  tasks: Task[];
  activeTaskId: number;
  editingTaskId: number | null;
}

type AppAction =
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'START_NEW_DAY' }
  | { type: 'SWITCH_TASK'; payload: number }
  | { type: 'TICK' }
  | { type: 'START_EDIT'; payload: number }
  | { type: 'UPDATE_TASK_NAME'; payload: { id: number; newName: string } }
  | { type: 'ADD_PLANNED_TASK'; payload: string }
  | { type: 'ADD_QUICK_TASK' };

const initialTemplateTasks: Task[] = [
  { id: 1, name: '朝・夕会関連', elapsedTime: 0, isTemplate: true },
  { id: 2, name: '休憩', elapsedTime: 0, isTemplate: true },
  { id: 3, name: '未分類', elapsedTime: 0, isTemplate: true },
];

const initialState: AppState = {
  tasks: initialTemplateTasks,
  activeTaskId: 1,
  editingTaskId: null,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload, editingTaskId: null };
    case 'START_NEW_DAY':
      const resetTemplateTasks = initialTemplateTasks.map(t => ({ ...t, elapsedTime: 0 }));
      return { ...initialState, tasks: resetTemplateTasks };
    case 'SWITCH_TASK':
      return state.editingTaskId ? state : { ...state, activeTaskId: action.payload };
    case 'TICK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === state.activeTaskId ? { ...task, elapsedTime: task.elapsedTime + 1 } : task
        ),
      };
    case 'START_EDIT':
      return { ...state, editingTaskId: action.payload };
    case 'UPDATE_TASK_NAME':
      return {
        ...state,
        editingTaskId: null,
        tasks: state.tasks.map(task =>
          task.id === action.payload.id ? { ...task, name: action.payload.newName } : task
        ),
      };
    case 'ADD_PLANNED_TASK':
      const newPlannedId = (state.tasks.length > 0 ? Math.max(...state.tasks.map(t => t.id)) : 0) + 1;
      const newPlannedTask: Task = { id: newPlannedId, name: action.payload, elapsedTime: 0, isTemplate: false };
      return { ...state, tasks: [...state.tasks, newPlannedTask] };
    case 'ADD_QUICK_TASK':
      const quickTaskName = `臨時タスク ${state.tasks.filter(t => t.name.startsWith('臨時タスク')).length + 1}`;
      const newQuickId = (state.tasks.length > 0 ? Math.max(...state.tasks.map(t => t.id)) : 0) + 1;
      const newQuickTask: Task = { id: newQuickId, name: quickTaskName, elapsedTime: 0, isTemplate: false };
      return {
        ...state,
        tasks: [...state.tasks, newQuickTask],
        activeTaskId: newQuickId, // タイマーを切り替える
      };
    default:
      return state;
  }
};

const formatTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours.toString().padStart(2, '0'), minutes.toString().padStart(2, '0'), seconds.toString().padStart(2, '0')].join(':');
};

// --- Component ---
export default function HomePage() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');

  useEffect(() => {
    try {
      const savedState = {
        tasks: JSON.parse(localStorage.getItem('tasks') || 'null'),
        activeTaskId: JSON.parse(localStorage.getItem('activeTaskId') || 'null'),
      };
      if (savedState.tasks) {
        dispatch({ type: 'LOAD_STATE', payload: savedState });
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('tasks', JSON.stringify(state.tasks));
    localStorage.setItem('activeTaskId', JSON.stringify(state.activeTaskId));
  }, [state, isLoaded]);

  useEffect(() => {
    if (!isLoaded || state.editingTaskId) return;
    const interval = setInterval(() => dispatch({ type: 'TICK' }), 1000);
    return () => clearInterval(interval);
  }, [isLoaded, state.editingTaskId, state.activeTaskId]);

  const handleUpdateTaskName = (id: number, newName: string) => {
    if (newName.trim() !== '') {
      dispatch({ type: 'UPDATE_TASK_NAME', payload: { id, newName } });
    }
  };

  const handleAddPlannedTask = () => {
    if (newTaskName.trim() !== '') {
      dispatch({ type: 'ADD_PLANNED_TASK', payload: newTaskName });
      setNewTaskName('');
      setIsAdding(false); // フォームを閉じる処理を復活
    }
  };

  if (!isLoaded) {
    return <Container maxWidth="sm"><Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box></Container>;
  }

  const templateTasks = state.tasks.filter(t => t.isTemplate);
  const dailyTasks = state.tasks.filter(t => !t.isTemplate);

  return (
    <Box>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Time Logger
          </Typography>
          <IconButton color="inherit" onClick={() => { if (window.confirm('新しい一日を開始しますか？\n本日追加したタスクはリセットされます。')) dispatch({ type: 'START_NEW_DAY' }); }}>
            <RefreshIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm">
        <Box sx={{ my: 2 }}>
          <Typography variant="subtitle1" color="text.secondary">現在記録中のタスク: {state.tasks.find(t => t.id === state.activeTaskId)?.name}</Typography>
          
          <List>
            {templateTasks.map((task) => (
              <ListItem key={task.id} disablePadding>{
                <ListItemButton selected={task.id === state.activeTaskId} onClick={() => dispatch({ type: 'SWITCH_TASK', payload: task.id })}>
                  <ListItemText primary={task.name} />
                  <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>{formatTime(task.elapsedTime)}</Typography>
                </ListItemButton>
              }</ListItem>
            ))}
          </List>

          {dailyTasks.length > 0 && <Divider sx={{ my: 2 }} />}

          <List>
            {dailyTasks.map((task) => (
              <ListItem key={task.id} disablePadding secondaryAction={
                state.editingTaskId !== task.id && (
                  <IconButton edge="end" aria-label="edit" onClick={() => dispatch({ type: 'START_EDIT', payload: task.id })}><EditIcon /></IconButton>
                )
              }>{
                state.editingTaskId === task.id ? (
                  <TextField defaultValue={task.name} variant="standard" fullWidth autoFocus
                    onBlur={(e) => handleUpdateTaskName(task.id, e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateTaskName(task.id, (e.target as HTMLInputElement).value); }}
                    sx={{ ml: 2 }}
                  />
                ) : (
                  <ListItemButton selected={task.id === state.activeTaskId} onClick={() => dispatch({ type: 'SWITCH_TASK', payload: task.id })}>
                    <ListItemText primary={task.name} />
                    <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>{formatTime(task.elapsedTime)}</Typography>
                  </ListItemButton>
                )
              }</ListItem>
            ))}
          </List>

          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
            {isAdding ? (
              <TextField label="新しいタスク名" variant="standard" fullWidth autoFocus value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddPlannedTask(); }}
                onBlur={() => setIsAdding(false)} // フォーカスが外れたらボタンに戻る
              />
            ) : (
              <>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setIsAdding(true)}>
                  タスクを追加
                </Button>
                <Button variant="outlined" startIcon={<BoltIcon />} onClick={() => dispatch({ type: 'ADD_QUICK_TASK' })} sx={{ ml: 2 }}>
                  割り込み開始
                </Button>
              </>
            )}
          </Box>
        </Box>
      </Container>
    </Box>
  );
}