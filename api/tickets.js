/**
 * API endpoint for ticket management
 * Supports CRUD operations for tickets and comments
 */

import { createClient } from '@supabase/supabase-js';

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
        query = query.or(`reporter_id.eq.${userId},assignee_id.eq.${userId}`);
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
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to fetch tickets' 
        });
      }

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

        // Non-admins cannot change status, assignee, or priority
        delete updates.status;
        delete updates.assignee_id;
        delete updates.priority;
      }

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

      return res.status(200).json({
        success: true,
        ticket
      });
    }

    // DELETE /api/tickets/:id - Delete ticket (admin only)
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

