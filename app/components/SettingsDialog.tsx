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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

// 型定義をpage.tsxから受け取る
interface Task {
  id: number;
  name: string;
  isTemplate: boolean;
}

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  dispatch: (action: any) => void;
}

export default function SettingsDialog({ open, onClose, tasks, dispatch }: SettingsDialogProps) {
  const templateTasks = tasks.filter(t => t.isTemplate);

  const [newTemplateName, setNewTemplateName] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<Task | null>(null);

  const handleAddTemplate = () => {
    if (newTemplateName.trim() !== '') {
      dispatch({ type: 'ADD_TEMPLATE_TASK', payload: newTemplateName });
      setNewTemplateName('');
    }
  };

  const handleUpdateTemplate = () => {
    if (editingTemplate && editingTemplate.name.trim() !== '') {
      dispatch({ type: 'UPDATE_TEMPLATE_TASK', payload: { id: editingTemplate.id, newName: editingTemplate.name } });
      setEditingTemplate(null);
    }
  };

  const handleDeleteTemplate = (id: number) => {
    if (window.confirm('このテンプレートを削除しますか？')) {
      dispatch({ type: 'DELETE_TEMPLATE_TASK', payload: id });
    }
  };

  return (
    <Dialog fullScreen open={open} onClose={onClose}>
      <AppBar sx={{ position: 'relative' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
          <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
            テンプレートタスクの管理
          </Typography>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: 2 }}>
        <List>
          {templateTasks.map(task => (
            <ListItem key={task.id} secondaryAction={
              editingTemplate?.id !== task.id && (
                <>
                  <IconButton edge="end" onClick={() => setEditingTemplate(task)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton edge="end" onClick={() => handleDeleteTemplate(task.id)}>
                    <DeleteIcon />
                  </IconButton>
                </>
              )
            }>
              {editingTemplate?.id === task.id ? (
                <TextField
                  variant="standard"
                  fullWidth
                  autoFocus
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateTemplate(); }}
                  onBlur={handleUpdateTemplate}
                />
              ) : (
                <ListItemText primary={task.name} />
              )}
            </ListItem>
          ))}
        </List>
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'flex-end' }}>
          <TextField
            label="新しいテンプレート名"
            variant="standard"
            fullWidth
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTemplate(); }}
          />
          <Button startIcon={<AddIcon />} onClick={handleAddTemplate} sx={{ ml: 2 }}>
            追加
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
}
