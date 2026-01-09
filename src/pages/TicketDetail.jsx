import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Ticket,
  ArrowLeft,
  CheckCircle,
  Clock,
  AlertCircle,
  User,
  Mail,
  MessageSquare,
  Save,
  Loader2,
  ChevronRight,
  Archive,
  Trash2
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { getSupabaseAuth } from '@/services/supabaseClient';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function TicketDetail() {
  const navigate = useNavigate();
  const { user, isLoading: userLoading, isAdmin } = useUser();
  const queryClient = useQueryClient();
  
  // Get ticket ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const ticketId = urlParams.get('id');
  
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [status, setStatus] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  // Get auth token for API calls
  const getAuthToken = async () => {
    const supabase = getSupabaseAuth();
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // Fetch ticket details
  const { data: ticketData, isLoading: ticketLoading, refetch: refetchTicket } = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token || !ticketId) return null;

      const response = await fetch(`/api/tickets?id=${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('You do not have access to this ticket');
          navigate(createPageUrl('MyTickets'));
          return null;
        }
        if (response.status === 404) {
          toast.error('Ticket not found');
          navigate(createPageUrl('MyTickets'));
          return null;
        }
        return null;
      }

      const result = await response.json();
      return result.success ? result.ticket : null;
    },
    enabled: !userLoading && !!ticketId
  });

  // Fetch users for assignment (admin only)
  const { data: users = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) return [];

      const response = await fetch('/api/data/profiles', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    },
    enabled: isAdmin
  });

  // Initialize form when ticket loads
  React.useEffect(() => {
    if (ticketData) {
      setStatus(ticketData.status);
      setAssigneeId(ticketData.assignee_id || '');
    }
  }, [ticketData]);

  // Update ticket mutation
  const updateTicketMutation = useMutation({
    mutationFn: async (updates) => {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/tickets?id=${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update ticket');
      }

      const result = await response.json();
      return result.ticket;
    },
    onSuccess: () => {
      toast.success('Ticket updated successfully');
      refetchTicket();
      queryClient.invalidateQueries(['tickets']);
      queryClient.invalidateQueries(['my-tickets']);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update ticket');
    }
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (comment) => {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/ticket-comments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticket_id: ticketId,
          comment: comment,
          is_internal: isInternal
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to add comment');
      }

      const result = await response.json();
      return result.comment;
    },
    onSuccess: () => {
      toast.success('Comment added');
      setNewComment('');
      setIsInternal(false);
      refetchTicket();
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to add comment');
    }
  });

  // Archive ticket mutation
  const archiveTicketMutation = useMutation({
    mutationFn: async () => {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/tickets?id=${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          archived_at: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to archive ticket');
      }

      const result = await response.json();
      return result.ticket;
    },
    onSuccess: () => {
      toast.success('Ticket archived successfully');
      refetchTicket();
      queryClient.invalidateQueries(['tickets']);
      queryClient.invalidateQueries(['my-tickets']);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to archive ticket');
    }
  });

  // Unarchive ticket mutation
  const unarchiveTicketMutation = useMutation({
    mutationFn: async () => {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/tickets?id=${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          archived_at: null
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to unarchive ticket');
      }

      const result = await response.json();
      return result.ticket;
    },
    onSuccess: () => {
      toast.success('Ticket unarchived successfully');
      refetchTicket();
      queryClient.invalidateQueries(['tickets']);
      queryClient.invalidateQueries(['my-tickets']);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to unarchive ticket');
    }
  });

  // Delete ticket mutation
  const deleteTicketMutation = useMutation({
    mutationFn: async () => {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`/api/tickets?id=${ticketId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete ticket');
      }

      return true;
    },
    onSuccess: () => {
      toast.success('Ticket deleted successfully');
      navigate(isAdmin ? createPageUrl('Tickets') : createPageUrl('MyTickets'));
      queryClient.invalidateQueries(['tickets']);
      queryClient.invalidateQueries(['my-tickets']);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete ticket');
    }
  });

  const handleSaveChanges = () => {
    const updates = {};
    if (status !== ticketData.status) {
      updates.status = status;
    }
    if (assigneeId !== (ticketData.assignee_id || '')) {
      updates.assignee_id = assigneeId || null;
    }
    
    if (Object.keys(updates).length > 0) {
      updateTicketMutation.mutate(updates);
    }
  };

  const handleArchive = () => {
    if (window.confirm('Are you sure you want to archive this ticket? The reporter will be notified if the ticket is not completed.')) {
      archiveTicketMutation.mutate();
    }
  };

  const handleUnarchive = () => {
    if (window.confirm('Are you sure you want to unarchive this ticket?')) {
      unarchiveTicketMutation.mutate();
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to permanently delete this archived ticket? This action cannot be undone.')) {
      deleteTicketMutation.mutate();
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    addCommentMutation.mutate(newComment.trim());
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const styles = {
      open: { bg: 'bg-blue-500', text: 'text-white', label: 'Open' },
      in_progress: { bg: 'bg-yellow-500', text: 'text-white', label: 'In Progress' },
      resolved: { bg: 'bg-green-500', text: 'text-white', label: 'Resolved' },
      closed: { bg: 'bg-gray-500', text: 'text-white', label: 'Closed' }
    };
    const style = styles[status] || styles.open;
    return <Badge className={`${style.bg} ${style.text}`}>{style.label}</Badge>;
  };

  // Get priority badge
  const getPriorityBadge = (priority) => {
    const styles = {
      low: { bg: 'bg-green-100', text: 'text-green-700', label: 'Low' },
      medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Medium' },
      high: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High' },
      critical: { bg: 'bg-red-100', text: 'text-red-700', label: 'Critical' }
    };
    const style = styles[priority] || styles.medium;
    return <Badge variant="outline" className={`${style.bg} ${style.text} border-0`}>{style.label}</Badge>;
  };

  // Get user name by ID
  const getUserName = (userId) => {
    if (!userId) return 'Unassigned';
    const user = users.find(u => u.id === userId);
    return user?.full_name || user?.email || 'Unknown';
  };

  if (ticketLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!ticketData) {
    return (
      <Card className="p-12 text-center">
        <Ticket className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">Ticket not found</h3>
        <Button onClick={() => navigate(createPageUrl('MyTickets'))} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Tickets
        </Button>
      </Card>
    );
  }

  const isResolved = ticketData.status === 'resolved' || ticketData.status === 'closed';
  const canEdit = isAdmin || ticketData.reporter_id === user?.id;
  const isArchived = !!ticketData.archived_at;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate(isAdmin ? createPageUrl('Tickets') : createPageUrl('MyTickets'))}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-foreground">
              {ticketData.ticket_number}
            </h1>
            {getStatusBadge(ticketData.status)}
            {getPriorityBadge(ticketData.priority)}
          </div>
          <p className="text-slate-600 mt-1">{ticketData.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card className={isResolved ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : ''}>
            <CardHeader>
              <CardTitle className={isResolved ? 'text-green-900 dark:text-green-200' : ''}>
                Description
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`whitespace-pre-wrap ${isResolved ? 'text-green-700 dark:text-green-300' : 'text-slate-700 dark:text-slate-300'}`}>
                {ticketData.description}
              </p>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticketData.comments && ticketData.comments.length > 0 ? (
                ticketData.comments.map((comment) => {
                  const commentUser = users.find(u => u.id === comment.user_id);
                  const isCommentUser = comment.user_id === user?.id;
                  
                  return (
                    <div key={comment.id} className="border-l-4 border-blue-500 pl-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-slate-500" />
                          <span className="font-medium text-sm">
                            {commentUser?.full_name || commentUser?.email || 'Unknown User'}
                          </span>
                          {comment.is_internal && (
                            <Badge variant="outline" className="text-xs">Internal</Badge>
                          )}
                        </div>
                        <span className="text-xs text-slate-500">
                          {format(new Date(comment.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {comment.comment}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">No comments yet</p>
              )}

              {/* Add Comment */}
              {canEdit && (
                <div className="pt-4 border-t">
                  <Label htmlFor="comment" className="mb-2 block">Add Comment</Label>
                  <Textarea
                    id="comment"
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    className="mb-2"
                  />
                  {isAdmin && (
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="internal"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor="internal" className="text-sm text-slate-600">
                        Internal (only visible to admins)
                      </Label>
                    </div>
                  )}
                  <Button
                    onClick={handleAddComment}
                    disabled={addCommentMutation.isPending || !newComment.trim()}
                    size="sm"
                  >
                    {addCommentMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Add Comment
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bug Report Data (if available) */}
          {ticketData.bug_report_data && (
            <Card>
              <CardHeader>
                <CardTitle>Bug Report Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ticketData.bug_report_data.selectedElement && (
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Selected Element</Label>
                    <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                      <div><strong>Tag:</strong> {ticketData.bug_report_data.selectedElement.tagName}</div>
                      {ticketData.bug_report_data.selectedElement.id && (
                        <div><strong>ID:</strong> {ticketData.bug_report_data.selectedElement.id}</div>
                      )}
                      {ticketData.bug_report_data.selectedElement.className && (
                        <div><strong>Class:</strong> {ticketData.bug_report_data.selectedElement.className.substring(0, 100)}</div>
                      )}
                    </div>
                  </div>
                )}
                {ticketData.bug_report_data.userInfo && (
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Environment</Label>
                    <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                      <div><strong>URL:</strong> {ticketData.bug_report_data.userInfo.url}</div>
                      <div><strong>Viewport:</strong> {ticketData.bug_report_data.userInfo.viewport?.width}x{ticketData.bug_report_data.userInfo.viewport?.height}</div>
                      <div><strong>User Agent:</strong> {ticketData.bug_report_data.userInfo.userAgent?.substring(0, 100)}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ticket Info */}
          <Card>
            <CardHeader>
              <CardTitle>Ticket Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-1 block">Status</Label>
                {isAdmin ? (
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="pt-2">{getStatusBadge(ticketData.status)}</div>
                )}
              </div>

              <div>
                <Label className="text-sm font-semibold mb-1 block">Priority</Label>
                <div className="pt-2">{getPriorityBadge(ticketData.priority)}</div>
              </div>

              {isAdmin && (
                <div>
                  <Label className="text-sm font-semibold mb-1 block">Assignee</Label>
                  <Select value={assigneeId || 'unassigned'} onValueChange={(value) => setAssigneeId(value === 'unassigned' ? '' : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {ticketData.assignee_id && (
                <div>
                  <Label className="text-sm font-semibold mb-1 block">Assigned To</Label>
                  <div className="pt-2 text-sm text-slate-600 dark:text-slate-400">
                    {getUserName(ticketData.assignee_id)}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold mb-1 block">Reporter</Label>
                <div className="pt-2 text-sm text-slate-600 dark:text-slate-400">
                  {ticketData.reporter_profile ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        <span className="font-medium">
                          {ticketData.reporter_profile.full_name || 'Unknown User'}
                        </span>
                      </div>
                      {ticketData.reporter_profile.email && (
                        <div className="flex items-center gap-2 ml-5">
                          <Mail className="h-3 w-3" />
                          <span>{ticketData.reporter_profile.email}</span>
                        </div>
                      )}
                    </div>
                  ) : ticketData.reporter_email ? (
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <span>{ticketData.reporter_email}</span>
                    </div>
                  ) : ticketData.reporter_id && ticketData.reporter_id !== 'anonymous' ? (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>User ID: {ticketData.reporter_id.substring(0, 8)}...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>Anonymous</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold mb-1 block">Created</Label>
                <div className="pt-2 text-sm text-slate-600 dark:text-slate-400">
                  {format(new Date(ticketData.created_at), 'MMM d, yyyy h:mm a')}
                </div>
              </div>

              {ticketData.resolved_at && (
                <div>
                  <Label className="text-sm font-semibold mb-1 block">Resolved</Label>
                  <div className="pt-2 text-sm text-green-600 dark:text-green-400">
                    {format(new Date(ticketData.resolved_at), 'MMM d, yyyy h:mm a')}
                  </div>
                </div>
              )}

              {isAdmin && (status !== ticketData.status || (assigneeId || '') !== (ticketData.assignee_id || '')) && (
                <Button
                  onClick={handleSaveChanges}
                  disabled={updateTicketMutation.isPending}
                  className="w-full"
                >
                  {updateTicketMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              )}

              {/* Archive/Delete Actions (Admin only) */}
              {isAdmin && (
                <div className="pt-4 border-t space-y-2">
                  {isArchived ? (
                    <div className="space-y-2">
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        Archived on {format(new Date(ticketData.archived_at), 'MMM d, yyyy h:mm a')}
                      </div>
                      <Button
                        onClick={handleUnarchive}
                        disabled={unarchiveTicketMutation.isPending}
                        variant="outline"
                        className="w-full"
                      >
                        {unarchiveTicketMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Unarchiving...
                          </>
                        ) : (
                          <>
                            <Archive className="h-4 w-4 mr-2" />
                            Unarchive Ticket
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleDelete}
                        disabled={deleteTicketMutation.isPending}
                        variant="destructive"
                        className="w-full"
                      >
                        {deleteTicketMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Ticket
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={handleArchive}
                      disabled={archiveTicketMutation.isPending}
                      variant="outline"
                      className="w-full"
                    >
                      {archiveTicketMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Archiving...
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive Ticket
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

