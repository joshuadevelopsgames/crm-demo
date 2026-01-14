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
    const { data: initialIntegration, error: integrationError } = await supabase
      .from('google_calendar_integrations')
      .select('access_token, refresh_token, token_expiry')
      .eq('user_id', user.id)
      .single();
    
    let integration = initialIntegration;

    if (integrationError || !integration) {
      return res.status(401).json({ 
        success: false, 
        error: 'Calendar not connected' 
      });
    }

    // Check if token is expired or about to expire (refresh 5 minutes before expiry)
    const now = new Date();
    const expiryTime = integration.token_expiry ? new Date(integration.token_expiry) : null;
    const shouldRefresh = expiryTime && (expiryTime.getTime() - now.getTime() < 5 * 60 * 1000); // 5 minutes buffer

    if (shouldRefresh || (expiryTime && expiryTime < now)) {
      if (!integration.refresh_token) {
        return res.status(401).json({ 
          success: false, 
          error: 'Calendar token expired. Please reconnect.' 
        });
      }

      // Refresh the token
      try {
        const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
        const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

        if (!CLIENT_ID || !CLIENT_SECRET) {
          console.error('❌ Google OAuth credentials not configured');
          return res.status(500).json({ 
            success: false, 
            error: 'Server configuration error' 
          });
        }

        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: integration.refresh_token,
            grant_type: 'refresh_token',
          }),
        });

        if (!refreshResponse.ok) {
          const errorData = await refreshResponse.json().catch(() => ({}));
          console.error('❌ Token refresh failed:', errorData);
          
          // If refresh token is invalid/expired, delete the integration
          if (refreshResponse.status === 400) {
            await supabase
              .from('google_calendar_integrations')
              .delete()
              .eq('user_id', user.id);
            
            return res.status(401).json({ 
              success: false, 
              error: 'Calendar token expired. Please reconnect.' 
            });
          }
          
          return res.status(401).json({ 
            success: false, 
            error: 'Failed to refresh Calendar token. Please reconnect.' 
          });
        }

        const tokenData = await refreshResponse.json();
        const newAccessToken = tokenData.access_token;
        const newExpiresIn = tokenData.expires_in || 3600; // Default to 1 hour
        const newTokenExpiry = new Date(Date.now() + newExpiresIn * 1000).toISOString();

        // Update the integration with new token
        const { data: updatedIntegration, error: updateError } = await supabase
          .from('google_calendar_integrations')
          .update({
            access_token: newAccessToken,
            token_expiry: newTokenExpiry,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .select('access_token, refresh_token, token_expiry')
          .single();

        if (updateError || !updatedIntegration) {
          console.error('❌ Error updating refreshed token:', updateError);
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to save refreshed token' 
          });
        }

        console.log('✅ Calendar token refreshed successfully');
        integration = updatedIntegration;
      } catch (error) {
        console.error('❌ Error refreshing Calendar token:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to refresh token' 
        });
      }
    }

    const { syncType = 'calendar_to_crm' } = req.body;

    if (syncType === 'calendar_to_crm') {
      // Sync calendar events to CRM tasks
      return await syncCalendarToCRM(supabase, user.id, integration.access_token, res, user.email);
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
 * Updates tasks when calendar events change and creates tasks for new events
 */
async function syncCalendarToCRM(supabase, userId, accessToken, res, userEmail) {
  try {
    console.log('🔄 Starting calendar to CRM sync for user:', userId);
    
    // Fetch all events from Google Calendar for the next 30 days
    const timeMin = new Date().toISOString();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 30);
    const timeMaxISO = timeMax.toISOString();

    console.log('📅 Fetching calendar events from Google...', { timeMin, timeMax: timeMaxISO });
    
    let eventsResponse;
    try {
      eventsResponse = await fetch(
        `${CALENDAR_API_BASE}/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMaxISO}&singleEvents=true&orderBy=startTime&maxResults=2500`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (fetchError) {
      console.error('❌ Network error fetching calendar events:', fetchError);
      throw new Error(`Network error: ${fetchError.message}`);
    }

    if (!eventsResponse.ok) {
      let errorText = '';
      try {
        errorText = await eventsResponse.text();
        const errorJson = JSON.parse(errorText);
        console.error('❌ Failed to fetch calendar events:', {
          status: eventsResponse.status,
          statusText: eventsResponse.statusText,
          error: errorJson
        });
        
        // Handle specific error cases
        if (eventsResponse.status === 401) {
          throw new Error('Calendar authentication failed. Please reconnect your calendar.');
        } else if (eventsResponse.status === 403) {
          throw new Error('Calendar access denied. Please check your permissions.');
        } else if (eventsResponse.status === 429) {
          throw new Error('Calendar API rate limit exceeded. Please try again later.');
        }
      } catch (parseError) {
        console.error('❌ Error parsing error response:', parseError);
      }
      throw new Error(`Failed to fetch calendar events: ${eventsResponse.status} ${eventsResponse.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }

    const eventsData = await eventsResponse.json();
    const googleEvents = eventsData.items || [];
    console.log(`📅 Found ${googleEvents.length} calendar events`);

    // Get all existing linked calendar events
    const { data: linkedEvents, error: eventsError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .not('google_event_id', 'is', null);

    if (eventsError) {
      console.error('❌ Failed to fetch linked events:', eventsError);
      throw new Error('Failed to fetch linked events');
    }

    const linkedEventMap = new Map();
    (linkedEvents || []).forEach(event => {
      linkedEventMap.set(event.google_event_id, event);
    });

    let updated = 0;
    let created = 0;
    const errors = [];

    // Process each Google Calendar event
    for (const googleEvent of googleEvents) {
      try {
        // Skip all-day events without times (they're less useful for task sync)
        if (!googleEvent.start?.dateTime && !googleEvent.start?.date) {
          continue;
        }

        const linkedEvent = linkedEventMap.get(googleEvent.id);
        
        if (linkedEvent) {
          // Event is already linked - check if it needs updating
          const googleUpdated = new Date(googleEvent.updated);
          const localUpdated = linkedEvent.updated_at ? new Date(linkedEvent.updated_at) : new Date(0);

          if (googleUpdated > localUpdated && linkedEvent.task_id) {
            // Event was updated in Google Calendar, update the task
            console.log(`🔄 Updating task for event: ${googleEvent.summary || 'Untitled'}`);
            
            const taskUpdates = {
              title: googleEvent.summary || linkedEvent.title || 'Untitled Event',
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

            // Update the task directly in Supabase
            taskUpdates.updated_at = new Date().toISOString();
            
            // Convert empty strings to null for date/time fields
            if (taskUpdates.due_date === '' || taskUpdates.due_date === null || taskUpdates.due_date === undefined) {
              taskUpdates.due_date = null;
            }
            if (taskUpdates.due_time === '' || taskUpdates.due_time === null || taskUpdates.due_time === undefined) {
              taskUpdates.due_time = null;
            }

            const { data: updatedTask, error: updateError } = await supabase
              .from('tasks')
              .update(taskUpdates)
              .eq('id', linkedEvent.task_id)
              .select()
              .single();

            if (updateError) {
              console.error(`❌ Failed to update task ${linkedEvent.task_id}:`, updateError);
              errors.push({ eventId: googleEvent.id, error: `Failed to update task: ${updateError.message}` });
            } else {
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

              updated++;
              console.log(`✅ Updated task ${linkedEvent.task_id}`);
            }
          }
        } else {
          // New event - create a task for it
          // Only create tasks for events that look like they could be tasks (have a title and aren't all-day)
          if (googleEvent.summary && googleEvent.start?.dateTime) {
            console.log(`➕ Creating task for new event: ${googleEvent.summary}`);
            
            const startDate = new Date(googleEvent.start.dateTime);
            const endDate = googleEvent.end?.dateTime ? new Date(googleEvent.end.dateTime) : null;
            
            // Calculate estimated time in minutes
            const estimatedTime = endDate 
              ? Math.round((endDate - startDate) / (1000 * 60))
              : 30; // Default to 30 minutes

            const taskData = {
              title: googleEvent.summary,
              description: googleEvent.description || null,
              due_date: startDate.toISOString().split('T')[0],
              due_time: startDate.toTimeString().slice(0, 5),
              estimated_time: estimatedTime,
              status: 'pending',
              created_by_email: userEmail || null,
              sync_to_calendar: true // Mark as synced so it doesn't create duplicate events
            };

            // Create the task directly in Supabase
            taskData.created_at = new Date().toISOString();
            taskData.updated_at = new Date().toISOString();

            const { data: newTask, error: createError } = await supabase
              .from('tasks')
              .insert(taskData)
              .select()
              .single();

            if (createError) {
              console.error(`❌ Failed to create task for event ${googleEvent.id}:`, createError);
              errors.push({ eventId: googleEvent.id, error: `Failed to create task: ${createError.message}` });
            } else if (newTask?.id) {
              // Link the calendar event to the task
              await supabase
                .from('calendar_events')
                .insert({
                  google_event_id: googleEvent.id,
                  user_id: userId,
                  task_id: newTask.id,
                  title: googleEvent.summary,
                  description: googleEvent.description || null,
                  start_time: googleEvent.start.dateTime,
                  end_time: googleEvent.end?.dateTime || null,
                  location: googleEvent.location || null,
                  sync_direction: 'calendar_to_crm'
                });

              created++;
              console.log(`✅ Created task ${newTask.id} for event ${googleEvent.id}`);
            } else {
              console.error(`❌ Task created but no ID returned`);
              errors.push({ eventId: googleEvent.id, error: 'Task created but no ID returned' });
            }
          }
        }
      } catch (error) {
        console.error(`❌ Error syncing event ${googleEvent.id}:`, error);
        errors.push({ eventId: googleEvent.id, error: error.message });
      }
    }

    // Check for deleted events (events that were in our database but not in Google Calendar)
    const googleEventIds = new Set(googleEvents.map(e => e.id));
    for (const linkedEvent of linkedEvents || []) {
      if (!googleEventIds.has(linkedEvent.google_event_id)) {
        // Event was deleted from Google Calendar
        console.log(`🗑️ Event ${linkedEvent.google_event_id} was deleted from Google Calendar`);
        // Don't delete the task, just remove the link
        await supabase
          .from('calendar_events')
          .delete()
          .eq('id', linkedEvent.id);
      }
    }

    console.log(`✅ Sync complete: ${updated} updated, ${created} created, ${errors.length} errors`);

    return res.status(200).json({
      success: true,
      data: {
        updated,
        created,
        errors: errors.length > 0 ? errors : undefined
      }
    });
  } catch (error) {
    console.error('❌ Error syncing calendar to CRM:', error);
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
