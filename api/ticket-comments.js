/**
 * API endpoint for ticket comments
 */

import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './utils/emailService.js';

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

export default async function handler(req, res) {
  // CORS headers
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app',
    'https://crm-demo.vercel.app'
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

    // POST /api/ticket-comments - Create comment
    if (req.method === 'POST') {
      const { ticket_id, comment, is_internal } = req.body;

      if (!ticket_id || !comment) {
        return res.status(400).json({ 
          success: false, 
          error: 'Ticket ID and comment are required' 
        });
      }

      // Verify ticket exists and user has access
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticket_id)
        .single();

      if (ticketError || !ticket) {
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

      // Only admins can create internal comments
      const internal = isAdmin ? (is_internal || false) : false;

      // Get commenter's profile info
      const { data: commenterProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single();

      const { data: newComment, error } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id,
          user_id: userId,
          comment,
          is_internal: internal
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating comment:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to create comment' 
        });
      }

      // Send email notifications (non-blocking)
      // Don't notify for internal comments
      if (!internal) {
        sendTicketCommentNotification(ticket, comment, commenterProfile, supabase).catch(err => {
          console.error('❌ Error sending comment notification email:', err);
          // Don't fail the request if email fails
        });
        
        // Create in-app notifications (non-blocking)
        createTicketCommentNotifications(ticket, comment, commenterProfile, userId, supabase).catch(err => {
          console.error('❌ Error creating comment notifications:', err);
          // Don't fail the request if notification creation fails
        });
      }

      return res.status(201).json({
        success: true,
        comment: newComment
      });
    }

    // GET /api/ticket-comments?ticket_id=xxx - Get comments for a ticket
    if (req.method === 'GET') {
      const { ticket_id } = req.query;

      if (!ticket_id) {
        return res.status(400).json({ 
          success: false, 
          error: 'Ticket ID is required' 
        });
      }

      // Verify ticket exists and user has access
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticket_id)
        .single();

      if (ticketError || !ticket) {
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

      const { data: comments, error } = await supabase
        .from('ticket_comments')
        .select('*')
        .eq('ticket_id', ticket_id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error fetching comments:', error);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch comments' 
        });
      }

      // Filter comments based on permissions
      const visibleComments = isAdmin 
        ? comments || []
        : (comments || []).filter(c => !c.is_internal);

      // Get commenter profiles for all comments
      const commentsWithProfiles = await Promise.all(
        (visibleComments || []).map(async (comment) => {
          let commenterProfile = null;
          if (comment.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, email, full_name')
              .eq('id', comment.user_id)
              .single();
            
            if (profile) {
              commenterProfile = profile;
            }
          }
          
          return {
            ...comment,
            commenter_profile: commenterProfile
          };
        })
      );

      return res.status(200).json({
        success: true,
        comments: commentsWithProfiles
      });
    }

    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });

  } catch (error) {
    console.error('❌ Error in ticket-comments API:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}

/**
 * Create in-app notifications when a comment is added to a ticket
 */
async function createTicketCommentNotifications(ticket, comment, commenterProfile, commenterId, supabase) {
  try {
    const commenterName = commenterProfile?.full_name || commenterProfile?.email || 'Someone';
    const commentPreview = comment.length > 100 ? comment.substring(0, 100) + '...' : comment;
    
    // Get reporter and assignee user IDs
    const usersToNotify = [];
    
    // Add reporter if different from commenter
    if (ticket.reporter_id && ticket.reporter_id !== 'anonymous' && ticket.reporter_id !== commenterId) {
      usersToNotify.push(ticket.reporter_id);
    }
    
    // Add assignee if different from commenter and reporter
    if (ticket.assignee_id && 
        ticket.assignee_id !== commenterId && 
        ticket.assignee_id !== ticket.reporter_id &&
        !usersToNotify.includes(ticket.assignee_id)) {
      usersToNotify.push(ticket.assignee_id);
    }
    
    if (usersToNotify.length === 0) {
      console.log('📧 No users to notify for comment (commenter is the only participant)');
      return;
    }
    
    // Create notifications for each user
    const notifications = usersToNotify.map(userId => ({
      user_id: userId,
      type: 'ticket_comment',
      title: `New comment on ticket #${ticket.ticket_number}`,
      message: `${commenterName} commented: "${commentPreview}"`,
      related_ticket_id: ticket.id,
      is_read: false,
      scheduled_for: new Date().toISOString()
    }));
    
    const { error } = await supabase
      .from('notifications')
      .insert(notifications);
    
    if (error) {
      console.error('❌ Error creating comment notifications:', error);
      throw error;
    }
    
    console.log(`✅ Created ${notifications.length} comment notification(s)`);
  } catch (error) {
    console.error('❌ Error in createTicketCommentNotifications:', error);
    throw error;
  }
}

/**
 * Send email notification when a comment is added to a ticket
 */
async function sendTicketCommentNotification(ticket, comment, commenterProfile, supabase) {
  try {
    // Get reporter and assignee emails
    const emailsToNotify = [];
    const namesToNotify = [];

    // Get reporter email
    if (ticket.reporter_id && ticket.reporter_id !== 'anonymous') {
      const { data: reporterProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', ticket.reporter_id)
        .single();
      
      if (reporterProfile?.email && reporterProfile.email !== commenterProfile?.email) {
        emailsToNotify.push(reporterProfile.email);
        namesToNotify.push(reporterProfile.full_name || reporterProfile.email);
      }
    } else if (ticket.reporter_email && ticket.reporter_email !== commenterProfile?.email) {
      emailsToNotify.push(ticket.reporter_email);
      namesToNotify.push(ticket.reporter_email);
    }

    // Get assignee email (if different from reporter and commenter)
    if (ticket.assignee_id && ticket.assignee_id !== ticket.reporter_id) {
      const { data: assigneeProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', ticket.assignee_id)
        .single();
      
      if (assigneeProfile?.email && 
          assigneeProfile.email !== commenterProfile?.email && 
          !emailsToNotify.includes(assigneeProfile.email)) {
        emailsToNotify.push(assigneeProfile.email);
        namesToNotify.push(assigneeProfile.full_name || assigneeProfile.email);
      }
    }

    if (emailsToNotify.length === 0) {
      console.log('📧 No emails to notify for comment (commenter is the only participant)');
      return;
    }

    const commenterName = commenterProfile?.full_name || commenterProfile?.email || 'Someone';
    const ticketUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://crm-demo.vercel.app'}/tickets/${ticket.id}`;
    
    const subject = `New comment on ticket #${ticket.ticket_number}`;
    const body = `A new comment has been added to your ticket:

**Ticket:** #${ticket.ticket_number} - ${ticket.title}

**Comment by:** ${commenterName}

**Comment:**
${comment}

---

View and respond to this ticket: ${ticketUrl}`;

    // Send to all recipients
    for (const email of emailsToNotify) {
      try {
        await sendEmail(email, subject, body, 'CRM Tickets');
        console.log(`✅ Comment notification sent to ${email}`);
      } catch (emailError) {
        console.error(`❌ Failed to send comment notification to ${email}:`, emailError.message);
        // Continue with other emails even if one fails
      }
    }
  } catch (error) {
    console.error('❌ Error in sendTicketCommentNotification:', error);
    throw error;
  }
}

