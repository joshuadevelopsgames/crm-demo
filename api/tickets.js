/**
 * API endpoint for ticket management
 * Supports CRUD operations for tickets and comments
 */

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './utils/emailService.js';

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl) {
    console.error('❌ SUPABASE_URL environment variable not set');
    return null;
  }
  
  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ 
      success: false, 
      error: 'Database configuration error' 
    });
  }

  try {
    // Get user from Authorization header
    const authHeader = req.headers.authorization;
    let userId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
    
    const isAdmin = profile?.role === 'admin' || profile?.role === 'system_admin';

    // GET /api/tickets - List tickets
    if (req.method === 'GET') {
      const { id, reporter_id, assignee_id, status, priority } = req.query;

      // If specific ticket ID requested
      if (id) {
        const { data: ticket, error } = await supabase
          .from('tickets')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          console.error('❌ Error fetching ticket:', error);
          return res.status(404).json({ 
            success: false, 
            error: 'Ticket not found' 
          });
        }

        // Check permissions
        if (!isAdmin && ticket.reporter_id !== userId && ticket.assignee_id !== userId) {
          return res.status(403).json({ 
            success: false, 
            error: 'Access denied' 
          });
        }

        // Get reporter profile information if reporter_id exists and is not 'anonymous'
        let reporterProfile = null;
        if (ticket.reporter_id && ticket.reporter_id !== 'anonymous') {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, email, full_name')
            .eq('id', ticket.reporter_id)
            .single();
          
          if (profile) {
            reporterProfile = profile;
          }
        }

        // Get comments
        const { data: comments, error: commentsError } = await supabase
          .from('ticket_comments')
          .select('*')
          .eq('ticket_id', id)
          .order('created_at', { ascending: true });

        if (commentsError) {
          console.error('❌ Error fetching comments:', commentsError);
        }

        // Filter comments based on permissions
        const visibleComments = isAdmin 
          ? comments || []
          : (comments || []).filter(c => !c.is_internal);

        return res.status(200).json({
          success: true,
          ticket: {
            ...ticket,
            reporter_profile: reporterProfile,
            comments: visibleComments
          }
        });
      }

      // List tickets with filters
      let query = supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters based on user role
      if (!isAdmin) {
        // Non-admins can only see their own tickets
        // Use .or() with proper syntax: field.eq.value,field2.eq.value2
        // Note: Supabase .or() requires the format: "field.eq.value,field2.eq.value2"
        query = query.or(`reporter_id.eq.${userId},assignee_id.eq.${userId}`);
        console.log(`🔍 Filtering tickets for user ${userId} (non-admin)`);
      } else {
        // Admins can filter by reporter or assignee
        if (reporter_id) {
          query = query.eq('reporter_id', reporter_id);
        }
        if (assignee_id) {
          query = query.eq('assignee_id', assignee_id);
        }
      }

      if (status) {
        query = query.eq('status', status);
      }
      if (priority) {
        query = query.eq('priority', priority);
      }

      const { data: tickets, error } = await query;

      if (error) {
        console.error('❌ Error fetching tickets:', error);
        console.error('❌ Query details:', { userId, isAdmin, error: error.message, errorCode: error.code });
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch tickets',
          details: error.message 
        });
      }

      console.log(`✅ Fetched ${tickets?.length || 0} tickets for user ${userId} (admin: ${isAdmin})`);

      // Get reporter profiles for all tickets
      const ticketsWithProfiles = await Promise.all(
        (tickets || []).map(async (ticket) => {
          let reporterProfile = null;
          if (ticket.reporter_id && ticket.reporter_id !== 'anonymous') {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, email, full_name')
              .eq('id', ticket.reporter_id)
              .single();
            
            if (profile) {
              reporterProfile = profile;
            }
          }
          
          return {
            ...ticket,
            reporter_profile: reporterProfile
          };
        })
      );

      return res.status(200).json({
        success: true,
        tickets: ticketsWithProfiles
      });
    }

    // POST /api/tickets - Create ticket
    if (req.method === 'POST') {
      const { title, description, priority, reporter_email, bug_report_data } = req.body;

      if (!title || !description) {
        return res.status(400).json({ 
          success: false, 
          error: 'Title and description are required' 
        });
      }

      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert({
          title,
          description,
          priority: priority || 'medium',
          reporter_id: userId,
          reporter_email: reporter_email || null,
          bug_report_data: bug_report_data || null,
          status: 'open'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating ticket:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to create ticket' 
        });
      }

      return res.status(201).json({
        success: true,
        ticket
      });
    }

    // PATCH /api/tickets/:id - Update ticket
    if (req.method === 'PATCH') {
      const { id } = req.query;
      const updates = req.body;

      if (!id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Ticket ID is required' 
        });
      }

      // Get existing ticket
      const { data: existingTicket, error: fetchError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !existingTicket) {
        return res.status(404).json({ 
          success: false, 
          error: 'Ticket not found' 
        });
      }

      // Check permissions
      if (!isAdmin) {
        // Non-admins can only update their own tickets, and only certain fields
        if (existingTicket.reporter_id !== userId && existingTicket.assignee_id !== userId) {
          return res.status(403).json({ 
            success: false, 
            error: 'Access denied' 
          });
        }

        // Non-admins cannot change status, assignee, priority, or archived_at
        delete updates.status;
        delete updates.assignee_id;
        delete updates.priority;
        delete updates.archived_at;
      }

      // Track what changed for notifications
      const statusChanged = updates.status && updates.status !== existingTicket.status;
      const assigneeChanged = updates.assignee_id !== undefined && updates.assignee_id !== existingTicket.assignee_id;
      const previousAssigneeId = existingTicket.assignee_id;
      const archivedChanged = updates.archived_at !== undefined && !existingTicket.archived_at && updates.archived_at;
      const unarchivedChanged = updates.archived_at === null && existingTicket.archived_at;

      // Update ticket
      const { data: ticket, error } = await supabase
        .from('tickets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating ticket:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to update ticket' 
        });
      }

      // Send email notifications (non-blocking)
      if (statusChanged) {
        sendTicketStatusChangeNotification(ticket, existingTicket.status, supabase).catch(err => {
          console.error('❌ Error sending status change notification:', err);
        });
        
        // Create in-app notification
        createTicketStatusChangeNotification(ticket, existingTicket.status, supabase).catch(err => {
          console.error('❌ Error creating status change notification:', err);
        });
      }
      
      if (assigneeChanged) {
        sendTicketAssignmentNotification(ticket, previousAssigneeId, supabase).catch(err => {
          console.error('❌ Error sending assignment notification:', err);
        });
        
        // Create in-app notification
        createTicketAssignmentNotification(ticket, previousAssigneeId, supabase).catch(err => {
          console.error('❌ Error creating assignment notification:', err);
        });
      }
      
      if (archivedChanged) {
        // Only notify if ticket was archived before completion
        const wasCompleted = existingTicket.status === 'resolved' || existingTicket.status === 'closed';
        if (!wasCompleted) {
          sendTicketArchivedNotification(ticket, supabase).catch(err => {
            console.error('❌ Error sending archive notification:', err);
          });
          
          createTicketArchivedNotification(ticket, supabase).catch(err => {
            console.error('❌ Error creating archive notification:', err);
          });
        }
      }
      
      // Note: We don't send notifications when unarchiving - it's a silent operation

      return res.status(200).json({
        success: true,
        ticket
      });
    }

    // DELETE /api/tickets/:id - Delete ticket (admin only, archived tickets only)
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Ticket ID is required' 
        });
      }

      if (!isAdmin) {
        return res.status(403).json({ 
          success: false, 
          error: 'Admin access required' 
        });
      }

      // Check if ticket exists and is archived
      const { data: ticket, error: fetchError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !ticket) {
        return res.status(404).json({ 
          success: false, 
          error: 'Ticket not found' 
        });
      }

      if (!ticket.archived_at) {
        return res.status(400).json({ 
          success: false, 
          error: 'Only archived tickets can be deleted. Please archive the ticket first.' 
        });
      }

      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Error deleting ticket:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to delete ticket' 
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Ticket deleted'
      });
    }

    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('❌ Error in tickets API:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}

/**
 * Create in-app notification when ticket status changes
 */
async function createTicketStatusChangeNotification(ticket, previousStatus, supabase) {
  try {
    // Only notify reporter
    if (!ticket.reporter_id || ticket.reporter_id === 'anonymous') {
      console.log('📧 No reporter ID for status change notification');
      return;
    }
    
    const statusLabels = {
      'open': 'Open',
      'in_progress': 'In Progress',
      'resolved': 'Resolved',
      'closed': 'Closed'
    };
    
    const previousStatusLabel = statusLabels[previousStatus] || previousStatus;
    const newStatusLabel = statusLabels[ticket.status] || ticket.status;
    
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: ticket.reporter_id,
        type: 'ticket_status_change',
        title: `Ticket #${ticket.ticket_number} status updated`,
        message: `Status changed from ${previousStatusLabel} to ${newStatusLabel}`,
        related_ticket_id: ticket.id,
        is_read: false,
        scheduled_for: new Date().toISOString()
      });
    
    if (error) {
      console.error('❌ Error creating status change notification:', error);
      throw error;
    }
    
    console.log(`✅ Created status change notification for ticket #${ticket.ticket_number}`);
  } catch (error) {
    console.error('❌ Error in createTicketStatusChangeNotification:', error);
    throw error;
  }
}

