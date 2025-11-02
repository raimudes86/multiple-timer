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
} from '@mui/material';

// データ構造の定義を更新
interface Task {
  id: number;
  name: string;
  elapsedTime: number; // 経過時間（秒）
}

// 固定のタスクリストを更新
const initialTasks: Task[] = [
  { id: 1, name: '開発', elapsedTime: 0 },
  { id: 2, name: '会議', elapsedTime: 0 },
  { id: 3, name: '休憩', elapsedTime: 0 },
  { id: 4, name: '未分類', elapsedTime: 0 },
];

// 秒数を HH:MM:SS 形式にフォーマットするヘルパー関数
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

  // タイマー機能
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === activeTaskId
            ? { ...task, elapsedTime: task.elapsedTime + 1 }
            : task
        )
      );
    }, 1000);

    // コンポーネントのクリーンアップ時にインターバルをクリア
    return () => clearInterval(interval);
  }, [activeTaskId]); // activeTaskIdが変わるたびにタイマーを再設定

  const handleTaskClick = (taskId: number) => {
    setActiveTaskId(taskId);
  };

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
