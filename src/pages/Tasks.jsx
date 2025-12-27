import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  AlertTriangle,
  Trash2,
  Repeat,
  MessageSquare,
  Paperclip,
  Edit2,
  Download,
  Upload as UploadIcon,
} from "lucide-react";
import {
  format,
  differenceInDays,
  isToday,
  isPast,
  startOfDay,
} from "date-fns";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import toast, { Toaster } from "react-hot-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTaskNotifications,
  cleanupTaskNotifications,
} from "../services/notificationService";
import { unblockNextTask } from "../services/sequenceTaskService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import TutorialTooltip from "../components/TutorialTooltip";
import { useDeviceDetection } from "@/hooks/useDeviceDetection";
import TaskCalendarView from "@/components/TaskCalendarView";

// Sortable Task Item Wrapper
const SortableTaskItem = ({
  task,
  isSelected,
  onToggleSelect,
  bulkMode,
  ...props
}) => {
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
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="relative group"
    >
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
      <div className={bulkMode ? "ml-12" : ""} {...(!bulkMode && listeners)}>
        {props.children}
      </div>
    </div>
  );
};

export default function Tasks() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("today"); // 'inbox', 'today', 'upcoming', 'completed'
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterLabel, setFilterLabel] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [viewingTask, setViewingTask] = useState(null); // For read-only task view
  const [isViewMode, setIsViewMode] = useState(false); // true = viewing, false = editing/creating
  const [pendingAttachments, setPendingAttachments] = useState([]); // Files to upload after task creation
  const [viewMode, setViewMode] = useState("list"); // 'list', 'grid', or 'calendar'
  const [bulkActionMode, setBulkActionMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [lastCompletedTask, setLastCompletedTask] = useState(null);
  const [taskDialogTab, setTaskDialogTab] = useState("details"); // 'details', 'comments', 'attachments'
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const queryClient = useQueryClient();
  const { isPWA, isMobile, isNativeApp, isDesktop } = useDeviceDetection();

  // Detect if running on Mac
  const isMac =
    typeof window !== "undefined" &&
    (navigator.platform.toUpperCase().indexOf("MAC") >= 0 ||
      navigator.userAgent.toUpperCase().indexOf("MAC") >= 0);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => base44.entities.Task.list("-due_date"),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => base44.entities.Account.list(),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => base44.entities.Contact.list(),
  });

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return user;
    },
  });

  // Fetch comments for viewing/editing task
  const taskIdForComments = viewingTask?.id || editingTask?.id;
  const { data: taskComments = [] } = useQuery({
    queryKey: ["taskComments", taskIdForComments],
    queryFn: async () => {
      if (!taskIdForComments) return [];
      return await base44.entities.TaskComment.list(taskIdForComments);
    },
    enabled: !!taskIdForComments,
  });

  // Fetch attachments for viewing/editing task
  const taskIdForAttachments = viewingTask?.id || editingTask?.id;
  const { data: taskAttachments = [] } = useQuery({
    queryKey: ["taskAttachments", taskIdForAttachments],
    queryFn: async () => {
      if (!taskIdForAttachments) return [];
      return await base44.entities.TaskAttachment.list(taskIdForAttachments);
    },
    enabled: !!taskIdForAttachments,
  });

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    assigned_to: "",
    due_date: "",
    due_time: "",
    priority: "normal",
    status: "todo",
    category: "other",
    related_account_id: "",
    related_contact_id: "",
    estimated_time: 30,
    labels: [],
    subtasks: [],
    is_recurring: false,
    recurrence_pattern: "weekly",
    recurrence_interval: 1,
    recurrence_days_of_week: [],
    recurrence_day_of_month: null,
    recurrence_end_date: "",
    recurrence_count: null,
  });
  const [newLabelInput, setNewLabelInput] = useState("");

  const resetTaskForm = () => {
    setNewTask({
      title: "",
      description: "",
      assigned_to: "",
      due_date: "",
      due_time: "",
      priority: "normal",
      status: "todo",
      category: "other",
      related_account_id: "",
      related_contact_id: "",
      estimated_time: 30,
      labels: [],
      subtasks: [],
      is_recurring: false,
      recurrence_pattern: "weekly",
      recurrence_interval: 1,
      recurrence_days_of_week: [],
      recurrence_day_of_month: null,
      recurrence_end_date: "",
      recurrence_count: null,
    });
    setNewLabelInput("");
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
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setIsDialogOpen(false);
      setEditingTask(null);
      resetTaskForm();
      toast.success("Task created successfully");
    },
    onError: (error) => {
      console.error("Error creating task:", error);
      toast.error(error.message || "Failed to create task");
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const task = await base44.entities.Task.update(id, data);
      const updatedTask = { ...task, ...data };

      // Update notifications based on task status
      if (updatedTask.status === "completed") {
        await cleanupTaskNotifications(id);
        // Unblock next task if this task was blocking others
        await unblockNextTask(id);
      } else if (updatedTask.due_date) {
        await createTaskNotifications(updatedTask);
      }

      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setIsDialogOpen(false);
      setEditingTask(null);
      resetTaskForm();
    },
    onError: (error) => {
      console.error("Error updating task:", error);
      toast.error(error.message || "Failed to update task");
    },
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tasksToDelete, setTasksToDelete] = useState([]);

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskIds) => {
      const taskIdsArray = Array.isArray(taskIds) ? taskIds : [taskIds];
      await Promise.all(
        taskIdsArray.map(async (taskId) => {
          await base44.entities.Task.delete(taskId);
          await cleanupTaskNotifications(taskId);
        }),
      );
    },
    onSuccess: (_, taskIds) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setDeleteDialogOpen(false);
      const count = Array.isArray(taskIds) ? taskIds.length : 1;
      if (count === 1) {
        toast.success("✓ Task deleted");
      } else {
        toast.success(`✓ Deleted ${count} tasks`);
      }
      setTasksToDelete([]);
    },
    onError: (error) => {
      console.error("Error deleting task:", error);
      toast.error(error.message || "Failed to delete task");
    },
  });

  const handleDeleteTasks = (taskIds) => {
    const taskIdsArray = Array.isArray(taskIds) ? taskIds : [taskIds];
    const tasksToCheck = taskIdsArray
      .map((id) => tasks.find((t) => t.id === id))
      .filter(Boolean);
    const needsConfirmation =
      taskIdsArray.length > 1 || tasksToCheck.some((t) => t?.assigned_to);

    if (needsConfirmation) {
      setTasksToDelete(taskIdsArray);
      setDeleteDialogOpen(true);
    } else {
      // Delete immediately without confirmation
      deleteTaskMutation.mutate(taskIdsArray);
    }
  };

  const confirmDelete = async () => {
    deleteTaskMutation.mutate(tasksToDelete);
  };

  // Comment mutations
  const createCommentMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.TaskComment.create(data);
    },
    onSuccess: () => {
      const taskId = viewingTask?.id || editingTask?.id;
      queryClient.invalidateQueries({
        queryKey: ["taskComments", taskId],
      });
      setNewComment("");
      toast.success("Comment added");
    },
    onError: (error) => {
      console.error("Error creating comment:", error);
      toast.error(error.message || "Failed to add comment");
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ id, content }) => {
      return await base44.entities.TaskComment.update(id, { content });
    },
    onSuccess: () => {
      const taskId = viewingTask?.id || editingTask?.id;
      queryClient.invalidateQueries({
        queryKey: ["taskComments", taskId],
      });
      setEditingCommentId(null);
      setEditingCommentText("");
      toast.success("Comment updated");
    },
    onError: (error) => {
      console.error("Error updating comment:", error);
      toast.error(error.message || "Failed to update comment");
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (id) => {
      return await base44.entities.TaskComment.delete(id);
    },
    onSuccess: () => {
      const taskId = viewingTask?.id || editingTask?.id;
      queryClient.invalidateQueries({ queryKey: ["taskComments", taskId] });
      toast.success("Comment deleted");
    },
    onError: (error) => {
      console.error("Error deleting comment:", error);
      toast.error(error.message || "Failed to delete comment");
    },
  });

  // Attachment mutations
  const uploadAttachmentMutation = useMutation({
    mutationFn: async ({ file, fileName, taskId, userId, userEmail }) => {
      return await base44.entities.TaskAttachment.upload(
        file,
        fileName,
        taskId,
        userId,
        userEmail,
      );
    },
    onSuccess: () => {
      const taskId = viewingTask?.id || editingTask?.id;
      queryClient.invalidateQueries({ queryKey: ["taskAttachments", taskId] });
      toast.success("File uploaded");
    },
    onError: (error) => {
      console.error("Error uploading attachment:", error);
      toast.error(error.message || "Failed to upload file");
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (id) => {
      return await base44.entities.TaskAttachment.delete(id);
    },
    onSuccess: () => {
      const taskId = viewingTask?.id || editingTask?.id;
      queryClient.invalidateQueries({ queryKey: ["taskAttachments", taskId] });
      toast.success("File deleted");
    },
    onError: (error) => {
      console.error("Error deleting attachment:", error);
      toast.error(error.message || "Failed to delete file");
    },
  });

  // Comment handlers
  const handleAddComment = () => {
    const taskId = viewingTask?.id || editingTask?.id;
    if (!newComment.trim() || !taskId || !currentUser?.id) return;

    createCommentMutation.mutate({
      task_id: taskId,
      user_id: currentUser.id,
      user_email: currentUser.email,
      content: newComment.trim(),
    });
  };

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };

  const handleSaveComment = () => {
    if (!editingCommentText.trim() || !editingCommentId) return;

    updateCommentMutation.mutate({
      id: editingCommentId,
      content: editingCommentText.trim(),
    });
  };

  const handleDeleteComment = (id) => {
    if (confirm("Are you sure you want to delete this comment?")) {
      deleteCommentMutation.mutate(id);
    }
  };

  // Attachment handlers
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser?.id) return;
    addFileToPending(file);
  };

  const addFileToPending = (file) => {
    if (!file || !currentUser?.id) return;

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    // If task doesn't exist yet (creating new task), store file for later upload
    if (!editingTask?.id) {
      setPendingAttachments((prev) => [...prev, file]);
      toast.success("File will be uploaded when task is created");
      return;
    }

    // If task exists, upload immediately
    uploadAttachmentMutation.mutate({
      file,
      fileName: file.name,
      taskId: editingTask.id,
      userId: currentUser.id,
      userEmail: currentUser.email,
    });
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      addFileToPending(file);
    }
  };

  // Handle file download with forced download
  const handleFileDownload = async (attachment, event) => {
    event.preventDefault();

    try {
      if (attachment.storage_path) {
        // Use proxy endpoint for guaranteed download
        const downloadUrl = `/api/storage/download?path=${encodeURIComponent(attachment.storage_path)}&filename=${encodeURIComponent(attachment.file_name)}`;
        const response = await fetch(downloadUrl);

        if (!response.ok) {
          throw new Error("Failed to download file");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = attachment.file_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // Fallback to direct download
        const a = document.createElement("a");
        a.href = attachment.file_url;
        a.download = attachment.file_name;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file");
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + K: Quick add task
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsDialogOpen(true);
        setEditingTask(null);
      }
      // Escape: Close dialogs and exit bulk mode
      if (e.key === "Escape") {
        setIsDialogOpen(false);
        setBulkActionMode(false);
        setSelectedTasks([]);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Toggle task selection
  const toggleTaskSelection = (taskId) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  // Select all tasks
  const selectAllTasks = () => {
    setSelectedTasks(filteredTasks.map((t) => t.id));
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
        selectedTasks.map((taskId) =>
          updateTaskMutation.mutate({
            id: taskId,
            data: {
              status: "completed",
              completed_date: new Date().toISOString(),
            },
          }),
        ),
      );
      toast.success(`✓ Completed ${selectedTasks.length} tasks`);
      clearSelection();
    } catch (error) {
      console.error("Error bulk completing tasks:", error);
      toast.error("Failed to complete tasks");
    }
  };

  // Handle drag end
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = filteredTasks.findIndex((task) => task.id === active.id);
    const newIndex = filteredTasks.findIndex((task) => task.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(filteredTasks, oldIndex, newIndex);

    // Save order to database
    try {
      await Promise.all(
        newOrder.map((task, index) =>
          updateTaskMutation.mutate({
            id: task.id,
            data: { order: index },
          }),
        ),
      );
    } catch (error) {
      console.error("Error saving task order:", error);
    }
  };

  const handleCreateOrUpdate = async () => {
    const taskData = {
      ...newTask,
      assigned_to: newTask.assigned_to || null,
      // Clean up recurring fields if not recurring
      is_recurring: newTask.is_recurring || false,
      recurrence_pattern: newTask.is_recurring
        ? newTask.recurrence_pattern
        : null,
      recurrence_interval: newTask.is_recurring
        ? newTask.recurrence_interval
        : null,
      recurrence_days_of_week:
        newTask.is_recurring && newTask.recurrence_pattern === "weekly"
          ? newTask.recurrence_days_of_week
          : null,
      recurrence_day_of_month:
        newTask.is_recurring && newTask.recurrence_pattern === "monthly"
          ? newTask.recurrence_day_of_month
          : null,
      recurrence_end_date:
        newTask.is_recurring && newTask.recurrence_end_date
          ? newTask.recurrence_end_date
          : null,
      recurrence_count:
        newTask.is_recurring && newTask.recurrence_count
          ? newTask.recurrence_count
          : null,
    };

    // If creating a new task and due_date is blank, default to today
    if (!editingTask && (!taskData.due_date || taskData.due_date === "")) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");
      taskData.due_date = `${year}-${month}-${day}`;
    }

    // Calculate next_recurrence_date for recurring tasks
    if (taskData.is_recurring && taskData.due_date) {
      const nextDate = calculateNextRecurrenceDate(taskData);
      taskData.next_recurrence_date = nextDate;
    } else {
      taskData.next_recurrence_date = null;
    }

    if (editingTask) {
      updateTaskMutation.mutate({ id: editingTask.id, data: taskData });
    } else {
      createTaskMutation.mutate(taskData);
    }
  };

  // Calculate next recurrence date based on pattern
  const calculateNextRecurrenceDate = (task) => {
    if (!task.due_date) return null;

    const dueDate = new Date(task.due_date);
    const today = startOfDay(new Date());
    let nextDate = new Date(dueDate);

    // If due date is in the past, start from today
    if (dueDate < today) {
      nextDate = new Date(today);
    }

    switch (task.recurrence_pattern) {
      case "daily":
        nextDate.setDate(nextDate.getDate() + task.recurrence_interval);
        break;
      case "weekly":
        // Find next occurrence based on days of week
        if (
          task.recurrence_days_of_week &&
          task.recurrence_days_of_week.length > 0
        ) {
          const days = task.recurrence_days_of_week.sort();
          let found = false;
          for (let i = 0; i < 14; i++) {
            // Check next 2 weeks
            const checkDate = new Date(nextDate);
            checkDate.setDate(checkDate.getDate() + i);
            const dayOfWeek = checkDate.getDay();
            if (days.includes(dayOfWeek)) {
              nextDate = checkDate;
              found = true;
              break;
            }
          }
          if (!found) {
            // If no match in 2 weeks, use first day of next interval
            nextDate.setDate(nextDate.getDate() + task.recurrence_interval * 7);
            nextDate.setDate(
              nextDate.getDate() + (days[0] - nextDate.getDay()),
            );
          }
        } else {
          nextDate.setDate(nextDate.getDate() + task.recurrence_interval * 7);
        }
        break;
      case "monthly":
        if (task.recurrence_day_of_month) {
          nextDate.setMonth(nextDate.getMonth() + task.recurrence_interval);
          nextDate.setDate(task.recurrence_day_of_month);
        } else {
          nextDate.setMonth(nextDate.getMonth() + task.recurrence_interval);
        }
        break;
      case "yearly":
        nextDate.setFullYear(nextDate.getFullYear() + task.recurrence_interval);
        break;
      default:
        return null;
    }

    // Check if end date is set and next date exceeds it
    if (task.recurrence_end_date) {
      const endDate = new Date(task.recurrence_end_date);
      if (nextDate > endDate) {
        return null; // Recurrence has ended
      }
    }

    return nextDate.toISOString().split("T")[0]; // Return as YYYY-MM-DD
  };

  const handleStatusChange = async (taskId, newStatus) => {
    const task = tasks.find((t) => t.id === taskId);
    
    // Prevent completing blocked tasks
    if (newStatus === "completed" && task?.status === "blocked") {
      toast.error("Cannot complete a blocked task. Complete the blocking task first.");
      return;
    }
    
    const completedDate =
      newStatus === "completed" ? new Date().toISOString() : null;

    // Clean up notifications if task is completed
    if (newStatus === "completed") {
      await cleanupTaskNotifications(taskId);
      // Unblock next task if this task was blocking others
      await unblockNextTask(taskId);
    }

    updateTaskMutation.mutate({
      id: taskId,
      data: { status: newStatus, completed_date: completedDate },
    });

    // Show toast notification when completing a task
    if (newStatus === "completed") {
      setLastCompletedTask({ id: taskId, title: task?.title });
      toast.success("✓ Task completed", {
        duration: 5000,
        action: {
          label: "Undo",
          onClick: () => {
            updateTaskMutation.mutate({
              id: taskId,
              data: { status: "todo", completed_date: null },
            });
            setLastCompletedTask(null);
          },
        },
      });

      setTimeout(() => {
        setLastCompletedTask(null);
      }, 5000);
    }
  };

  const openTaskView = (task) => {
    setViewingTask(task);
    setEditingTask(null);
    setIsViewMode(true);
    setIsDialogOpen(true);
  };

  // Check for taskId in URL params and open the task
  useEffect(() => {
    if (tasks.length > 0 && !isLoading && !viewingTask && !editingTask) {
      const urlParams = new URLSearchParams(window.location.search);
      const taskId = urlParams.get('taskId');
      if (taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          openTaskView(task);
          // Clean up URL param
          const newUrl = window.location.pathname + window.location.search.replace(/[?&]taskId=[^&]*/, '').replace(/^\?/, '');
          window.history.replaceState({}, '', newUrl || window.location.pathname);
        }
      }
    }
  }, [tasks, isLoading, viewingTask, editingTask]);

  const openEditDialog = (task) => {
    setEditingTask(task);
    setViewingTask(null);
    setIsViewMode(false);
    setNewTask({
      title: task.title || "",
      description: task.description || "",
      assigned_to: task.assigned_to || "",
      due_date: task.due_date || "",
      due_time: task.due_time || "",
      priority: task.priority || "normal",
      status: task.status || "todo",
      category: task.category || "other",
      related_account_id: task.related_account_id || "",
      related_contact_id: task.related_contact_id || "",
      estimated_time: task.estimated_time || 30,
      labels: task.labels || [],
      subtasks: task.subtasks || [],
      is_recurring: task.is_recurring || false,
      recurrence_pattern: task.recurrence_pattern || "weekly",
      recurrence_interval: task.recurrence_interval || 1,
      recurrence_days_of_week: task.recurrence_days_of_week || [],
      recurrence_day_of_month: task.recurrence_day_of_month || null,
      recurrence_end_date: task.recurrence_end_date || "",
      recurrence_count: task.recurrence_count || null,
    });
    setNewLabelInput("");
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingTask(null);
    setViewingTask(null);
    setIsViewMode(false);
    setPendingAttachments([]);
    resetTaskForm();
    setTaskDialogTab("details");
    setNewComment("");
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const addLabel = () => {
    const label = newLabelInput.trim();
    if (label && !newTask.labels.includes(label)) {
      setNewTask({ ...newTask, labels: [...newTask.labels, label] });
      setNewLabelInput("");
    }
  };

  const removeLabel = (labelToRemove) => {
    setNewTask({
      ...newTask,
      labels: newTask.labels.filter((l) => l !== labelToRemove),
    });
  };

  // Get all unique labels from existing tasks for suggestions
  const getAllLabels = () => {
    const allLabels = new Set();
    tasks.forEach((task) => {
      if (task.labels && Array.isArray(task.labels)) {
        task.labels.forEach((label) => allLabels.add(label));
      }
    });
    return Array.from(allLabels).sort();
  };

  // Helper functions for date filtering
  const parseLocalDate = (dateString) => {
    if (!dateString) return null;
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const isTaskToday = (task) => {
    if (!task.due_date) return false;
    const taskDate = parseLocalDate(task.due_date);
    return isToday(taskDate);
  };

  const isTaskOverdue = (task) => {
    if (!task.due_date || task.status === "completed") return false;
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
  let filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.title
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesPriority =
      filterPriority === "all" || task.priority === filterPriority;
    const matchesLabel =
      filterLabel === "all" ||
      (task.labels &&
        Array.isArray(task.labels) &&
        task.labels.includes(filterLabel));

    if (!matchesSearch || !matchesPriority || !matchesLabel) return false;

    // Apply tab filter
    // Note: blocked tasks are excluded from main views but can be seen in "all" view
    switch (activeFilter) {
      case "inbox":
        return (
          task.status !== "completed" &&
          task.status !== "blocked" &&
          !task.due_date &&
          task.assigned_to === currentUser?.email
        );
      case "today":
        return (
          task.status !== "completed" &&
          task.status !== "blocked" &&
          (isTaskToday(task) || isTaskOverdue(task))
        );
      case "upcoming":
        return task.status !== "completed" && task.status !== "blocked" && isTaskUpcoming(task);
      case "completed":
        return task.status === "completed";
      default:
        return true; // "all" view shows all tasks including blocked
    }
  });

  // Sort tasks: order field first, then by priority, then by due date
  filteredTasks.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    const priorityOrder = {
      critical: 6,
      blocker: 5,
      major: 4,
      normal: 3,
      minor: 2,
      trivial: 1,
    };
    const priorityDiff =
      (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
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
      critical: {
        label: "Critical",
        color: "text-red-600",
        bgColor: "bg-red-50",
        borderColor: "border-red-200",
        borderColorValue: "#fecaca",
        icon: AlertTriangle,
      },
      blocker: {
        label: "Blocker",
        color: "text-red-700",
        bgColor: "bg-red-100",
        borderColor: "border-red-300",
        borderColorValue: "#fca5a5",
        icon: Ban,
      },
      major: {
        label: "Major",
        color: "text-orange-600",
        bgColor: "bg-orange-50",
        borderColor: "border-orange-200",
        borderColorValue: "#fed7aa",
        icon: ChevronsUp,
      },
      normal: {
        label: "Normal",
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-200",
        borderColorValue: "#bfdbfe",
        icon: Minus,
      },
      minor: {
        label: "Minor",
        color: "text-slate-600",
        bgColor: "bg-slate-50",
        borderColor: "border-slate-200",
        borderColorValue: "#e2e8f0",
        icon: ChevronsDown,
      },
      trivial: {
        label: "Trivial",
        color: "text-gray-500",
        bgColor: "bg-gray-50",
        borderColor: "border-gray-200",
        borderColorValue: "#e5e7eb",
        icon: Circle,
      },
    };
    return flags[priority] || flags.normal;
  };

  const cyclePriority = (currentPriority) => {
    // Cycle in de-escalating order: critical → blocker → major → normal → minor → trivial → critical
    const priorityOrder = [
      "critical",
      "blocker",
      "major",
      "normal",
      "minor",
      "trivial",
    ];
    const currentIndex = priorityOrder.indexOf(currentPriority || "normal");
    const nextIndex = (currentIndex + 1) % priorityOrder.length;
    return priorityOrder[nextIndex];
  };

  const handlePriorityClick = (taskId, currentPriority, e) => {
    e.stopPropagation(); // Prevent opening the edit dialog
    const newPriority = cyclePriority(currentPriority);

    // Update priority
    updateTaskMutation.mutate(
      {
        id: taskId,
        data: { priority: newPriority },
      },
      {
        onSuccess: () => {
          // After priority is updated, recalculate order based on priority sorting
          // Use setTimeout to ensure the query has been invalidated and refetched
          setTimeout(() => {
            const updatedTasks = queryClient.getQueryData(["tasks"]) || tasks;
            if (!updatedTasks || updatedTasks.length === 0) return;

            const priorityOrder = {
              critical: 6,
              blocker: 5,
              major: 4,
              normal: 3,
              minor: 2,
              trivial: 1,
            };

            // Sort by priority, then due date (same logic as filteredTasks sorting)
            const sortedTasks = [...updatedTasks].sort((a, b) => {
              const priorityDiff =
                (priorityOrder[b.priority] || 0) -
                (priorityOrder[a.priority] || 0);
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
                  data: { order: index },
                });
              }
            });
          }, 200);
        },
      },
    );
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: "bg-red-100 text-red-800 border-red-200",
      blocker: "bg-red-200 text-red-900 border-red-300",
      major: "bg-orange-100 text-orange-800 border-orange-200",
      normal: "bg-blue-100 text-blue-800 border-blue-200",
      minor: "bg-slate-100 text-slate-700 border-slate-200",
      trivial: "bg-gray-100 text-gray-600 border-gray-200",
    };
    return colors[priority] || colors.normal;
  };

  const getStatusIcon = (status) => {
    const icons = {
      todo: Circle,
      in_progress: Clock,
      blocked: AlertCircle,
      completed: CheckCircle2,
    };
    return icons[status] || Circle;
  };

  const getStatusColor = (status) => {
    const colors = {
      todo: "text-slate-400",
      in_progress: "text-blue-500",
      blocked: "text-red-500",
      completed: "text-emerald-500",
    };
    return colors[status] || colors.todo;
  };

  const getAccountName = (accountId) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.name;
  };

  // Get task counts for tabs
  const getTaskCounts = () => {
    const inbox = tasks.filter(
      (task) =>
        task.status !== "completed" &&
        !task.due_date &&
        task.assigned_to === currentUser?.email,
    ).length;
    const today = tasks.filter(
      (task) =>
        task.status !== "completed" &&
        (isTaskToday(task) || isTaskOverdue(task)),
    ).length;
    const upcoming = tasks.filter(
      (task) => task.status !== "completed" && isTaskUpcoming(task),
    ).length;
    const completed = tasks.filter(
      (task) => task.status === "completed",
    ).length;

    return { inbox, today, upcoming, completed };
  };

  const counts = getTaskCounts();

  return (
    <div className="space-y-6">
      <Toaster position="bottom-left" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <TutorialTooltip
          tip="Your central task management hub. Create tasks for follow-ups, meetings, and action items. Use tabs to filter by status (Today, Upcoming, Completed). Click any task to view details, add comments or attachments, update status, or mark as complete. Tasks from sequences are automatically created and blocked until previous tasks complete. Press ⌘K (or Ctrl+K) to quickly create a new task."
          step={6}
          position="bottom"
        >
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Tasks</h1>
            <p className="text-slate-600 mt-1">
              {filteredTasks.length}{" "}
              {activeFilter === "today"
                ? "tasks today"
                : activeFilter === "inbox"
                  ? "tasks in inbox"
                  : activeFilter === "upcoming"
                    ? "upcoming tasks"
                    : activeFilter === "completed"
                      ? "completed tasks"
                      : "tasks"}
              {!isMobile && isDesktop && (
                <span className="ml-3 text-xs text-slate-400">
                  Press{" "}
                  <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-600">
                    {isMac ? "⌘K" : "Ctrl K"}
                  </kbd>{" "}
                  to quick add
                </span>
              )}
            </p>
          </div>
        </TutorialTooltip>
        <TutorialTooltip
          tip="Create a new task to track any action item. Set a title, description, due date, priority, and link it to an account or contact for context. You can also make tasks recurring (daily, weekly, monthly), add attachments, and create subtasks. Tasks help you never miss a follow-up or deadline."
          step={6}
          position="bottom"
        >
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-slate-900 hover:bg-slate-800"
                onClick={() => {
                  setEditingTask(null);
                  setViewingTask(null);
                  setIsViewMode(false);
                  setPendingAttachments([]);
                  setTaskDialogTab("details");
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent
              className={
                isViewMode
                  ? "max-w-4xl max-h-[90vh] overflow-y-auto"
                  : "max-w-2xl max-h-[90vh] overflow-y-auto"
              }
            >
              <DialogHeader>
                <div className="flex items-center justify-between pr-8">
                  <div>
                    <DialogTitle>
                      {isViewMode
                        ? "Task Details"
                        : editingTask
                          ? "Edit Task"
                          : "Create Task"}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      {isViewMode
                        ? "View task details"
                        : editingTask
                          ? "Edit task information"
                          : "Create a new task"}
                    </DialogDescription>
                  </div>
                  {isViewMode && viewingTask && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        openEditDialog(viewingTask);
                      }}
                      className="mr-2"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </DialogHeader>

              {/* Tabs for Details, Comments, Attachments */}
              <Tabs
                value={taskDialogTab}
                onValueChange={setTaskDialogTab}
                className="w-full"
              >
                <TabsList className={editingTask || viewingTask ? "grid w-full grid-cols-3" : "grid w-full grid-cols-2"}>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  {(editingTask || viewingTask) && (
                    <TabsTrigger
                      value="comments"
                      className="flex items-center gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Comments ({taskComments.length})
                    </TabsTrigger>
                  )}
                  <TabsTrigger
                    value="attachments"
                    className="flex items-center gap-2"
                  >
                    <Paperclip className="w-4 h-4" />
                    Files (
                    {taskAttachments.length + pendingAttachments.length})
                  </TabsTrigger>
                </TabsList>

                {/* Details Tab Content */}
                <TabsContent value="details" className="space-y-4 py-4">
                  {/* Show task details/form when on Details tab (for both creating and editing) */}
                  <div>
                    {/* View Mode - Read-only task details */}
                    {isViewMode && viewingTask && (
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-2xl font-bold text-slate-900 mb-2">
                            {viewingTask.title}
                          </h2>
                          {viewingTask.description && (
                            <p className="text-slate-700 whitespace-pre-wrap">
                              {viewingTask.description}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">
                              Priority
                            </Label>
                            <div className="mt-1">
                              <Badge
                                className={getPriorityColor(
                                  viewingTask.priority,
                                )}
                              >
                                {viewingTask.priority}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">
                              Status
                            </Label>
                            <div className="mt-1">
                              <Badge variant="outline">
                                {viewingTask.status === "todo"
                                  ? "To Do"
                                  : viewingTask.status === "in_progress"
                                    ? "In Progress"
                                    : viewingTask.status === "blocked"
                                      ? "Blocked"
                                      : viewingTask.status === "completed"
                                        ? "Completed"
                                        : viewingTask.status}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">
                              Category
                            </Label>
                            <p className="mt-1 text-slate-900">
                              {viewingTask.category || "Other"}
                            </p>
                          </div>
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">
                              Due Date
                            </Label>
                            <p className="mt-1 text-slate-900">
                              {viewingTask.due_date
                                ? format(
                                    new Date(viewingTask.due_date),
                                    "MMM d, yyyy",
                                  )
                                : "No due date"}
                              {viewingTask.due_time &&
                                ` at ${viewingTask.due_time}`}
                            </p>
                          </div>
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">
                              Assigned To
                            </Label>
                            <p className="mt-1 text-slate-900">
                              {viewingTask.assigned_to || "Unassigned"}
                            </p>
                          </div>
                          <div>
                            <Label className="text-slate-500 text-xs uppercase">
                              Estimated Time
                            </Label>
                            <p className="mt-1 text-slate-900">
                              {viewingTask.estimated_time || 30} minutes
                            </p>
                          </div>
                          {viewingTask.related_account_id && (
                            <div>
                              <Label className="text-slate-500 text-xs uppercase">
                                Related Account
                              </Label>
                              <p className="mt-1 text-slate-900">
                                {accounts.find(
                                  (a) =>
                                    a.id === viewingTask.related_account_id,
                                )?.name || "Unknown"}
                              </p>
                            </div>
                          )}
                          {viewingTask.labels &&
                            viewingTask.labels.length > 0 && (
                              <div className="col-span-2">
                                <Label className="text-slate-500 text-xs uppercase">
                                  Labels
                                </Label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {viewingTask.labels.map((label, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="outline"
                                      className="text-purple-700 bg-purple-50 border-purple-200"
                                    >
                                      <Tag className="w-3 h-3 mr-1" />
                                      {label}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          {viewingTask.is_recurring && (
                            <div className="col-span-2">
                              <Label className="text-slate-500 text-xs uppercase">
                                Recurring
                              </Label>
                              <p className="mt-1 text-slate-900">
                                {viewingTask.recurrence_pattern} (every{" "}
                                {viewingTask.recurrence_interval})
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Edit/Create Mode - Editable form */}
                    {!isViewMode && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label>Task Title *</Label>
                          <Input
                            value={newTask.title}
                            onChange={(e) =>
                              setNewTask({ ...newTask, title: e.target.value })
                            }
                            placeholder="Follow up with client..."
                            disabled={isViewMode}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label>Description</Label>
                          <Textarea
                            value={newTask.description}
                            onChange={(e) =>
                              setNewTask({
                                ...newTask,
                                description: e.target.value,
                              })
                            }
                            placeholder="Task details..."
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label>Priority</Label>
                          <Select
                            value={newTask.priority}
                            onValueChange={(value) =>
                              setNewTask({ ...newTask, priority: value })
                            }
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
                            onValueChange={(value) =>
                              setNewTask({ ...newTask, status: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">To Do</SelectItem>
                              <SelectItem value="in_progress">
                                In Progress
                              </SelectItem>
                              <SelectItem value="blocked">Blocked</SelectItem>
                              <SelectItem value="completed">
                                Completed
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Category</Label>
                          <Select
                            value={newTask.category}
                            onValueChange={(value) =>
                              setNewTask({ ...newTask, category: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="follow_up">
                                Follow Up
                              </SelectItem>
                              <SelectItem value="demo">Demo</SelectItem>
                              <SelectItem value="proposal">Proposal</SelectItem>
                              <SelectItem value="onboarding">
                                Onboarding
                              </SelectItem>
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
                            onChange={(e) =>
                              setNewTask({
                                ...newTask,
                                due_date: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Due Time (optional)</Label>
                          <Input
                            type="time"
                            value={newTask.due_time}
                            onChange={(e) =>
                              setNewTask({
                                ...newTask,
                                due_time: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Estimated Time (minutes)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={newTask.estimated_time}
                            onChange={(e) =>
                              setNewTask({
                                ...newTask,
                                estimated_time: parseInt(e.target.value) || 30,
                              })
                            }
                            placeholder="30"
                          />
                        </div>
                        <div>
                          <Label>Assigned To (email)</Label>
                          <Input
                            value={newTask.assigned_to}
                            onChange={(e) =>
                              setNewTask({
                                ...newTask,
                                assigned_to: e.target.value,
                              })
                            }
                            placeholder="team@company.com"
                          />
                        </div>
                        <div>
                          <Label>Related Account</Label>
                          <Select
                            value={newTask.related_account_id}
                            onValueChange={(value) =>
                              setNewTask({
                                ...newTask,
                                related_account_id: value,
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select account (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              {accounts.map((account) => (
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
                                onChange={(e) =>
                                  setNewLabelInput(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
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
                                disabled={
                                  !newLabelInput.trim() ||
                                  newTask.labels.includes(newLabelInput.trim())
                                }
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                            {/* Suggested labels */}
                            {getAllLabels().length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                <span className="text-xs text-slate-500 mr-2">
                                  Suggestions:
                                </span>
                                {getAllLabels()
                                  .filter(
                                    (label) => !newTask.labels.includes(label),
                                  )
                                  .slice(0, 5)
                                  .map((label, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        setNewTask({
                                          ...newTask,
                                          labels: [...newTask.labels, label],
                                        });
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

                        {/* Recurring Task Options */}
                        <div className="col-span-2 border-t pt-4 mt-4">
                          <div className="flex items-center gap-2 mb-4">
                            <input
                              type="checkbox"
                              id="is_recurring"
                              checked={newTask.is_recurring}
                              onChange={(e) =>
                                setNewTask({
                                  ...newTask,
                                  is_recurring: e.target.checked,
                                })
                              }
                              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                            />
                            <Label
                              htmlFor="is_recurring"
                              className="font-semibold cursor-pointer"
                            >
                              Make this task recurring
                            </Label>
                          </div>

                          {newTask.is_recurring && (
                            <div className="space-y-4 pl-6 border-l-2 border-slate-200">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Repeat Pattern</Label>
                                  <Select
                                    value={newTask.recurrence_pattern}
                                    onValueChange={(value) => {
                                      setNewTask({
                                        ...newTask,
                                        recurrence_pattern: value,
                                        recurrence_days_of_week:
                                          value === "weekly"
                                            ? []
                                            : newTask.recurrence_days_of_week,
                                        recurrence_day_of_month:
                                          value === "monthly"
                                            ? null
                                            : newTask.recurrence_day_of_month,
                                      });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="daily">
                                        Daily
                                      </SelectItem>
                                      <SelectItem value="weekly">
                                        Weekly
                                      </SelectItem>
                                      <SelectItem value="monthly">
                                        Monthly
                                      </SelectItem>
                                      <SelectItem value="yearly">
                                        Yearly
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Repeat Every</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={newTask.recurrence_interval}
                                    onChange={(e) =>
                                      setNewTask({
                                        ...newTask,
                                        recurrence_interval:
                                          parseInt(e.target.value) || 1,
                                      })
                                    }
                                    placeholder="1"
                                  />
                                  <p className="text-xs text-slate-500 mt-1">
                                    {newTask.recurrence_pattern === "daily" &&
                                      "day(s)"}
                                    {newTask.recurrence_pattern === "weekly" &&
                                      "week(s)"}
                                    {newTask.recurrence_pattern === "monthly" &&
                                      "month(s)"}
                                    {newTask.recurrence_pattern === "yearly" &&
                                      "year(s)"}
                                  </p>
                                </div>
                              </div>

                              {newTask.recurrence_pattern === "weekly" && (
                                <div>
                                  <Label>Days of Week</Label>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {[
                                      "Sunday",
                                      "Monday",
                                      "Tuesday",
                                      "Wednesday",
                                      "Thursday",
                                      "Friday",
                                      "Saturday",
                                    ].map((day, index) => (
                                      <button
                                        key={index}
                                        type="button"
                                        onClick={() => {
                                          const days =
                                            newTask.recurrence_days_of_week ||
                                            [];
                                          const newDays = days.includes(index)
                                            ? days.filter((d) => d !== index)
                                            : [...days, index].sort();
                                          setNewTask({
                                            ...newTask,
                                            recurrence_days_of_week: newDays,
                                          });
                                        }}
                                        className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                          (
                                            newTask.recurrence_days_of_week ||
                                            []
                                          ).includes(index)
                                            ? "bg-slate-900 text-white border-slate-900"
                                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                                        }`}
                                      >
                                        {day.slice(0, 3)}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {newTask.recurrence_pattern === "monthly" && (
                                <div>
                                  <Label>Day of Month</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="31"
                                    value={
                                      newTask.recurrence_day_of_month || ""
                                    }
                                    onChange={(e) =>
                                      setNewTask({
                                        ...newTask,
                                        recurrence_day_of_month:
                                          parseInt(e.target.value) || null,
                                      })
                                    }
                                    placeholder="e.g., 15 (for 15th of each month)"
                                  />
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>End Date (optional)</Label>
                                  <Input
                                    type="date"
                                    value={newTask.recurrence_end_date}
                                    onChange={(e) =>
                                      setNewTask({
                                        ...newTask,
                                        recurrence_end_date: e.target.value,
                                      })
                                    }
                                    placeholder="Never"
                                  />
                                </div>
                                <div>
                                  <Label>
                                    Number of Occurrences (optional)
                                  </Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={newTask.recurrence_count || ""}
                                    onChange={(e) =>
                                      setNewTask({
                                        ...newTask,
                                        recurrence_count:
                                          parseInt(e.target.value) || null,
                                      })
                                    }
                                    placeholder="Unlimited"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Comments Tab Content */}
                <TabsContent value="comments" className="space-y-4 py-4">
                  {(editingTask || viewingTask) && (
                        <div className="space-y-4">
                          {/* Add Comment */}
                          <div className="space-y-2">
                            <Label>Add Comment</Label>
                            <Textarea
                              value={newComment}
                              onChange={(e) => setNewComment(e.target.value)}
                              placeholder="Add a comment..."
                              rows={3}
                            />
                            <Button
                              onClick={handleAddComment}
                              disabled={
                                !newComment.trim() ||
                                createCommentMutation.isPending
                              }
                              size="sm"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Comment
                            </Button>
                          </div>

                          {/* Comments List */}
                          <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {taskComments.length === 0 ? (
                              <p className="text-sm text-slate-500 text-center py-4">
                                No comments yet
                              </p>
                            ) : (
                              taskComments.map((comment) => (
                                <div
                                  key={comment.id}
                                  className="border rounded-lg p-3 bg-slate-50"
                                >
                                  {editingCommentId === comment.id ? (
                                    <div className="space-y-2">
                                      <Textarea
                                        value={editingCommentText}
                                        onChange={(e) =>
                                          setEditingCommentText(e.target.value)
                                        }
                                        rows={2}
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={handleSaveComment}
                                          disabled={
                                            updateCommentMutation.isPending
                                          }
                                        >
                                          Save
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setEditingCommentId(null);
                                            setEditingCommentText("");
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <p className="text-sm text-slate-900 whitespace-pre-wrap">
                                            {comment.content}
                                          </p>
                                          <p className="text-xs text-slate-500 mt-1">
                                            {comment.user_email || "Unknown"} •{" "}
                                            {format(
                                              new Date(comment.created_at),
                                              "MMM d, yyyy h:mm a",
                                            )}
                                          </p>
                                        </div>
                                        {currentUser?.id ===
                                          comment.user_id && (
                                          <div className="flex gap-1 ml-2">
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() =>
                                                handleEditComment(comment)
                                              }
                                              className="h-7 w-7 p-0"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() =>
                                                handleDeleteComment(comment.id)
                                              }
                                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                </TabsContent>

                {/* Attachments Tab Content */}
                <TabsContent value="attachments" className="space-y-4 py-4">
                  <div className="space-y-4 min-h-[200px] p-4">
                    {/* Drag and drop area - only show when creating new task */}
                    {(!editingTask && !viewingTask) && (
                          <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-lg p-8 transition-all ${
                              isDragging
                                ? "border-blue-500 bg-blue-50"
                                : "border-slate-300 bg-slate-50"
                            }`}
                          >
                            <div className="flex flex-col items-center text-center space-y-3">
                              <UploadIcon className="w-10 h-10 text-slate-400" />
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {isDragging
                                    ? "Drop file here"
                                    : "Drag and drop files here"}
                                </p>
                                <p className="text-sm text-slate-500 mt-1">
                                  or
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* File input button - always show when not viewing */}
                        {!isViewMode && (
                          <div className="space-y-2">
                            <Label>Attach File</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="file"
                                onChange={handleFileUpload}
                                disabled={uploadAttachmentMutation.isPending}
                                className="flex-1"
                                id="file-upload-input"
                              />
                            </div>
                            <p className="text-xs text-slate-500">
                              Max file size: 10MB
                            </p>
                          </div>
                        )}

                        {/* Show pending attachments during creation */}
                        {pendingAttachments.length > 0 && !editingTask && (
                              <div className="mt-3 space-y-2">
                                <Label className="text-xs text-slate-600 font-semibold">
                                  Pending uploads (will be attached after task
                                  creation):
                                </Label>
                                {pendingAttachments.map((file, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Paperclip className="w-4 h-4 text-blue-600" />
                                      <span className="text-sm text-slate-900">
                                        {file.name}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        ({(file.size / 1024).toFixed(1)} KB)
                                      </span>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setPendingAttachments((prev) =>
                                          prev.filter((_, i) => i !== idx),
                                        );
                                      }}
                                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                    >
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}

                        {/* Attachments List */}
                        <div className="space-y-2 max-h-[400px] overflow-y-auto">
                          {taskAttachments.length === 0 &&
                          pendingAttachments.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-4">
                              No attachments yet
                            </p>
                          ) : (
                            <>
                              {taskAttachments.map((attachment) => (
                                <div
                                  key={attachment.id}
                                  className="border rounded-lg p-3 bg-slate-50 flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <Paperclip className="w-5 h-5 text-slate-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <button
                                        onClick={(e) =>
                                          handleFileDownload(attachment, e)
                                        }
                                        className="text-sm font-medium text-slate-900 hover:text-slate-700 truncate block text-left w-full"
                                        title="Click to download"
                                      >
                                        {attachment.file_name}
                                      </button>
                                      <p className="text-xs text-slate-500">
                                        {attachment.file_size
                                          ? `${(attachment.file_size / 1024).toFixed(1)} KB`
                                          : ""}{" "}
                                        •{attachment.user_email || "Unknown"} •
                                        {format(
                                          new Date(attachment.created_at),
                                          "MMM d, yyyy",
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 ml-2">
                                    <button
                                      onClick={(e) =>
                                        handleFileDownload(attachment, e)
                                      }
                                      className="p-1.5 hover:bg-slate-200 rounded"
                                      title="Download file"
                                    >
                                      <Download className="w-4 h-4 text-slate-600" />
                                    </button>
                                    {currentUser?.id === attachment.user_id && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          if (
                                            confirm(
                                              "Are you sure you want to delete this file?",
                                            )
                                          ) {
                                            deleteAttachmentMutation.mutate(
                                              attachment.id,
                                            );
                                          }
                                        }}
                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Footer buttons - only show when creating a new task or editing (not viewing) */}
              {!isViewMode && (taskDialogTab === "details" || !editingTask) && (
                      <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={closeDialog}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateOrUpdate}
                          disabled={!newTask.title}
                        >
                          {editingTask ? "Update Task" : "Create Task"}
                        </Button>
                      </div>
                    )}
            </DialogContent>
          </Dialog>
        </TutorialTooltip>
      </div>

      {/* Tabs and Filters */}
      <TutorialTooltip
        tip="Organize your tasks with smart filtering. Use tabs: Inbox (tasks without due dates), Today (due today or overdue - prioritize these), Upcoming (future tasks), and Completed (your finished work). Use the search bar to find specific tasks by title or description. Filter by priority to focus on urgent items first. Switch between list, grid, and calendar views to see your tasks in different formats."
        step={6}
        position="bottom"
      >
        <div className="space-y-4">
          <Tabs value={activeFilter} onValueChange={setActiveFilter}>
            <div
              className="overflow-x-auto -mx-4 px-4"
              style={
                isPWA || isMobile || isNativeApp
                  ? {
                      overflowY: "hidden",
                      WebkitOverflowScrolling: "touch",
                      touchAction: "pan-x",
                      overscrollBehaviorX: "contain",
                      overscrollBehaviorY: "none",
                    }
                  : {}
              }
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
                <TabsTrigger
                  value="upcoming"
                  className="flex items-center gap-2"
                >
                  <Clock className="w-4 h-4" />
                  Upcoming ({counts.upcoming})
                </TabsTrigger>
                <TabsTrigger
                  value="completed"
                  className="flex items-center gap-2"
                >
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
                <Select
                  value={filterPriority}
                  onValueChange={setFilterPriority}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Priority">
                      {filterPriority === "all"
                        ? "All Priorities"
                        : filterPriority === "critical"
                          ? "Critical"
                          : filterPriority === "blocker"
                            ? "Blocker"
                            : filterPriority === "major"
                              ? "Major"
                              : filterPriority === "normal"
                                ? "Normal"
                                : filterPriority === "minor"
                                  ? "Minor"
                                  : filterPriority === "trivial"
                                    ? "Trivial"
                                    : "Priority"}
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
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    className={`h-8 px-3 ${viewMode === "list" ? "bg-slate-900 text-white hover:bg-slate-800" : ""}`}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={`h-8 px-3 ${viewMode === "grid" ? "bg-slate-900 text-white hover:bg-slate-800" : ""}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === "calendar" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("calendar")}
                    className={`h-8 px-3 ${viewMode === "calendar" ? "bg-slate-900 text-white hover:bg-slate-800" : ""}`}
                  >
                    <CalendarIcon className="w-4 h-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setBulkActionMode(!bulkActionMode)}
                  className={
                    bulkActionMode
                      ? "bg-blue-50 border-blue-500 text-blue-700"
                      : ""
                  }
                >
                  {bulkActionMode ? "Cancel" : "Select"}
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
              <span className="font-semibold">
                {selectedTasks.length} task
                {selectedTasks.length !== 1 ? "s" : ""} selected
              </span>
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
                onClick={() => handleDeleteTasks(selectedTasks)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
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
        tip="Your complete task list. Click any task to view or edit it - you can update status, change priority, add comments or attachments, set due dates, and link to accounts. Drag and drop tasks to reorder them manually. Tasks from sequences are automatically ordered and blocked until previous tasks complete. Use bulk selection mode to complete or delete multiple tasks at once."
        step={6}
        position="bottom"
      >
        {viewMode === "calendar" ? (
          <div className="h-[calc(100vh-300px)]">
            <TaskCalendarView
              tasks={filteredTasks}
              onTaskClick={(task) => openTaskView(task)}
              currentUser={currentUser}
            />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {viewMode === "grid" ? (
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
                            task.status === "completed"
                              ? "opacity-60 border-slate-200"
                              : "border-slate-200 hover:border-slate-300"
                          } ${isOverdue && task.status !== "completed" ? "border-red-200 bg-red-50/30" : ""}`}
                          onClick={() => !bulkActionMode && openTaskView(task)}
                        >
                          <CardContent className="px-3 pt-2 pb-0 flex flex-col h-full">
                            {/* Header with priority and status */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <div
                                  className={`flex items-center justify-center w-6 h-6 rounded border ${priorityFlag.bgColor} ${priorityFlag.borderColor} cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0`}
                                  onClick={(e) =>
                                    handlePriorityClick(
                                      task.id,
                                      task.priority,
                                      e,
                                    )
                                  }
                                  title={`Click to change priority (currently ${priorityFlag.label})`}
                                >
                                  <PriorityIcon
                                    className={`w-3.5 h-3.5 ${priorityFlag.color} ${PriorityIcon === Circle ? "fill-current" : ""}`}
                                  />
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
                                    <StatusIcon
                                      className={`w-3 h-3 ${getStatusColor(task.status)} flex-shrink-0`}
                                    />
                                    <SelectValue className="text-xs font-medium" />
                                  </SelectTrigger>
                                  <SelectContent
                                    position="item-aligned"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <SelectItem value="todo">To Do</SelectItem>
                                    <SelectItem value="in_progress">
                                      In Progress
                                    </SelectItem>
                                    <SelectItem value="blocked">
                                      Blocked
                                    </SelectItem>
                                    <SelectItem value="completed">
                                      Completed
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Centered content area */}
                            <div className="flex-1 flex flex-col justify-center pt-2">
                              {/* Task Title */}
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <h3
                                  className={`font-semibold text-slate-900 text-sm line-clamp-2 leading-snug flex-1 ${
                                    task.status === "completed"
                                      ? "line-through text-slate-500"
                                      : ""
                                  }`}
                                >
                                  {task.title}
                                </h3>
                                {(task.is_recurring || task.parent_task_id) && (
                                  <Badge
                                    variant="outline"
                                    className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-0.5 flex-shrink-0"
                                  >
                                    <Repeat className="w-3 h-3" />
                                    {task.parent_task_id
                                      ? "Recurring"
                                      : "Repeats"}
                                  </Badge>
                                )}
                              </div>

                              {/* Description - always reserve space */}
                              <div className="min-h-[40px]">
                                {task.description ? (
                                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                    {task.description}
                                  </p>
                                ) : (
                                  <div className="h-full"></div>
                                )}
                              </div>
                            </div>

                            {/* Metadata badges */}
                            <div className="mt-auto pt-0.5 border-t border-slate-100">
                              <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                                <div className="flex flex-wrap items-center gap-1">
                                  {task.due_date && (
                                    <Badge
                                      variant="outline"
                                      className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 ${
                                        isOverdue
                                          ? "bg-red-50 text-red-700 border-red-200"
                                          : isTaskToday(task)
                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                            : "text-slate-600 bg-slate-50 border-slate-200"
                                      }`}
                                    >
                                      <Calendar className="w-2.5 h-2.5" />
                                      {isTaskToday(task)
                                        ? "Today"
                                        : format(
                                            new Date(task.due_date),
                                            "MMM d",
                                          )}
                                    </Badge>
                                  )}
                                  {task.estimated_time && (
                                    <Badge
                                      variant="outline"
                                      className="text-slate-600 bg-slate-50 border-slate-200 flex items-center gap-0.5 px-1.5 py-0.5"
                                    >
                                      <Clock className="w-2.5 h-2.5" />
                                      {task.estimated_time}m
                                    </Badge>
                                  )}
                                  {accountName && (
                                    <Badge
                                      variant="outline"
                                      className="text-blue-600 bg-blue-50 border-blue-200 flex items-center gap-0.5 px-1.5 py-0.5 truncate max-w-[100px]"
                                    >
                                      <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                                      <span className="truncate text-xs">
                                        {accountName}
                                      </span>
                                    </Badge>
                                  )}
                                </div>
                                {!bulkActionMode && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTasks([task.id]);
                                    }}
                                    className="h-6 w-6 p-0 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                              {/* Labels row */}
                              {task.labels && task.labels.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                  {task.labels.slice(0, 2).map((label, idx) => (
                                    <Badge
                                      key={idx}
                                      variant="outline"
                                      className="text-purple-700 bg-purple-50 border-purple-200 text-xs px-1.5 py-0.5"
                                    >
                                      {label}
                                    </Badge>
                                  ))}
                                  {task.labels.length > 2 && (
                                    <span className="text-xs text-slate-500">
                                      +{task.labels.length - 2}
                                    </span>
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
                <div
                  className={`space-y-${isPWA || isMobile || isNativeApp ? "2" : "3"}`}
                >
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
                            task.status === "completed" ? "opacity-60" : ""
                          } ${
                            isOverdue && task.status !== "completed"
                              ? "border-red-200 bg-red-50/30"
                              : ""
                          } ${
                            isMobileView
                              ? "shadow-sm hover:shadow-md"
                              : "hover:shadow-md"
                          }`}
                          onClick={() => !bulkActionMode && openTaskView(task)}
                          style={
                            isMobileView
                              ? {
                                  borderLeftWidth: "4px",
                                  borderLeftColor:
                                    priorityFlag.borderColorValue,
                                  padding: "0",
                                }
                              : {}
                          }
                        >
                          <CardContent className={isMobileView ? "p-4" : "p-5"}>
                            {isMobileView ? (
                              // Mobile-optimized layout
                              <div className="space-y-3">
                                {/* Top row: Priority, Title, Status */}
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                    <div
                                      className={`flex items-center justify-center ${isMobileView ? "w-8 h-8" : "w-6 h-6"} rounded-md border-2 ${priorityFlag.bgColor} ${priorityFlag.borderColor} cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 touch-manipulation`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePriorityClick(
                                          task.id,
                                          task.priority,
                                          e,
                                        );
                                      }}
                                      title={`Change priority (${priorityFlag.label})`}
                                      style={{
                                        minWidth: "32px",
                                        minHeight: "32px",
                                        WebkitTapHighlightColor: "transparent",
                                      }}
                                    >
                                      <PriorityIcon
                                        className={`${isMobileView ? "w-4 h-4" : "w-3.5 h-3.5"} ${priorityFlag.color} ${PriorityIcon === Circle ? "fill-current" : ""}`}
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3
                                        className={`font-semibold ${isMobileView ? "text-base" : "text-base"} text-slate-900 leading-tight ${
                                          task.status === "completed"
                                            ? "line-through text-slate-500"
                                            : ""
                                        }`}
                                      >
                                        {task.title}
                                      </h3>
                                      {task.description && (
                                        <p
                                          className={`${isMobileView ? "text-sm" : "text-sm"} text-slate-600 mt-1 line-clamp-1 leading-relaxed`}
                                        >
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
                                      className={`${isMobileView ? "w-[150px] min-w-[150px] h-9" : "w-[160px]"} px-3 py-1.5 border border-slate-300 hover:bg-slate-50 flex items-center justify-center gap-2 flex-shrink-0 touch-manipulation`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                      }}
                                      onMouseDown={(e) => {
                                        e.stopPropagation();
                                      }}
                                      style={{
                                        WebkitTapHighlightColor: "transparent",
                                      }}
                                    >
                                      <StatusIcon
                                        className={`w-4 h-4 ${getStatusColor(task.status)} flex-shrink-0`}
                                      />
                                      <SelectValue
                                        className={`${isMobileView ? "text-sm" : "text-sm"} font-medium whitespace-nowrap`}
                                      />
                                    </SelectTrigger>
                                    <SelectContent
                                      position="item-aligned"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <SelectItem value="todo">
                                        To Do
                                      </SelectItem>
                                      <SelectItem value="in_progress">
                                        In Progress
                                      </SelectItem>
                                      <SelectItem value="blocked">
                                        Blocked
                                      </SelectItem>
                                      <SelectItem value="completed">
                                        Completed
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                {/* Bottom row: Metadata badges */}
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {task.due_date && (
                                    <Badge
                                      variant="outline"
                                      className={`text-xs px-2 py-0.5 flex items-center gap-1 ${
                                        isOverdue
                                          ? "bg-red-50 text-red-700 border-red-200"
                                          : isTaskToday(task)
                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                            : "text-slate-600 bg-slate-50 border-slate-200"
                                      }`}
                                    >
                                      <Calendar className="w-3 h-3" />
                                      {isTaskToday(task)
                                        ? "Today"
                                        : isOverdue
                                          ? `${differenceInDays(new Date(), parseLocalDate(task.due_date))}d overdue`
                                          : format(
                                              new Date(task.due_date),
                                              "MMM d",
                                            )}
                                    </Badge>
                                  )}
                                  {accountName && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs px-2 py-0.5 text-blue-600 bg-blue-50 border-blue-200 flex items-center gap-1 truncate max-w-[120px]"
                                    >
                                      <Building2 className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate">
                                        {accountName}
                                      </span>
                                    </Badge>
                                  )}
                                  {task.labels &&
                                    task.labels.length > 0 &&
                                    task.labels
                                      .slice(0, 2)
                                      .map((label, idx) => (
                                        <Badge
                                          key={idx}
                                          variant="outline"
                                          className="text-xs px-2 py-0.5 text-purple-700 bg-purple-50 border-purple-200"
                                        >
                                          {label}
                                        </Badge>
                                      ))}
                                  {task.labels && task.labels.length > 2 && (
                                    <span className="text-xs text-slate-500">
                                      +{task.labels.length - 2}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              // Desktop layout (unchanged)
                              <div className="flex items-start gap-4">
                                <div
                                  className="flex items-center gap-3 flex-shrink-0"
                                  {...(!bulkActionMode && {
                                    onMouseDown: (e) => e.stopPropagation(),
                                  })}
                                >
                                  {!bulkActionMode && (
                                    <GripVertical className="w-4 h-4 text-slate-400 cursor-move" />
                                  )}
                                  <div
                                    className={`flex items-center justify-center w-6 h-6 rounded border ${priorityFlag.bgColor} ${priorityFlag.borderColor} cursor-pointer hover:opacity-80 transition-opacity`}
                                    onClick={(e) =>
                                      handlePriorityClick(
                                        task.id,
                                        task.priority,
                                        e,
                                      )
                                    }
                                    title={`Click to change priority (currently ${priorityFlag.label})`}
                                  >
                                    <PriorityIcon
                                      className={`w-3.5 h-3.5 ${priorityFlag.color} ${PriorityIcon === Circle ? "fill-current" : ""}`}
                                    />
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
                                      <StatusIcon
                                        className={`w-4 h-4 ${getStatusColor(task.status)} flex-shrink-0`}
                                      />
                                      <SelectValue className="text-sm" />
                                    </SelectTrigger>
                                    <SelectContent
                                      position="item-aligned"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <SelectItem value="todo">
                                        To Do
                                      </SelectItem>
                                      <SelectItem value="in_progress">
                                        In Progress
                                      </SelectItem>
                                      <SelectItem value="blocked">
                                        Blocked
                                      </SelectItem>
                                      <SelectItem value="completed">
                                        Completed
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <h3
                                          className={`font-semibold text-slate-900 ${
                                            task.status === "completed"
                                              ? "line-through"
                                              : ""
                                          }`}
                                        >
                                          {task.title}
                                        </h3>
                                        <Badge
                                          variant="outline"
                                          className={`text-xs ${priorityFlag.bgColor} ${priorityFlag.color} ${priorityFlag.borderColor}`}
                                        >
                                          {priorityFlag.label}
                                        </Badge>
                                      </div>
                                      {task.description && (
                                        <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                                          {task.description}
                                        </p>
                                      )}
                                    </div>
                                    {!bulkActionMode && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteTasks([task.id]);
                                        }}
                                        className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 ml-2 flex-shrink-0"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    {task.estimated_time && (
                                      <Badge
                                        variant="outline"
                                        className="text-slate-600 flex items-center gap-1"
                                      >
                                        <Clock className="w-3 h-3" />
                                        {task.estimated_time}m
                                      </Badge>
                                    )}
                                    {task.labels &&
                                      task.labels.length > 0 &&
                                      task.labels
                                        .slice(0, 3)
                                        .map((label, idx) => (
                                          <Badge
                                            key={idx}
                                            variant="outline"
                                            className="text-purple-700 bg-purple-50 border-purple-200 text-xs"
                                          >
                                            {label}
                                          </Badge>
                                        ))}
                                    {task.category && (
                                      <Badge
                                        variant="outline"
                                        className="text-slate-700"
                                      >
                                        {task.category.replace("_", " ")}
                                      </Badge>
                                    )}
                                    {task.due_date && (
                                      <Badge
                                        variant="outline"
                                        className={`flex items-center gap-1 ${
                                          isOverdue
                                            ? "bg-red-50 text-red-700 border-red-200"
                                            : isTaskToday(task)
                                              ? "bg-amber-50 text-amber-700 border-amber-200"
                                              : "text-slate-600"
                                        }`}
                                      >
                                        <Calendar className="w-3 h-3" />
                                        {isTaskToday(task)
                                          ? "Today"
                                          : isOverdue
                                            ? `${differenceInDays(new Date(), parseLocalDate(task.due_date))}d overdue`
                                            : format(
                                                new Date(task.due_date),
                                                "MMM d, yyyy",
                                              )}
                                      </Badge>
                                    )}
                                    {task.assigned_to && (
                                      <Badge
                                        variant="outline"
                                        className="text-slate-600 flex items-center gap-1"
                                      >
                                        <User className="w-3 h-3" />
                                        {task.assigned_to.split("@")[0]}
                                      </Badge>
                                    )}
                                    {accountName && (
                                      <Badge
                                        variant="outline"
                                        className="text-blue-600 border-blue-200 flex items-center gap-1"
                                      >
                                        <Building2 className="w-3 h-3" />
                                        {accountName}
                                      </Badge>
                                    )}
                                    {task.subtasks &&
                                      task.subtasks.length > 0 && (
                                        <Badge
                                          variant="outline"
                                          className="text-slate-600 flex items-center gap-1"
                                        >
                                          <CheckCircle2 className="w-3 h-3" />
                                          {
                                            task.subtasks.filter(
                                              (st) => st.completed,
                                            ).length
                                          }
                                          /{task.subtasks.length}
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
        )}

        {filteredTasks.length === 0 && (
          <Card className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              No tasks found
            </h3>
            <p className="text-slate-600">
              {searchTerm ||
              activeFilter !== "today" ||
              filterPriority !== "all" ||
              filterLabel !== "all"
                ? "Try adjusting your filters"
                : "Create your first task to get started"}
            </p>
          </Card>
        )}
      </TutorialTooltip>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tasksToDelete.length > 1
                ? "Delete Multiple Tasks"
                : "Delete Task"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tasksToDelete.length > 1 ? (
                `Are you sure you want to delete ${tasksToDelete.length} tasks? This action cannot be undone.`
              ) : (
                <>
                  Are you sure you want to delete this task? This action cannot
                  be undone.
                  {tasksToDelete.length === 1 &&
                    tasks.find((t) => t.id === tasksToDelete[0])
                      ?.assigned_to && (
                      <div className="mt-2 p-2 bg-slate-50 rounded text-sm">
                        <strong>Task assigned to:</strong>{" "}
                        {
                          tasks.find((t) => t.id === tasksToDelete[0])
                            ?.assigned_to
                        }
                      </div>
                    )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteDialogOpen(false);
                setTasksToDelete([]);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteTaskMutation.isPending}
            >
              {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