/**
 * Create in-app notification when ticket is assigned
 */
async function createTicketAssignmentNotification(ticket, previousAssigneeId, supabase) {
  try {
    // Only notify if there's a new assignee
    if (!ticket.assignee_id || ticket.assignee_id === previousAssigneeId) {
      return;
    }
    
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: ticket.assignee_id,
        type: 'ticket_assigned',
        title: `Assigned to ticket #${ticket.ticket_number}`,
        message: `You've been assigned to: ${ticket.title}`,
        related_ticket_id: ticket.id,
        is_read: false,
        scheduled_for: new Date().toISOString()
      });
    
    if (error) {
      console.error('❌ Error creating assignment notification:', error);
      throw error;
    }
    
    console.log(`✅ Created assignment notification for ticket #${ticket.ticket_number}`);
  } catch (error) {
    console.error('❌ Error in createTicketAssignmentNotification:', error);
    throw error;
  }
}

/**
 * Create in-app notification when ticket is archived
 */
async function createTicketArchivedNotification(ticket, supabase) {
  try {
    // Only notify reporter
    if (!ticket.reporter_id || ticket.reporter_id === 'anonymous') {
      console.log('📧 No reporter ID for archive notification');
      return;
    }
    
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: ticket.reporter_id,
        type: 'ticket_archived',
        title: `Ticket #${ticket.ticket_number} has been archived`,
        message: `Your ticket "${ticket.title}" has been archived before completion`,
        related_ticket_id: ticket.id,
        is_read: false,
        scheduled_for: new Date().toISOString()
      });
    
    if (error) {
      console.error('❌ Error creating archive notification:', error);
      throw error;
    }
    
    console.log(`✅ Created archive notification for ticket #${ticket.ticket_number}`);
  } catch (error) {
    console.error('❌ Error in createTicketArchivedNotification:', error);
    throw error;
  }
}

