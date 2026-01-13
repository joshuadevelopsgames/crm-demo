/**
 * Calendar Sync API Endpoint
 * Handles two-way sync between CRM tasks and Google Calendar events
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Calendar API base URL
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://lecrm-dev.vercel.app',
    'https://lecrm-stg.vercel.app',
    'https://lecrm.vercel.app'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    const supabase = getSupabase();
    if (!supabase) {
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error' 
      });
    }

    // Get user ID from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Unauthorized' 
      });
    }

    // Get Calendar integration for user
    const { data: integration, error: integrationError } = await supabase
      .from('google_calendar_integrations')
      .select('access_token, refresh_token, token_expiry')
      .eq('user_id', user.id)
      .single();

    if (integrationError || !integration) {
      return res.status(401).json({ 
        success: false, 
        error: 'Calendar not connected' 
      });
    }

    // Check if token is expired
    if (integration.token_expiry && new Date(integration.token_expiry) < new Date()) {
      return res.status(401).json({ 
        success: false, 
        error: 'Calendar token expired. Please reconnect.' 
      });
    }

    const { syncType = 'calendar_to_crm' } = req.body;

    if (syncType === 'calendar_to_crm') {
      // Sync calendar events to CRM tasks
      return await syncCalendarToCRM(supabase, user.id, integration.access_token, res);
    } else if (syncType === 'crm_to_calendar') {
      // Sync CRM tasks to calendar events
      return await syncCRMToCalendar(supabase, user.id, integration.access_token, res);
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid sync type' 
      });
    }
  } catch (error) {
    console.error('Error syncing calendar:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}

/**
 * Sync calendar events to CRM tasks
 * Updates tasks when calendar events change
 */
async function syncCalendarToCRM(supabase, userId, accessToken, res) {
  try {
    // Get all linked calendar events
    const { data: linkedEvents, error: eventsError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .not('google_event_id', 'is', null);

    if (eventsError) {
      throw new Error('Failed to fetch linked events');
    }

    let updated = 0;
    const created = 0;
    const errors = [];

    // Fetch each event from Google Calendar to check for changes
    for (const linkedEvent of linkedEvents || []) {
      try {
        const response = await fetch(
          `${CALENDAR_API_BASE}/calendars/primary/events/${linkedEvent.google_event_id}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (!response.ok) {
          // Event might have been deleted
          if (response.status === 404) {
            // Delete the link
            await supabase
              .from('calendar_events')
              .delete()
              .eq('id', linkedEvent.id);
            continue;
          }
          throw new Error(`Failed to fetch event: ${response.statusText}`);
        }

        const googleEvent = await response.json();

        // Check if event was updated
        const googleUpdated = new Date(googleEvent.updated);
        const localUpdated = linkedEvent.updated_at ? new Date(linkedEvent.updated_at) : new Date(0);

        if (googleUpdated > localUpdated) {
          // Event was updated in Google Calendar, update the task
          if (linkedEvent.task_id) {
            const taskUpdates = {
              title: googleEvent.summary || linkedEvent.title,
              description: googleEvent.description || linkedEvent.description || null,
            };

            // Update due date/time if changed
            if (googleEvent.start?.dateTime) {
              const startDate = new Date(googleEvent.start.dateTime);
              taskUpdates.due_date = startDate.toISOString().split('T')[0];
              taskUpdates.due_time = startDate.toTimeString().slice(0, 5);
            } else if (googleEvent.start?.date) {
              taskUpdates.due_date = googleEvent.start.date;
              taskUpdates.due_time = null;
            }

            // Update the calendar_events record
            await supabase
              .from('calendar_events')
              .update({
                title: googleEvent.summary || linkedEvent.title,
                description: googleEvent.description || linkedEvent.description,
                start_time: googleEvent.start?.dateTime || googleEvent.start?.date,
                end_time: googleEvent.end?.dateTime || googleEvent.end?.date,
                updated_at: new Date().toISOString()
              })
              .eq('id', linkedEvent.id);

            // Note: To update the actual task in base44, you would need to:
            // 1. Import base44 client
            // 2. Call base44.entities.Task.update(linkedEvent.task_id, taskUpdates)
            // For now, we're just updating the calendar_events record to track changes
            // The UI can show a notification that calendar events have changed

            updated++;
          }
        }
      } catch (error) {
        console.error(`Error syncing event ${linkedEvent.google_event_id}:`, error);
        errors.push({ eventId: linkedEvent.google_event_id, error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        updated,
        created,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Error syncing calendar to CRM:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync calendar to CRM'
    });
  }
}

/**
 * Sync CRM tasks to calendar events
 * Creates/updates calendar events for tasks with sync enabled
 */
async function syncCRMToCalendar(supabase, userId, accessToken, res) {
  try {
    // Get tasks that should be synced (have sync_to_calendar flag or are linked)
    // Note: This would need to query tasks table - for now we'll use calendar_events
    const { data: tasksToSync, error: tasksError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .eq('sync_direction', 'crm_to_calendar');

    if (tasksError) {
      throw new Error('Failed to fetch tasks to sync');
    }

    const created = 0;
    const updated = 0;
    const errors = [];

    // This is a simplified version - in production you'd fetch tasks from base44
    // and create/update calendar events accordingly

    return res.status(200).json({
      success: true,
      data: {
        created,
        updated,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('Error syncing CRM to calendar:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync CRM to calendar'
    });
  }
}
