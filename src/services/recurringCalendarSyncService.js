/**
 * Recurring Calendar Sync Service
 * Syncs recurring tasks as recurring calendar events
 */

import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from './calendarService';
import { getSupabaseClient } from './supabaseClient';

/**
 * Sync a recurring task to Google Calendar as a recurring event
 */
export async function syncRecurringTaskToCalendar(task) {
  try {
    // Only sync recurring tasks with due dates
    if (!task.is_recurring || !task.due_date) {
      return { success: false, error: 'Task must be recurring and have a due date' };
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

    // Build recurring event data
    const startDateTime = buildDateTime(task.due_date, task.due_time || '09:00');
    const endDateTime = new Date(startDateTime);
    endDateTime.setMinutes(endDateTime.getMinutes() + (task.estimated_time || 30));

    // Build RRULE for recurring event
    const rrule = buildRRULE(task);

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
      },
      recurrence: [rrule]
    };

    // Add attendees if task is assigned
    if (task.assigned_to) {
      const assignedEmails = task.assigned_to.split(',').map(e => e.trim()).filter(Boolean);
      if (assignedEmails.length > 0) {
        eventData.attendees = assignedEmails.map(email => ({ email }));
      }
    }

    // Add end date if specified
    if (task.recurrence_end_date) {
      const endDate = new Date(task.recurrence_end_date);
      endDate.setHours(23, 59, 59);
      eventData.recurrence[0] += `;UNTIL=${formatDateForRRULE(endDate)}`;
    } else if (task.recurrence_count) {
      eventData.recurrence[0] += `;COUNT=${task.recurrence_count}`;
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
      // Create new recurring event
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
      message: 'Recurring task synced to calendar successfully'
    };
  } catch (error) {
    console.error('Error syncing recurring task to calendar:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to sync recurring task to calendar' 
    };
  }
}

/**
 * Build RRULE string for Google Calendar
 */
function buildRRULE(task) {
  const frequency = task.recurrence_pattern?.toUpperCase() || 'WEEKLY';
  const interval = task.recurrence_interval || 1;

  let rrule = `RRULE:FREQ=${frequency};INTERVAL=${interval}`;

  // Add day specifications based on pattern
  if (task.recurrence_pattern === 'weekly' && task.recurrence_days_of_week?.length > 0) {
    const dayMap = {
      'sunday': 'SU',
      'monday': 'MO',
      'tuesday': 'TU',
      'wednesday': 'WE',
      'thursday': 'TH',
      'friday': 'FR',
      'saturday': 'SA'
    };
    
    const days = task.recurrence_days_of_week
      .map(day => dayMap[day.toLowerCase()])
      .filter(Boolean)
      .join(',');
    
    if (days) {
      rrule += `;BYDAY=${days}`;
    }
  } else if (task.recurrence_pattern === 'monthly' && task.recurrence_day_of_month) {
    rrule += `;BYMONTHDAY=${task.recurrence_day_of_month}`;
  }

  return rrule;
}

/**
 * Format date for RRULE UNTIL clause
 */
function formatDateForRRULE(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}T235959Z`;
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