/**
 * Send email notification when ticket is archived before completion
 */
async function sendTicketArchivedNotification(ticket, supabase) {
  try {
    // Get reporter email
    let reporterEmail = null;
    let reporterName = null;

    if (ticket.reporter_id && ticket.reporter_id !== 'anonymous') {
      const { data: reporterProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', ticket.reporter_id)
        .single();
      
      if (reporterProfile) {
        reporterEmail = reporterProfile.email;
        reporterName = reporterProfile.full_name || reporterProfile.email;
      }
    } else if (ticket.reporter_email) {
      reporterEmail = ticket.reporter_email;
      reporterName = ticket.reporter_email;
    }

    if (!reporterEmail) {
      console.log('📧 No reporter email found for archive notification');
      return;
    }

    const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://lecrm.vercel.app'}/tickets/${ticket.id}`;
    
    const subject = `Ticket #${ticket.ticket_number} has been archived`;
    const body = `Your ticket has been archived:

**Ticket:** #${ticket.ticket_number} - ${ticket.title}

**Status:** ${ticket.status || 'Open'}

This ticket has been archived before completion. If you believe this was done in error, please contact support.

---

View this ticket: ${ticketUrl}`;

    await sendEmail(reporterEmail, subject, body, 'LECRM Tickets');
    console.log(`✅ Archive notification sent to ${reporterEmail}`);
  } catch (error) {
    console.error('❌ Error in sendTicketArchivedNotification:', error);
    throw error;
  }
}

/**
 * Send email notification when ticket status changes
 */
async function sendTicketStatusChangeNotification(ticket, previousStatus, supabase) {
  try {
    // Get reporter email
    let reporterEmail = null;
    let reporterName = null;

    if (ticket.reporter_id && ticket.reporter_id !== 'anonymous') {
      const { data: reporterProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', ticket.reporter_id)
        .single();
      
      if (reporterProfile) {
        reporterEmail = reporterProfile.email;
        reporterName = reporterProfile.full_name || reporterProfile.email;
      }
    } else if (ticket.reporter_email) {
      reporterEmail = ticket.reporter_email;
      reporterName = ticket.reporter_email;
    }

    if (!reporterEmail) {
      console.log('📧 No reporter email found for status change notification');
      return;
    }

    const statusLabels = {
      'open': 'Open',
      'in_progress': 'In Progress',
      'resolved': 'Resolved',
      'closed': 'Closed'
    };

    const previousStatusLabel = statusLabels[previousStatus] || previousStatus;
    const newStatusLabel = statusLabels[ticket.status] || ticket.status;
    const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://lecrm.vercel.app'}/tickets/${ticket.id}`;
    
    const subject = `Ticket #${ticket.ticket_number} status updated: ${newStatusLabel}`;
    const body = `Your ticket status has been updated:

**Ticket:** #${ticket.ticket_number} - ${ticket.title}

**Status changed from:** ${previousStatusLabel}
**Status changed to:** ${newStatusLabel}

---

View this ticket: ${ticketUrl}`;

    await sendEmail(reporterEmail, subject, body, 'LECRM Tickets');
    console.log(`✅ Status change notification sent to ${reporterEmail}`);
  } catch (error) {
    console.error('❌ Error in sendTicketStatusChangeNotification:', error);
    throw error;
  }
}

/**
 * Send email notification when ticket is assigned
 */
async function sendTicketAssignmentNotification(ticket, previousAssigneeId, supabase) {
  try {
    // Only notify if there's a new assignee
    if (!ticket.assignee_id || ticket.assignee_id === previousAssigneeId) {
      return;
    }

    // Get assignee email
    const { data: assigneeProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', ticket.assignee_id)
      .single();

    if (!assigneeProfile?.email) {
      console.log('📧 No assignee email found for assignment notification');
      return;
    }

    const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://lecrm.vercel.app'}/tickets/${ticket.id}`;
    
    const subject = `You've been assigned to ticket #${ticket.ticket_number}`;
    const body = `You have been assigned to a ticket:

**Ticket:** #${ticket.ticket_number} - ${ticket.title}

**Priority:** ${ticket.priority || 'Medium'}
**Status:** ${ticket.status || 'Open'}

**Description:**
${ticket.description?.substring(0, 500) || 'No description provided'}${ticket.description?.length > 500 ? '...' : ''}

---

View and respond to this ticket: ${ticketUrl}`;

    await sendEmail(assigneeProfile.email, subject, body, 'LECRM Tickets');
    console.log(`✅ Assignment notification sent to ${assigneeProfile.email}`);
  } catch (error) {
    console.error('❌ Error in sendTicketAssignmentNotification:', error);
    throw error;
  }
}

