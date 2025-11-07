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
import IosShareIcon from '@mui/icons-material/IosShare';

// 型定義をpage.tsxから受け取る想定
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

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  tasks: AppItem[];
  dispatch: (action: any) => void;
  onExport: () => void;
}

export default function SettingsDialog({ open, onClose, tasks, dispatch, onExport }: SettingsDialogProps) {
  const [importText, setImportText] = useState('');

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    setImportText(text);
  };

  const handleImport = () => {
    const lines = importText.split('\n');
    const slackPrefixes = [':task-todo:', ':task-doing:'];
    let currentParentName: string | null = null;
    const tasksToImport: { name: string; parentName: string | null }[] = [];

    lines.forEach(line => {
      const originalLine = line; // Keep original line to check leading spaces
      const trimmedLine = line.trim();

      if (trimmedLine === '') return; // Ignore empty lines

      let taskName = '';
      let isParentCandidate = false;
      let isChildCandidate = false;

      // Check for bullet parent: "- Parent"
      if (originalLine.startsWith('- ') && !originalLine.startsWith('  - ')) {
        taskName = trimmedLine.substring(2).trim(); // Remove "- "
        isParentCandidate = true;
      }
      // Check for bullet child: "  - Child"
      else if (originalLine.startsWith('  - ')) {
        taskName = trimmedLine.substring(2).trim(); // Remove "  - "
        isChildCandidate = true;
      }
      // Check for Slack child: ":task-todo: Child" or ":task-doing: Child"
      else if (slackPrefixes.some(prefix => trimmedLine.startsWith(prefix))) {
        for (const prefix of slackPrefixes) {
          if (trimmedLine.startsWith(prefix)) {
            taskName = trimmedLine.substring(prefix.length).trim();
            isChildCandidate = true;
            break;
          }
        }
      }
      // Check for plain parent: "Parent Task" (not starting with : or bullet)
      else if (!trimmedLine.startsWith(':')) {
        taskName = trimmedLine;
        isParentCandidate = true;
      }

      if (taskName) {
        if (isParentCandidate) {
          currentParentName = taskName;
          tasksToImport.push({ name: taskName, parentName: null });
        } else if (isChildCandidate && currentParentName !== null) {
          tasksToImport.push({ name: taskName, parentName: currentParentName });
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
          onChange={(e) => setImportText(e.target.value)}
          variant="outlined"
          sx={{ mt: 2, "& .MuiInputBase-input": { whiteSpace: "pre-wrap" } }}
        />
        <Button variant="contained" onClick={handleImport} sx={{ mt: 2 }}>
          インポート実行
        </Button>
      </Box>

      <Divider sx={{ my: 4 }} />

      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>結果をエクスポート</Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          今日記録したすべてのタスクと時間をテキスト形式で出力します。
        </Typography>
        <Button variant="contained" color="secondary" onClick={onExport} startIcon={<IosShareIcon />}>
          今日の結果をエクスポート
        </Button>
      </Box>
    </Dialog>
  );
}