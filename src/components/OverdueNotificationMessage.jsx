import React from 'react';
import { useOverdueTime } from '@/hooks/useOverdueTime';

/**
 * Component to display overdue task notification message with dynamic time
 * Updates every minute to show current overdue time
 */
export default function OverdueNotificationMessage({ notification, tasks }) {
  // Find the task for this notification
  const task = tasks.find(t => t.id === notification.related_task_id);
  
  // Get dynamic overdue time if we have the task's due_date
  const overdueTime = useOverdueTime(task?.due_date);
  
  // If we have overdue time, use it; otherwise fall back to the stored message
  if (overdueTime && task?.due_date) {
    // Extract task title from the notification message (format: "Task Title" is overdue by X)
    const titleMatch = notification.message?.match(/^"([^"]+)"/);
    const taskTitle = titleMatch ? titleMatch[1] : notification.title?.replace('Task Overdue: ', '') || 'Task';
    
    return (
      <span>
        "{taskTitle}" is overdue by {overdueTime}
      </span>
    );
  }
  
  // Fallback to original message if we don't have task data
  return <span>{notification.message}</span>;
}
