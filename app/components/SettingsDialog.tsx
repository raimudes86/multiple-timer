'use client';

import { useState } from 'react';
import {
  Dialog,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  List,
  ListItem,
  ListItemText,
  TextField,
  Button,
  Box,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

// 型定義をpage.tsxから受け取る想定
interface Task {
  id: number;
  name: string;
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  dispatch: (action: any) => void;
}

export default function SettingsDialog({ open, onClose, tasks, dispatch }: SettingsDialogProps) {
  const [importText, setImportText] = useState('');

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    setImportText(text);
  };

  const handleImport = () => {
    const lines = importText.split('\n');
    const prefixes = [':task-todo:', ':task-doing:'];
    let currentParentName: string | null = null;
    const tasksToImport: { name: string; parentName: string | null }[] = [];

    lines.forEach(line => {
      const trimmedLine = line.trim();

      if (trimmedLine === '') return; // Ignore empty lines

      // Check for parent task (line not starting with a colon)
      if (!trimmedLine.startsWith(':')) {
        currentParentName = trimmedLine; // This line is a parent
        tasksToImport.push({ name: currentParentName, parentName: null });
      } else {
        // Check for child task (line starting with :task-todo: or :task-doing:)
        let isChildTask = false;
        for (const prefix of prefixes) {
          if (trimmedLine.startsWith(prefix)) {
            const taskName = trimmedLine.substring(prefix.length).trim();
            if (taskName) {
              tasksToImport.push({ name: taskName, parentName: currentParentName });
            }
            isChildTask = true;
            break;
          }
        }
        // If it's not a recognized child task prefix, ignore it (e.g., :memo:)
        if (!isChildTask) {
          // Optionally, you could log or handle ignored lines here
        }
      }
    });

    if (tasksToImport.length > 0) {
      dispatch({ type: 'IMPORT_TASKS_BATCH', payload: tasksToImport });
    }

    setImportText('');
    onClose();
  };

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <AppBar sx={{ position: 'relative' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            設定
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 2 }}>
        {/* Import from Text */}
        <Typography variant="h6" gutterBottom>テキストからタスクをインポート</Typography>
        <TextField
          label=":task-todo: や :task-doing: で始まるタスクリストを貼り付け"
          multiline
          rows={8}
          fullWidth
          value={importText}
          onPaste={handlePaste}
          onChange={(e) => setImportText(e.target.value)} // この行を追加
          variant="outlined"
          sx={{ mt: 2, "& .MuiInputBase-input": { whiteSpace: "pre-wrap" } }}
        />
        <Button variant="contained" onClick={handleImport} sx={{ mt: 2 }}>
          インポート実行
        </Button>
      </Box>
    </Dialog>
  );
}