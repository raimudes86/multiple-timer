'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Box,
  CircularProgress, // ローディング表示用
} from '@mui/material';

interface Task {
  id: number;
  name: string;
  elapsedTime: number;
}

const initialTasks: Task[] = [
  { id: 1, name: '開発', elapsedTime: 0 },
  { id: 2, name: '会議', elapsedTime: 0 },
  { id: 3, name: '休憩', elapsedTime: 0 },
  { id: 4, name: '未分類', elapsedTime: 0 },
];

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
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTaskId, setActiveTaskId] = useState<number>(4);
  const [isLoaded, setIsLoaded] = useState(false);

  // localStorageからデータを読み込むEffect
  useEffect(() => {
    try {
      const savedTasks = localStorage.getItem('tasks');
      const savedActiveTaskId = localStorage.getItem('activeTaskId');

      if (savedTasks) {
        setTasks(JSON.parse(savedTasks));
      }
      if (savedActiveTaskId) {
        setActiveTaskId(JSON.parse(savedActiveTaskId));
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }
    setIsLoaded(true);
  }, []);

  // localStorageにデータを保存するEffect
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem('tasks', JSON.stringify(tasks));
    localStorage.setItem('activeTaskId', JSON.stringify(activeTaskId));
  }, [tasks, activeTaskId, isLoaded]);

  // タイマー機能のEffect
  useEffect(() => {
    if (!isLoaded) return;
    const interval = setInterval(() => {
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === activeTaskId
            ? { ...task, elapsedTime: task.elapsedTime + 1 }
            : task
        )
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTaskId, isLoaded]);

  const handleTaskClick = (taskId: number) => {
    setActiveTaskId(taskId);
  };

  // 読み込みが完了するまでローディング画面を表示
  if (!isLoaded) {
    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            my: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '80vh',
          }}
        >
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Loading...</Typography>
        </Box>
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
          現在記録中のタスク: {tasks.find(t => t.id === activeTaskId)?.name}
        </Typography>
        <List>
          {tasks.map((task) => (
            <ListItem key={task.id} disablePadding>
              <ListItemButton
                selected={task.id === activeTaskId}
                onClick={() => handleTaskClick(task.id)}
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