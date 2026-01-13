/**
 * Calendar Sync Service
 * Syncs tasks with Google Calendar
 */

import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchCalendarEvents } from './calendarService';
import { getSupabaseClient } from './supabaseClient';

/**
 * Sync a task to Google Calendar
 * Creates or updates a calendar event for the task
 */
export async function syncTaskToCalendar(task) {
  try {
    // Only sync tasks with due dates
    if (!task.due_date) {
      return { success: false, error: 'Task must have a due date to sync to calendar' };
    }

    // Check if Calendar is connected
    const { isCalendarConnected } = await import('./calendarService');
    const connected = await isCalendarConnected();
    if (!connected) {
      return { success: false, error: 'Calendar not connected' };
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Build event data
    const startDateTime = buildDateTime(task.due_date, task.due_time || '09:00');
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + (task.estimated_time || 30));

    const eventData = {
      summary: task.title,
      description: task.description || '',
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };

    // Add attendees if task is assigned
    if (task.assigned_to) {
      const assignedEmails = task.assigned_to.split(',').map(e => e.trim()).filter(Boolean);
      if (assignedEmails.length > 0) {
        eventData.attendees = assignedEmails.map(email => ({ email }));
      }
    }

    // Check if calendar event already exists for this task
    const { data: existingEvent } = await supabase
      .from('calendar_events')
      .select('google_event_id')
      .eq('task_id', task.id)
      .single();

    let googleEventId;
    if (existingEvent?.google_event_id) {
      // Update existing event
      await updateCalendarEvent(existingEvent.google_event_id, eventData);
      googleEventId = existingEvent.google_event_id;
    } else {
      // Create new event
      const createdEvent = await createCalendarEvent(eventData);
      googleEventId = createdEvent.id;

      // Store the link in database
      await supabase
        .from('calendar_events')
        .insert({
          google_event_id: googleEventId,
          user_id: user.id,
          task_id: task.id,
          title: task.title,
          description: task.description || null,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          account_id: task.related_account_id || null,
          contact_id: task.related_contact_id || null,
          sync_direction: 'crm_to_calendar'
        });
    }

    return { 
      success: true, 
      googleEventId,
      message: 'Task synced to calendar successfully'
    };
  } catch (error) {
    console.error('Error syncing task to calendar:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to sync task to calendar' 
    };
  }
}

/**
 * Remove task from calendar
 */
export async function removeTaskFromCalendar(taskId) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Find calendar event for this task
    const { data: calendarEvent } = await supabase
      .from('calendar_events')
      .select('google_event_id')
      .eq('task_id', taskId)
      .single();

    if (calendarEvent?.google_event_id) {
      // Delete from Google Calendar
      await deleteCalendarEvent(calendarEvent.google_event_id);
      
      // Remove from database
      await supabase
        .from('calendar_events')
        .delete()
        .eq('task_id', taskId);

      return { success: true, message: 'Task removed from calendar' };
    }

    return { success: true, message: 'No calendar event found for this task' };
  } catch (error) {
    console.error('Error removing task from calendar:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to remove task from calendar' 
    };
  }
}

/**
 * Build a Date object from date and time strings
 */
function buildDateTime(dateString, timeString) {
  const date = new Date(dateString);
  
  if (timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    date.setHours(hours || 9, minutes || 0, 0, 0);
  } else {
    date.setHours(9, 0, 0, 0); // Default to 9 AM
  }
  
  return date;
}
