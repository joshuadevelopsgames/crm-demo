/**
 * API endpoint for ticket comments
 */

import { createClient } from '@supabase/supabase-js';

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
    'https://lecrm-dev.vercel.app',
    'https://lecrm-stg.vercel.app',
    'https://lecrm.vercel.app'
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

      return res.status(200).json({
        success: true,
        comments: visibleComments
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

