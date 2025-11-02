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
} from '@mui/material';

// 1. State and Action Definitions
interface Task {
  id: number;
  name: string;
  elapsedTime: number;
}

interface AppState {
  tasks: Task[];
  activeTaskId: number;
}

type AppAction =
  | { type: 'LOAD_STATE'; payload: Partial<AppState> }
  | { type: 'SWITCH_TASK'; payload: number }
  | { type: 'TICK' };

// 2. Initial State
const initialState: AppState = {
  tasks: [
    { id: 1, name: '開発', elapsedTime: 0 },
    { id: 2, name: '会議', elapsedTime: 0 },
    { id: 3, name: '休憩', elapsedTime: 0 },
    { id: 4, name: '未分類', elapsedTime: 0 },
  ],
  activeTaskId: 4,
};

// 3. Reducer Function: All state logic is centralized here
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'LOAD_STATE':
      return { ...state, ...action.payload };
    case 'SWITCH_TASK':
      return { ...state, activeTaskId: action.payload };
    case 'TICK':
      return {
        ...state,
        tasks: state.tasks.map(task =>
          task.id === state.activeTaskId
            ? { ...task, elapsedTime: task.elapsedTime + 1 }
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

  // Load from localStorage on mount
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

  // Save to localStorage on state change
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('tasks', JSON.stringify(state.tasks));
    localStorage.setItem('activeTaskId', JSON.stringify(state.activeTaskId));
  }, [state, isLoaded]);

  // Timer tick
  useEffect(() => {
    if (!isLoaded) return;
    const interval = setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoaded]);

  // Loading screen to prevent hydration errors
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
            <ListItem key={task.id} disablePadding>
              <ListItemButton
                selected={task.id === state.activeTaskId}
                onClick={() => dispatch({ type: 'SWITCH_TASK', payload: task.id })}
              >
                <ListItemText primary={task.name} />
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {formatTime(task.elapsedTime)}
                </Typography>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Container>
  );
}