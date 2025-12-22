import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Search,
  Calendar,
  User,
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Flag,
  Inbox,
  GripVertical,
  LayoutGrid,
  List,
  CalendarIcon,
  X,
  Tag,
  ChevronsUp,
  ChevronsDown,
  Minus,
  Ban,
  AlertTriangle
} from 'lucide-react';
import { format, differenceInDays, isToday, isPast, startOfDay } from 'date-fns';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import toast, { Toaster } from 'react-hot-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTaskNotifications, cleanupTaskNotifications } from '../services/notificationService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TutorialTooltip from '../components/TutorialTooltip';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';

// Sortable Task Item Wrapper
const SortableTaskItem = ({ task, isSelected, onToggleSelect, bulkMode, ...props }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className="relative group">
      {bulkMode && (
        <div className="absolute top-4 left-4 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(task.id)}
            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <div className={bulkMode ? 'ml-12' : ''} {...(!bulkMode && listeners)}>
        {props.children}
      </div>
    </div>
  );
};

export default function Tasks() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('today'); // 'inbox', 'today', 'upcoming', 'completed'
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterLabel, setFilterLabel] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [lastCompletedTask, setLastCompletedTask] = useState(null);
  const queryClient = useQueryClient();
  const { isPWA, isMobile, isNativeApp, isDesktop } = useDeviceDetection();
  
  // Detect if running on Mac
  const isMac = typeof window !== 'undefined' && 
    (navigator.platform.toUpperCase().indexOf('MAC') >= 0 || 
     navigator.userAgent.toUpperCase().indexOf('MAC') >= 0);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-due_date')
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list()
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list()
  });

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return user;
    }
  });

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigned_to: '',
    due_date: '',
    due_time: '',
    priority: 'normal',
    status: 'todo',
    category: 'other',
    related_account_id: '',
    related_contact_id: '',
    estimated_time: 30,
    labels: [],
    subtasks: []
  });
  const [newLabelInput, setNewLabelInput] = useState('');

  const resetTaskForm = () => {
    setNewTask({
      title: '',
      description: '',
      assigned_to: '',
      due_date: '',
      due_time: '',
      priority: 'normal',
      status: 'todo',
      category: 'other',
      related_account_id: '',
      related_contact_id: '',
      estimated_time: 30,
      labels: [],
      subtasks: []
    });
    setNewLabelInput('');
  };

  const createTaskMutation = useMutation({
    mutationFn: async (data) => {
      const task = await base44.entities.Task.create(data);
      // Create notifications for task reminders
      if (task.due_date) {
        await createTaskNotifications(task);
      }
      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setIsDialogOpen(false);
      setEditingTask(null);
      resetTaskForm();
      toast.success('Task created successfully');
    },
    onError: (error) => {
      console.error('Error creating task:', error);
      toast.error(error.message || 'Failed to create task');
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const task = await base44.entities.Task.update(id, data);
      const updatedTask = { ...task, ...data };
      
      // Update notifications based on task status
      if (updatedTask.status === 'completed') {
        await cleanupTaskNotifications(id);
      } else if (updatedTask.due_date) {
        await createTaskNotifications(updatedTask);
      }
      
      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setIsDialogOpen(false);
      setEditingTask(null);
      resetTaskForm();
    },
    onError: (error) => {
      console.error('Error updating task:', error);
      toast.error(error.message || 'Failed to update task');
    }
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + K: Quick add task
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsDialogOpen(true);
        setEditingTask(null);
      }
      // Escape: Close dialogs and exit bulk mode
      if (e.key === 'Escape') {
        setIsDialogOpen(false);
        setBulkActionMode(false);
        setSelectedTasks([]);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Toggle task selection
  const toggleTaskSelection = (taskId) => {
    setSelectedTasks(prev => 
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  // Select all tasks
  const selectAllTasks = () => {
    setSelectedTasks(filteredTasks.map(t => t.id));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTasks([]);
    setBulkActionMode(false);
  };

  // Bulk complete tasks
  const bulkCompleteTasks = async () => {
    try {
      await Promise.all(
        selectedTasks.map(taskId => 
          updateTaskMutation.mutate({
            id: taskId,
            data: { status: 'completed', completed_date: new Date().toISOString() }
          })
        )
      );
      toast.success(`✓ Completed ${selectedTasks.length} tasks`);
      clearSelection();
    } catch (error) {
      console.error('Error bulk completing tasks:', error);
      toast.error('Failed to complete tasks');
    }
  };

  // Handle drag end
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = filteredTasks.findIndex(task => task.id === active.id);
    const newIndex = filteredTasks.findIndex(task => task.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(filteredTasks, oldIndex, newIndex);
    
    // Save order to database
    try {
      await Promise.all(
        newOrder.map((task, index) => 
          updateTaskMutation.mutate({
            id: task.id,
            data: { order: index }
          })
        )
      );
    } catch (error) {
      console.error('Error saving task order:', error);
    }
  };

  const handleCreateOrUpdate = async () => {
    const user = await base44.auth.me();
    const taskData = {
      ...newTask,
      assigned_to: newTask.assigned_to || user.email
    };
    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data: taskData });
    } else {
      createTaskMutation.mutate(taskData);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId);
    const completedDate = newStatus === 'completed' ? new Date().toISOString() : null;
    
    // Clean up notifications if task is completed
    if (newStatus === 'completed') {
      await cleanupTaskNotifications(taskId);
    }
    
    updateTaskMutation.mutate({
      id: taskId,
      data: { status: newStatus, completed_date: completedDate }
    });

    // Show toast notification when completing a task
    if (newStatus === 'completed') {
      setLastCompletedTask({ id: taskId, title: task?.title });
      toast.success('✓ Task completed', {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: () => {
            updateTaskMutation.mutate({
              id: taskId,
              data: { status: 'todo', completed_date: null }
            });
            setLastCompletedTask(null);
          }
        }
      });
      
      setTimeout(() => {
        setLastCompletedTask(null);
      }, 5000);
    }
  };

  const openEditDialog = (task) => {
    setEditingTask(task);
    setNewTask({
      title: task.title || '',
      description: task.description || '',
      assigned_to: task.assigned_to || '',
      due_date: task.due_date || '',
      due_time: task.due_time || '',
      priority: task.priority || 'normal',
      status: task.status || 'todo',
      category: task.category || 'other',
      related_account_id: task.related_account_id || '',
      related_contact_id: task.related_contact_id || '',
      estimated_time: task.estimated_time || 30,
      labels: task.labels || [],
      subtasks: task.subtasks || []
    });
    setNewLabelInput('');
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTask(null);
    resetTaskForm();
  };

  const addLabel = () => {
    const label = newLabelInput.trim();
    if (label && !newTask.labels.includes(label)) {
      setNewTask({ ...newTask, labels: [...newTask.labels, label] });
      setNewLabelInput('');
    }
  };

  const removeLabel = (labelToRemove) => {
    setNewTask({ ...newTask, labels: newTask.labels.filter(l => l !== labelToRemove) });
  };

  // Get all unique labels from existing tasks for suggestions
  const getAllLabels = () => {
    const allLabels = new Set();
    tasks.forEach(task => {
      if (task.labels && Array.isArray(task.labels)) {
        task.labels.forEach(label => allLabels.add(label));
      }
    });
    return Array.from(allLabels).sort();
  };

  // Helper functions for date filtering
  const parseLocalDate = (dateString) => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const isTaskToday = (task) => {
    if (!task.due_date) return false;
    const taskDate = parseLocalDate(task.due_date);
    return isToday(taskDate);
  };

  const isTaskOverdue = (task) => {
    if (!task.due_date || task.status === 'completed') return false;
    const taskDate = parseLocalDate(task.due_date);
    return isPast(startOfDay(taskDate)) && !isToday(taskDate);
  };

  const isTaskUpcoming = (task) => {
    if (!task.due_date) return false;
    const taskDate = parseLocalDate(task.due_date);
    const today = startOfDay(new Date());
    return taskDate > today && !isTaskToday(task) && !isTaskOverdue(task);
  };

  // Filter tasks based on active filter
  let filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = filterPriority === 'all' || task.priority === filterPriority;
    const matchesLabel = filterLabel === 'all' || (task.labels && Array.isArray(task.labels) && task.labels.includes(filterLabel));
    
    if (!matchesSearch || !matchesPriority || !matchesLabel) return false;

    // Apply tab filter
    switch (activeFilter) {
      case 'inbox':
        return task.status !== 'completed' && !task.due_date && task.assigned_to === currentUser?.email;
      case 'today':
        return task.status !== 'completed' && (isTaskToday(task) || isTaskOverdue(task));
      case 'upcoming':
        return task.status !== 'completed' && isTaskUpcoming(task);
      case 'completed':
        return task.status === 'completed';
      default:
        return true;
    }
  });

  // Sort tasks: order field first, then by priority, then by due date
  filteredTasks.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    const priorityOrder = { critical: 6, blocker: 5, major: 4, normal: 3, minor: 2, trivial: 1 };
    const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    if (priorityDiff !== 0) return priorityDiff;
    
    if (a.due_date && b.due_date) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });

  const getPriorityFlag = (priority) => {
    const flags = {
      critical: { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', borderColorValue: '#fecaca', icon: AlertTriangle },
      blocker: { label: 'Blocker', color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300', borderColorValue: '#fca5a5', icon: Ban },
      major: { label: 'Major', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', borderColorValue: '#fed7aa', icon: ChevronsUp },
      normal: { label: 'Normal', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', borderColorValue: '#bfdbfe', icon: Minus },
      minor: { label: 'Minor', color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200', borderColorValue: '#e2e8f0', icon: ChevronsDown },
      trivial: { label: 'Trivial', color: 'text-gray-500', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', borderColorValue: '#e5e7eb', icon: Circle }
    };
    return flags[priority] || flags.normal;
  };

  const cyclePriority = (currentPriority) => {
    // Cycle in de-escalating order: critical → blocker → major → normal → minor → trivial → critical
    const priorityOrder = ['critical', 'blocker', 'major', 'normal', 'minor', 'trivial'];
    const currentIndex = priorityOrder.indexOf(currentPriority || 'normal');
    const nextIndex = (currentIndex + 1) % priorityOrder.length;
    return priorityOrder[nextIndex];
  };

  const handlePriorityClick = (taskId, currentPriority, e) => {
    e.stopPropagation(); // Prevent opening the edit dialog
    const newPriority = cyclePriority(currentPriority);
    
    // Update priority
    updateTaskMutation.mutate({
      id: taskId,
      data: { priority: newPriority }
    }, {
      onSuccess: () => {
        // After priority is updated, recalculate order based on priority sorting
        // Use setTimeout to ensure the query has been invalidated and refetched
        setTimeout(() => {
          const updatedTasks = queryClient.getQueryData(['tasks']) || tasks;
          if (!updatedTasks || updatedTasks.length === 0) return;
          
          const priorityOrder = { critical: 6, blocker: 5, major: 4, normal: 3, minor: 2, trivial: 1 };
          
          // Sort by priority, then due date (same logic as filteredTasks sorting)
          const sortedTasks = [...updatedTasks].sort((a, b) => {
            const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
            if (priorityDiff !== 0) return priorityDiff;
            
            if (a.due_date && b.due_date) {
              return new Date(a.due_date) - new Date(b.due_date);
            }
            if (a.due_date) return -1;
            if (b.due_date) return 1;
            return 0;
          });
          
          // Update order for all tasks based on their new sorted position
          sortedTasks.forEach((task, index) => {
            if (task.order !== index) {
              updateTaskMutation.mutate({
                id: task.id,
                data: { order: index }
              });
            }
          });
        }, 200);
      }
    });
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-200',
      blocker: 'bg-red-200 text-red-900 border-red-300',
      major: 'bg-orange-100 text-orange-800 border-orange-200',
      normal: 'bg-blue-100 text-blue-800 border-blue-200',
      minor: 'bg-slate-100 text-slate-700 border-slate-200',
      trivial: 'bg-gray-100 text-gray-600 border-gray-200'
    };
    return colors[priority] || colors.normal;
  };

  const getStatusIcon = (status) => {
    const icons = {
      todo: Circle,
      in_progress: Clock,
      blocked: AlertCircle,
      completed: CheckCircle2
    };
    return icons[status] || Circle;
  };

  const getStatusColor = (status) => {
    const colors = {
      todo: 'text-slate-400',
      in_progress: 'text-blue-500',
      blocked: 'text-red-500',
      completed: 'text-emerald-500'
    };
    return colors[status] || colors.todo;
  };

  const getAccountName = (accountId) => {
    const account = accounts.find(a => a.id === accountId);
    return account?.name;
  };

  // Get task counts for tabs
  const getTaskCounts = () => {
    const inbox = tasks.filter(task => task.status !== 'completed' && !task.due_date && task.assigned_to === currentUser?.email).length;
    const today = tasks.filter(task => 
      task.status !== 'completed' && (isTaskToday(task) || isTaskOverdue(task))
    ).length;
    const upcoming = tasks.filter(task => task.status !== 'completed' && isTaskUpcoming(task)).length;
    const completed = tasks.filter(task => task.status === 'completed').length;
    
    return { inbox, today, upcoming, completed };
  };

  const counts = getTaskCounts();

  return (
    <div className="space-y-6">
      <Toaster position="bottom-left" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <TutorialTooltip
          tip="This is your Tasks page. Manage all your follow-ups and action items here. Create tasks, set priorities and due dates, and track their status. Press ⌘K to quickly add a task."
          step={6}
          position="bottom"
        >
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Tasks</h1>
            <p className="text-slate-600 mt-1">
              {filteredTasks.length} {activeFilter === 'today' ? 'tasks today' : 
               activeFilter === 'inbox' ? 'tasks in inbox' :
               activeFilter === 'upcoming' ? 'upcoming tasks' :
               activeFilter === 'completed' ? 'completed tasks' : 'tasks'}
              {!isMobile && isDesktop && (
                <span className="ml-3 text-xs text-slate-400">
                  Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-600">
                    {isMac ? '⌘K' : 'Ctrl K'}
                  </kbd> to quick add
                </span>
              )}
            </p>
          </div>
        </TutorialTooltip>
        <TutorialTooltip
          tip="Click this button to create a new task. Tasks help you track follow-ups, meetings, and other action items related to your accounts and contacts."
          step={6}
          position="bottom"
        >
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800" onClick={() => setEditingTask(null)}>
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Task Title *</Label>
                  <Input
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Follow up with client..."
                  />
                </div>
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Task details..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={newTask.priority}
                    onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="item-aligned">
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="blocker">Blocker</SelectItem>
                      <SelectItem value="major">Major</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="minor">Minor</SelectItem>
                      <SelectItem value="trivial">Trivial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={newTask.status}
                    onValueChange={(value) => setNewTask({ ...newTask, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={newTask.category}
                    onValueChange={(value) => setNewTask({ ...newTask, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                      <SelectItem value="support">Support</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Due Time (optional)</Label>
                  <Input
                    type="time"
                    value={newTask.due_time}
                    onChange={(e) => setNewTask({ ...newTask, due_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Estimated Time (minutes)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newTask.estimated_time}
                    onChange={(e) => setNewTask({ ...newTask, estimated_time: parseInt(e.target.value) || 30 })}
                    placeholder="30"
                  />
                </div>
                <div>
                  <Label>Assigned To (email)</Label>
                  <Input
                    value={newTask.assigned_to}
                    onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                    placeholder="team@company.com"
                  />
                </div>
                <div>
                  <Label>Related Account</Label>
                  <Select
                    value={newTask.related_account_id}
                    onValueChange={(value) => setNewTask({ ...newTask, related_account_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Labels</Label>
                  <div className="space-y-2">
                    {/* Existing labels */}
                    {newTask.labels.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {newTask.labels.map((label, idx) => (
                          <Badge 
                            key={idx} 
                            variant="outline" 
                            className="text-purple-700 bg-purple-50 border-purple-200 flex items-center gap-1 pr-1"
                          >
                            <Tag className="w-3 h-3" />
                            {label}
                            <button
                              type="button"
                              onClick={() => removeLabel(label)}
                              className="ml-1 hover:bg-purple-200 rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    {/* Add new label */}
                    <div className="flex gap-2">
                      <Input
                        value={newLabelInput}
                        onChange={(e) => setNewLabelInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addLabel();
                          }
                        }}
                        placeholder="Add a label (press Enter)"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addLabel}
                        disabled={!newLabelInput.trim() || newTask.labels.includes(newLabelInput.trim())}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    {/* Suggested labels */}
                    {getAllLabels().length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-slate-500 mr-2">Suggestions:</span>
                        {getAllLabels()
                          .filter(label => !newTask.labels.includes(label))
                          .slice(0, 5)
                          .map((label, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setNewTask({ ...newTask, labels: [...newTask.labels, label] });
                              }}
                              className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                            >
                              {label}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={closeDialog}>
                  Cancel
                </Button>
                <Button onClick={handleCreateOrUpdate} disabled={!newTask.title}>
                  {editingTask ? 'Update Task' : 'Create Task'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </TutorialTooltip>
      </div>

      {/* Tabs and Filters */}
      <TutorialTooltip
        tip="Use tabs to filter tasks: Inbox (no due date), Today (due today or overdue), Upcoming (future dates), and Completed. Use the search and priority filter to narrow down further."
        step={6}
        position="bottom"
      >
        <div className="space-y-4">
          <Tabs value={activeFilter} onValueChange={setActiveFilter}>
            <div 
              className="overflow-x-auto -mx-4 px-4"
              style={(isPWA || isMobile || isNativeApp) ? {
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-x',
                overscrollBehaviorX: 'contain',
                overscrollBehaviorY: 'none'
              } : {}}
            >
              <TabsList className="bg-white/80 backdrop-blur-sm inline-flex w-auto flex-nowrap justify-start">
              <TabsTrigger value="inbox" className="flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                Inbox ({counts.inbox})
              </TabsTrigger>
              <TabsTrigger value="today" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Today ({counts.today})
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Upcoming ({counts.upcoming})
              </TabsTrigger>
              <TabsTrigger value="completed" className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Completed ({counts.completed})
              </TabsTrigger>
            </TabsList>
            </div>
          </Tabs>

          <Card className="p-4">
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="flex-1 relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search tasks..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-3 items-center">
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Priority">
                      {filterPriority === 'all' ? 'All Priorities' :
                       filterPriority === 'critical' ? 'Critical' :
                       filterPriority === 'blocker' ? 'Blocker' :
                       filterPriority === 'major' ? 'Major' :
                       filterPriority === 'normal' ? 'Normal' :
                       filterPriority === 'minor' ? 'Minor' :
                       filterPriority === 'trivial' ? 'Trivial' : 'Priority'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="blocker">Blocker</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="trivial">Trivial</SelectItem>
                  </SelectContent>
                </Select>
                {getAllLabels().length > 0 && (
                  <Select value={filterLabel} onValueChange={setFilterLabel}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Labels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Labels</SelectItem>
                      {getAllLabels().map((label) => (
                        <SelectItem key={label} value={label}>
                          <div className="flex items-center gap-2">
                            <Tag className="w-3 h-3" />
                            {label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="flex items-center gap-1 border border-slate-300 rounded-lg p-1">
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className={`h-8 px-3 ${viewMode === 'list' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className={`h-8 px-3 ${viewMode === 'grid' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setBulkActionMode(!bulkActionMode)}
                  className={bulkActionMode ? "bg-blue-50 border-blue-500 text-blue-700" : ""}
                >
                  {bulkActionMode ? 'Cancel' : 'Select'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </TutorialTooltip>

      {/* Bulk Actions Toolbar */}
      {bulkActionMode && selectedTasks.length > 0 && (
        <div className="sticky top-12 z-30 bg-blue-600 text-white p-4 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-semibold">{selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAllTasks}
                className="text-white hover:bg-blue-700"
              >
                Select All ({filteredTasks.length})
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={bulkCompleteTasks}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Complete
              </Button>
              <Button
                variant="ghost"
                onClick={clearSelection}
                className="text-white hover:bg-blue-700"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tasks List */}
      <TutorialTooltip
        tip="This is your task list. Click on any task to edit it, update its status, or change its priority. Drag tasks to reorder them. Tasks can be linked to accounts for better organization."
        step={6}
        position="bottom"
      >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filteredTasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 items-stretch">
              {filteredTasks.map((task) => {
                const StatusIcon = getStatusIcon(task.status);
                const accountName = getAccountName(task.related_account_id);
                const isOverdue = isTaskOverdue(task);
                const priorityFlag = getPriorityFlag(task.priority);
                const PriorityIcon = priorityFlag.icon || Flag;
                const isSelected = selectedTasks.includes(task.id);
                
                return (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    isSelected={isSelected}
                    onToggleSelect={toggleTaskSelection}
                    bulkMode={bulkActionMode}
                  >
                    <Card
                      className={`h-full min-h-[200px] hover:shadow-md transition-all cursor-pointer border ${
                        task.status === 'completed' ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:border-slate-300'
                      } ${isOverdue && task.status !== 'completed' ? 'border-red-200 bg-red-50/30' : ''}`}
                      onClick={() => !bulkActionMode && openEditDialog(task)}
                    >
                      <CardContent className="px-3 pt-2 pb-0 flex flex-col h-full">
                        {/* Header with priority and status */}
                        <div className="flex items-start justify-between mb-4">
                            <div 
                            className={`flex items-center justify-center w-6 h-6 rounded border ${priorityFlag.bgColor} ${priorityFlag.borderColor} cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0`}
                              onClick={(e) => handlePriorityClick(task.id, task.priority, e)}
                              title={`Click to change priority (currently ${priorityFlag.label})`}
                            >
                            <PriorityIcon className={`w-3.5 h-3.5 ${priorityFlag.color} ${PriorityIcon === Circle ? 'fill-current' : ''}`} />
                            </div>
                            <Select
                              value={task.status}
                              onValueChange={(value) => {
                                handleStatusChange(task.id, value);
                              }}
                            >
                            <SelectTrigger 
                              className="w-[130px] h-6 px-1.5 border-0 hover:bg-slate-100 flex items-center justify-center gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <StatusIcon className={`w-3 h-3 ${getStatusColor(task.status)} flex-shrink-0`} />
                              <SelectValue className="text-xs font-medium" />
                              </SelectTrigger>
                            <SelectContent position="item-aligned" onClick={(e) => e.stopPropagation()}>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="blocked">Blocked</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        
                        {/* Centered content area */}
                        <div className="flex-1 flex flex-col justify-center pt-2">
                          {/* Task Title */}
                          <h3 className={`font-semibold text-slate-900 text-sm mb-1.5 line-clamp-2 leading-snug ${
                            task.status === 'completed' ? 'line-through text-slate-500' : ''
                            }`}>
                              {task.title}
                            </h3>
                          
                          {/* Description - always reserve space */}
                          <div className="min-h-[40px]">
                            {task.description ? (
                              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{task.description}</p>
                            ) : (
                              <div className="h-full"></div>
                            )}
                          </div>
                        </div>
                        
                        {/* Metadata badges */}
                        <div className="mt-auto pt-0.5 border-t border-slate-100">
                          <div className="flex flex-wrap items-center gap-1 text-xs">
                          {task.due_date && (
                            <Badge 
                              variant="outline" 
                                className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 ${
                                  isOverdue ? 'bg-red-50 text-red-700 border-red-200' : 
                                  isTaskToday(task) ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  'text-slate-600 bg-slate-50 border-slate-200'
                              }`}
                            >
                                <Calendar className="w-2.5 h-2.5" />
                              {isTaskToday(task) ? 'Today' : format(new Date(task.due_date), 'MMM d')}
                            </Badge>
                          )}
                            {task.estimated_time && (
                              <Badge variant="outline" className="text-slate-600 bg-slate-50 border-slate-200 flex items-center gap-0.5 px-1.5 py-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {task.estimated_time}m
                            </Badge>
                          )}
                          {accountName && (
                              <Badge variant="outline" className="text-blue-600 bg-blue-50 border-blue-200 flex items-center gap-0.5 px-1.5 py-0.5 truncate max-w-[100px]">
                                <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                                <span className="truncate text-xs">{accountName}</span>
                            </Badge>
                            )}
                          </div>
                          {/* Labels row */}
                          {task.labels && task.labels.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1 mt-1.5">
                              {task.labels.slice(0, 2).map((label, idx) => (
                                <Badge key={idx} variant="outline" className="text-purple-700 bg-purple-50 border-purple-200 text-xs px-1.5 py-0.5">
                                  {label}
                                </Badge>
                              ))}
                              {task.labels.length > 2 && (
                                <span className="text-xs text-slate-500">+{task.labels.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </SortableTaskItem>
                );
              })}
            </div>
          ) : (
            <div className={`space-y-${(isPWA || isMobile || isNativeApp) ? '2' : '3'}`}>
              {filteredTasks.map((task) => {
                const StatusIcon = getStatusIcon(task.status);
                const accountName = getAccountName(task.related_account_id);
                const isOverdue = isTaskOverdue(task);
                const priorityFlag = getPriorityFlag(task.priority);
                const PriorityIcon = priorityFlag.icon || Flag;
                const isSelected = selectedTasks.includes(task.id);
                const isMobileView = isPWA || isMobile || isNativeApp;
                
                return (
                  <SortableTaskItem
                    key={task.id}
                    task={task}
                    isSelected={isSelected}
                    onToggleSelect={toggleTaskSelection}
                    bulkMode={bulkActionMode}
                  >
                    <Card
                      className={`transition-all cursor-pointer relative overflow-hidden ${
                        task.status === 'completed' ? 'opacity-60' : ''
                      } ${
                        isOverdue && task.status !== 'completed' ? 'border-red-200 bg-red-50/30' : ''
                      } ${
                        isMobileView ? 'shadow-sm hover:shadow-md' : 'hover:shadow-md'
                      }`}
                      onClick={() => !bulkActionMode && openEditDialog(task)}
                      style={isMobileView ? {
                        borderLeftWidth: '4px',
                        borderLeftColor: priorityFlag.borderColorValue,
                        padding: '0',
                      } : {}}
                    >
                      <CardContent className={isMobileView ? 'p-4' : 'p-5'}>
                        {isMobileView ? (
                          // Mobile-optimized layout
                          <div className="space-y-3">
                            {/* Top row: Priority, Title, Status */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                <div 
                                  className={`flex items-center justify-center ${isMobileView ? 'w-8 h-8' : 'w-6 h-6'} rounded-md border-2 ${priorityFlag.bgColor} ${priorityFlag.borderColor} cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 touch-manipulation`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePriorityClick(task.id, task.priority, e);
                                  }}
                                  title={`Change priority (${priorityFlag.label})`}
                                  style={{ 
                                    minWidth: '32px',
                                    minHeight: '32px',
                                    WebkitTapHighlightColor: 'transparent'
                                  }}
                                >
                                  <PriorityIcon className={`${isMobileView ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${priorityFlag.color} ${PriorityIcon === Circle ? 'fill-current' : ''}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className={`font-semibold ${isMobileView ? 'text-base' : 'text-base'} text-slate-900 leading-tight ${
                                    task.status === 'completed' ? 'line-through text-slate-500' : ''
                                  }`}>
                                    {task.title}
                                  </h3>
                                  {task.description && (
                                    <p className={`${isMobileView ? 'text-sm' : 'text-sm'} text-slate-600 mt-1 line-clamp-1 leading-relaxed`}>
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Select
                                value={task.status}
                                onValueChange={(value) => {
                                  handleStatusChange(task.id, value);
                                }}
                              >
                                <SelectTrigger 
                                  className={`${isMobileView ? 'w-[150px] min-w-[150px] h-9' : 'w-[160px]'} px-3 py-1.5 border border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2 flex-shrink-0 touch-manipulation`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                  style={{ WebkitTapHighlightColor: 'transparent' }}
                                >
                                  <StatusIcon className={`w-4 h-4 ${getStatusColor(task.status)} flex-shrink-0`} />
                                  <SelectValue className={`${isMobileView ? 'text-sm' : 'text-sm'} font-medium whitespace-nowrap`} />
                                </SelectTrigger>
                                <SelectContent position="item-aligned" onClick={(e) => e.stopPropagation()}>
                                  <SelectItem value="todo">To Do</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="blocked">Blocked</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {/* Bottom row: Metadata badges */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {task.due_date && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs px-2 py-0.5 flex items-center gap-1 ${
                                    isOverdue ? 'bg-red-50 text-red-700 border-red-200' : 
                                    isTaskToday(task) ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'text-slate-600 bg-slate-50 border-slate-200'
                                  }`}
                                >
                                  <Calendar className="w-3 h-3" />
                                  {isTaskToday(task) ? 'Today' : 
                                   isOverdue ? `${differenceInDays(new Date(), parseLocalDate(task.due_date))}d overdue` :
                                   format(new Date(task.due_date), 'MMM d')}
                                </Badge>
                              )}
                              {accountName && (
                                <Badge variant="outline" className="text-xs px-2 py-0.5 text-blue-600 bg-blue-50 border-blue-200 flex items-center gap-1 truncate max-w-[120px]">
                                  <Building2 className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{accountName}</span>
                                </Badge>
                              )}
                              {task.labels && task.labels.length > 0 && (
                                task.labels.slice(0, 2).map((label, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs px-2 py-0.5 text-purple-700 bg-purple-50 border-purple-200">
                                    {label}
                                  </Badge>
                                ))
                              )}
                              {task.labels && task.labels.length > 2 && (
                                <span className="text-xs text-slate-500">+{task.labels.length - 2}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          // Desktop layout (unchanged)
                        <div className="flex items-start gap-4">
                          <div className="flex items-center gap-3 flex-shrink-0" {...(!bulkActionMode && { onMouseDown: (e) => e.stopPropagation() })}>
                            {!bulkActionMode && (
                              <GripVertical className="w-4 h-4 text-slate-400 cursor-move" />
                            )}
                            <div 
                              className={`flex items-center justify-center w-6 h-6 rounded border ${priorityFlag.bgColor} ${priorityFlag.borderColor} cursor-pointer hover:opacity-80 transition-opacity`}
                              onClick={(e) => handlePriorityClick(task.id, task.priority, e)}
                              title={`Click to change priority (currently ${priorityFlag.label})`}
                            >
                                <PriorityIcon className={`w-3.5 h-3.5 ${priorityFlag.color} ${PriorityIcon === Circle ? 'fill-current' : ''}`} />
                            </div>
                            <Select
                              value={task.status}
                              onValueChange={(value) => {
                                handleStatusChange(task.id, value);
                              }}
                              >
                                <SelectTrigger 
                                  className="w-[160px] px-3 py-1.5 border-0 hover:bg-slate-100 flex items-center justify-center gap-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                  }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                >
                                  <StatusIcon className={`w-4 h-4 ${getStatusColor(task.status)} flex-shrink-0`} />
                                  <SelectValue className="text-sm" />
                              </SelectTrigger>
                                <SelectContent position="item-aligned" onClick={(e) => e.stopPropagation()}>
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="blocked">Blocked</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className={`font-semibold text-slate-900 ${
                                    task.status === 'completed' ? 'line-through' : ''
                                  }`}>
                                    {task.title}
                                  </h3>
                                  <Badge variant="outline" className={`text-xs ${priorityFlag.bgColor} ${priorityFlag.color} ${priorityFlag.borderColor}`}>
                                    {priorityFlag.label}
                                  </Badge>
                                </div>
                                {task.description && (
                                  <p className="text-sm text-slate-600 mt-1 line-clamp-2">{task.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {task.estimated_time && (
                                <Badge variant="outline" className="text-slate-600 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {task.estimated_time}m
                                </Badge>
                              )}
                              {task.labels && task.labels.length > 0 && (
                                task.labels.slice(0, 3).map((label, idx) => (
                                  <Badge key={idx} variant="outline" className="text-purple-700 bg-purple-50 border-purple-200 text-xs">
                                    {label}
                                  </Badge>
                                ))
                              )}
                              {task.category && (
                                <Badge variant="outline" className="text-slate-700">
                                  {task.category.replace('_', ' ')}
                                </Badge>
                              )}
                              {task.due_date && (
                                <Badge 
                                  variant="outline" 
                                  className={`flex items-center gap-1 ${
                                    isOverdue ? 'bg-red-50 text-red-700 border-red-200' : 
                                    isTaskToday(task) ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'text-slate-600'
                                  }`}
                                >
                                  <Calendar className="w-3 h-3" />
                                  {isTaskToday(task) ? 'Today' : 
                                   isOverdue ? `${differenceInDays(new Date(), parseLocalDate(task.due_date))}d overdue` :
                                   format(new Date(task.due_date), 'MMM d, yyyy')}
                                </Badge>
                              )}
                              {task.assigned_to && (
                                <Badge variant="outline" className="text-slate-600 flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {task.assigned_to.split('@')[0]}
                                </Badge>
                              )}
                              {accountName && (
                                <Badge variant="outline" className="text-blue-600 border-blue-200 flex items-center gap-1">
                                  <Building2 className="w-3 h-3" />
                                  {accountName}
                                </Badge>
                              )}
                              {task.subtasks && task.subtasks.length > 0 && (
                                <Badge variant="outline" className="text-slate-600 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        )}
                      </CardContent>
                    </Card>
                  </SortableTaskItem>
                );
              })}
            </div>
          )}
        </SortableContext>
      </DndContext>

      {filteredTasks.length === 0 && (
        <Card className="p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No tasks found</h3>
          <p className="text-slate-600">
            {searchTerm || activeFilter !== 'today' || filterPriority !== 'all' || filterLabel !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first task to get started'}
          </p>
        </Card>
      )}
      </TutorialTooltip>
    </div>
  );
}

