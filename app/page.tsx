'use client';

import { useState, useEffect, useReducer } from 'react';
import {
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
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';

// 1. State and Action Definitions
interface Task {
  id: number;
  name: string;
  elapsedTime: number;
}

interface AppState {
  tasks: Task[];
  activeTaskId: number;
  editingTaskId: number | null; // 編集中のタスクID (nullの場合は編集モードでない)
}

type AppAction =
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'SWITCH_TASK'; payload: number }
  | { type: 'TICK' }
  | { type: 'START_EDIT'; payload: number }
  | { type: 'UPDATE_TASK_NAME'; payload: { id: number; newName: string } };

// 2. Initial State
const initialState: AppState = {
  tasks: [
    { id: 1, name: '開発', elapsedTime: 0 },
    { id: 2, name: '会議', elapsedTime: 0 },
    { id: 3, name: '休憩', elapsedTime: 0 },
    { id: 4, name: '未分類', elapsedTime: 0 },
  ],
  activeTaskId: 4,
  editingTaskId: null,
};

// 3. Reducer Function
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload, editingTaskId: null }; // 読み込み時は編集モードを解除
    case 'SWITCH_TASK':
      // 編集中はタスク切り替えを許可しない
      return state.editingTaskId ? state : { ...state, activeTaskId: action.payload };
    case 'TICK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === state.activeTaskId
            ? { ...task, elapsedTime: task.elapsedTime + 1 }
            : task
        ),
      };
    case 'START_EDIT':
      return { ...state, editingTaskId: action.payload };
    case 'UPDATE_TASK_NAME':
      return {
        ...state,
        editingTaskId: null, // 編集モードを終了
        tasks: state.tasks.map(task =>
          task.id === action.payload.id
            ? { ...task, name: action.payload.newName }
            : task
        ),
      };
    default:
      return state;
  }
};

const formatTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0'),
  ].join(':');
};

export default function HomePage() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem('tasks');
      const savedActiveTaskId = localStorage.getItem('activeTaskId');
      const payload: Partial<AppState> = {};
      if (savedTasks) payload.tasks = JSON.parse(savedTasks);
      if (savedActiveTaskId) payload.activeTaskId = JSON.parse(savedActiveTaskId);
      if (Object.keys(payload).length > 0) {
        dispatch({ type: 'LOAD_STATE', payload });
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
    if (!isLoaded || state.editingTaskId) return; // 編集中はタイマーを止める
    const interval = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoaded, state.editingTaskId]);

  const handleUpdateTaskName = (id: number, newName: string) => {
    if (newName.trim() !== '') {
      dispatch({ type: 'UPDATE_TASK_NAME', payload: { id, newName } });
    }
  };

  if (!isLoaded) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}><CircularProgress /></Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Time Logger
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          現在記録中のタスク: {state.tasks.find(t => t.id === state.activeTaskId)?.name}
        </Typography>
        <List>
          {state.tasks.map((task) => (
            <ListItem key={task.id} disablePadding secondaryAction={
              state.editingTaskId !== task.id && (
                <IconButton edge="end" aria-label="edit" onClick={() => dispatch({ type: 'START_EDIT', payload: task.id })}>
                  <EditIcon />
                </IconButton>
              )
            }>{
              state.editingTaskId === task.id ? (
                <TextField
                  defaultValue={task.name}
                  variant="standard"
                  fullWidth
                  autoFocus
                  onBlur={(e) => handleUpdateTaskName(task.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateTaskName(task.id, (e.target as HTMLInputElement).value);
                    }
                  }}
                  sx={{ ml: 2 }}
                />
              ) : (
                <ListItemButton
                  selected={task.id === state.activeTaskId}
                  onClick={() => dispatch({ type: 'SWITCH_TASK', payload: task.id })}
                >
                  <ListItemText primary={task.name} />
                  <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                    {formatTime(task.elapsedTime)}
                  </Typography>
                </ListItemButton>
              )
            }</ListItem>
          ))}
        </List>
      </Box>
    </Container>
  );
}
