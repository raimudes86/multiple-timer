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
  Paper,
  ListItemButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import IosShareIcon from '@mui/icons-material/IosShare';
import MoreVertIcon from '@mui/icons-material/MoreVert'; // Added MoreVertIcon

// --- Copied from page.tsx for preview display ---
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
// --- End copied ---

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

interface TaskToImport {
    name: string;
    parentName: string | null;
}

export default function SettingsDialog({ open, onClose, tasks, dispatch, onExport }: SettingsDialogProps) {
  const [importText, setImportText] = useState('');
  const [previewTasks, setPreviewTasks] = useState<TaskToImport[] | null>(null);

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    setImportText(text);
    setPreviewTasks(null); // テキストが変更されたらプレビューをリセット
  };

  const handlePreview = () => {
    const lines = importText.split('\n');
    const slackPrefixes = [':task-todo:', ':task-doing:'];
    let currentParentName: string | null = null;
    const tasksToImport: TaskToImport[] = [];

    lines.forEach(line => {
      const originalLine = line;
      const trimmedLine = line.trim();

      if (trimmedLine === '') return;

      let taskName = '';
      let isParentCandidate = false;
      let isChildCandidate = false;

      if (originalLine.startsWith('- ') && !originalLine.startsWith('  - ')) {
        taskName = trimmedLine.substring(2).trim();
        isParentCandidate = true;
      } else if (originalLine.startsWith('  - ')) {
        taskName = trimmedLine.substring(2).trim();
        isChildCandidate = true;
      } else if (slackPrefixes.some(prefix => trimmedLine.startsWith(prefix))) {
        for (const prefix of slackPrefixes) {
          if (trimmedLine.startsWith(prefix)) {
            taskName = trimmedLine.substring(prefix.length).trim();
            isChildCandidate = true;
            break;
          }
        }
      } else if (!trimmedLine.startsWith(':')) {
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

    setPreviewTasks(tasksToImport);
  };

  const handleConfirmImport = () => {
    if (previewTasks && previewTasks.length > 0) {
      dispatch({ type: 'IMPORT_TASKS_BATCH', payload: previewTasks });
    }
    setImportText('');
    setPreviewTasks(null);
    onClose();
  };

  const handleCancelPreview = () => {
      setPreviewTasks(null);
  }

  const renderPreview = () => {
      if (!previewTasks) return null;

      const taskTree: (TaskToImport & { children: TaskToImport[] })[] = [];
      const taskMap = new Map<string, TaskToImport & { children: TaskToImport[] }>();

      previewTasks.forEach(task => {
          if(task.parentName === null) {
              const newNode = { ...task, children: [] };
              taskTree.push(newNode);
              taskMap.set(task.name, newNode);
          }
      });
      previewTasks.forEach(task => {
          if(task.parentName !== null) {
              const parent = taskMap.get(task.parentName);
              if(parent) {
                  parent.children.push(task);
              }
          }
      });

      // Recursive helper to render tasks in the preview
      const renderPreviewTask = (item: TaskToImport & { children: TaskToImport[] }, level: number) => {
        const isTopLevel = item.parentName === null;
        const isGrouping = item.children.length > 0; // In preview, if it has children, it's a grouping
        const isDisabled = true; // All preview items are disabled

        const hasChildrenAndIsObject = item.children && item.children.length > 0;
        
        const renderChildren = hasChildrenAndIsObject ? (
          <List disablePadding>
            {item.children.map((child, childIndex) =>
              renderPreviewTask({ ...child, children: [] }, level + 1) // Pass children as empty for child tasks
            )}
          </List>
        ) : null;

        return isTopLevel ? (
          <Paper key={item.name} elevation={2} sx={{ mb: 2, p: 1 }}>
            {isGrouping ? (
              <ListItem disablePadding secondaryAction={<IconButton edge="end" disabled><MoreVertIcon /></IconButton>}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography component="span" variant="h6" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                        {item.name}
                      </Typography>
                      <Typography component="span" variant="body1" sx={{ fontFamily: 'monospace', ml: 1, color: 'text.secondary' }}>
                        計 {formatMinutes(0)}
                      </Typography>
                    </Box>
                  }
                  primaryTypographyProps={{ sx: { pl: isTopLevel ? 2 : level * 2 } }}
                />
              </ListItem>
            ) : ( // Top-level task (not grouping)
              <ListItem disablePadding secondaryAction={<IconButton edge="end" disabled><MoreVertIcon /></IconButton>}>
                <ListItemButton disabled={isDisabled} sx={{ pl: isTopLevel ? 2 : level * 2 }}>
                  <ListItemText primary={item.name} primaryTypographyProps={{ fontWeight: 'normal' }} />
                  <Box sx={{ minWidth: '80px', textAlign: 'right' }}>
                    <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                      {formatTime(0)}
                    </Typography>
                  </Box>
                </ListItemButton>
              </ListItem>
            )}
            {renderChildren}
          </Paper>
        ) : ( // Nested task
          <Box key={item.name} sx={{ mb: 0 }}>
            {isGrouping ? ( // Nested grouping (shouldn't happen with current parsing, but for completeness)
              <ListItem disablePadding secondaryAction={<IconButton edge="end" disabled><MoreVertIcon /></IconButton>}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography component="span" variant="h6" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                        {item.name}
                      </Typography>
                      <Typography component="span" variant="body1" sx={{ fontFamily: 'monospace', ml: 1, color: 'text.secondary' }}>
                        計 {formatMinutes(0)}
                      </Typography>
                    </Box>
                  }
                  primaryTypographyProps={{ sx: { pl: isTopLevel ? 2 : level * 2 } }}
                />
              </ListItem>
            ) : ( // Nested task
              <ListItem disablePadding secondaryAction={<IconButton edge="end" disabled><MoreVertIcon /></IconButton>}>
                <ListItemButton disabled={isDisabled} sx={{ pl: (level + 1) * 4 }}> {/* Increased indentation for child tasks */}
                  <ListItemText primary={item.name} primaryTypographyProps={{ fontWeight: 'normal' }} />
                  <Box sx={{ minWidth: '80px', textAlign: 'right' }}>
                    <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                      {formatTime(0)}
                    </Typography>
                  </Box>
                </ListItemButton>
              </ListItem>
            )}
            {renderChildren}
          </Box>
        );
      };

      return (
          <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>インポート内容のプレビュー</Typography>
              <Paper variant="outlined" sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
                  <List dense>
                      {taskTree.map(task => renderPreviewTask(task, 0))}
                  </List>
              </Paper>
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                  <Button variant="contained" color="primary" onClick={handleConfirmImport}>
                      この内容でインポート
                  </Button>
                  <Button variant="outlined" onClick={handleCancelPreview}>
                      キャンセル
                  </Button>
              </Box>
          </Box>
      )
  }

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
        <Typography variant="h6" gutterBottom>テキストからタスクをインポート</Typography>
        <TextField
          label=":task-todo: や - で始まるタスクリストを貼り付け"
          multiline
          rows={8}
          fullWidth
          value={importText}
          onPaste={handlePaste}
          onChange={(e) => {
              setImportText(e.target.value);
              setPreviewTasks(null);
          }}
          variant="outlined"
          sx={{ mt: 2, "& .MuiInputBase-input": { whiteSpace: "pre-wrap" } }}
          disabled={!!previewTasks}
        />
        {!previewTasks ? (
            <Button variant="contained" onClick={handlePreview} sx={{ mt: 2 }} disabled={!importText.trim()}>
                プレビュー表示
            </Button>
        ) : (
            renderPreview()
        )}
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