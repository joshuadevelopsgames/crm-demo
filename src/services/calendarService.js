/**
 * Google Calendar API Service
 * Handles Calendar OAuth and event management
 * Follows the same pattern as gmailService.js
 */

// Calendar API Configuration
const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';
const CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';

/**
 * Store Calendar access token (server-side)
 * Tokens are stored securely in Supabase, not localStorage
 */
export async function storeCalendarToken(tokenData) {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    // Store token on server via API
    const response = await fetch('/api/calendar/integration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to store Calendar token');
    }
  } catch (error) {
    console.error('Error storing Calendar token:', error);
    throw error;
  }
}

/**
 * Get Calendar connection status (server-side)
 */
export async function isCalendarConnected() {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (!supabase) {
      return false;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return false;
    }

    const response = await fetch('/api/calendar/integration', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      return false;
    }
    
    const result = await response.json();
    return result.success && result.connected === true;
  } catch (error) {
    console.error('Error checking Calendar connection:', error);
    return false;
  }
}

/**
 * Disconnect Calendar (server-side)
 */
export async function disconnectCalendar() {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/calendar/integration', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to disconnect Calendar');
    }
  } catch (error) {
    console.error('Error disconnecting Calendar:', error);
    throw error;
  }
}

/**
 * Fetch calendar events (via secure proxy)
 * Tokens are handled server-side and never exposed to frontend
 */
export async function fetchCalendarEvents(options = {}) {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const {
      timeMin = new Date().toISOString(),
      timeMax = null,
      maxResults = 50,
      calendarId = 'primary'
    } = options;

    // Build query params
    const params = new URLSearchParams({
      endpoint: `calendars/${calendarId}/events`,
      timeMin: timeMin,
      maxResults: String(maxResults),
      singleEvents: 'true',
      orderBy: 'startTime'
    });
    
    if (timeMax) {
      params.append('timeMax', timeMax);
    }

    // Use proxy endpoint (tokens handled server-side)
    const response = await fetch(`/api/calendar/proxy?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      if (response.status === 401) {
        await disconnectCalendar();
        throw new Error('Calendar authorization expired. Please reconnect.');
      }
      throw new Error(error.error || `Calendar API error: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
}

/**
 * Create calendar event (via secure proxy)
 */
export async function createCalendarEvent(eventData) {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const { calendarId = 'primary', ...event } = eventData;

    const response = await fetch('/api/calendar/proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        endpoint: `calendars/${calendarId}/events`,
        event
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to create calendar event: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
}

/**
 * Update calendar event (via secure proxy)
 */
export async function updateCalendarEvent(eventId, eventData, calendarId = 'primary') {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/calendar/proxy', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        endpoint: `calendars/${calendarId}/events/${eventId}`,
        event: eventData
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to update calendar event: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Error updating calendar event:', error);
    throw error;
  }
}

/**
 * Delete calendar event (via secure proxy)
 */
export async function deleteCalendarEvent(eventId, calendarId = 'primary') {
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const response = await fetch('/api/calendar/proxy', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        endpoint: `calendars/${calendarId}/events/${eventId}`
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to delete calendar event: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    throw error;
  }
}
