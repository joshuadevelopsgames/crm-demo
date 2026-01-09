import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Ticket,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Filter,
  ArrowRight,
  User,
  Mail,
  Archive,
  Loader2
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from '@/contexts/UserContext';
import { getSupabaseAuth } from '@/services/supabaseClient';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Tickets() {
  const navigate = useNavigate();
  const { user, isLoading: userLoading, isAdmin } = useUser();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');

  // Redirect if not admin
  React.useEffect(() => {
    if (!userLoading && !isAdmin) {
      navigate(createPageUrl('MyTickets'));
    }
  }, [userLoading, isAdmin, navigate]);

  // Get auth token for API calls
  const getAuthToken = async () => {
    const supabase = getSupabaseAuth();
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // Fetch all tickets (admin only)
  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) return [];

      const response = await fetch(`/api/tickets`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('❌ Failed to fetch tickets:', response.status);
        return [];
      }

      const result = await response.json();
      return result.success ? (result.tickets || []) : [];
    },
    enabled: !userLoading && isAdmin
  });

  // Archive ticket mutation
  const archiveTicketMutation = useMutation({
    mutationFn: async (ticketId) => {
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
      refetch();
      queryClient.invalidateQueries(['tickets']);
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to archive ticket');
    }
  });

  // Fetch all users for assignee filter
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
    enabled: !userLoading && isAdmin
  });

  // Group tickets by status/archived
  const ticketsByStatus = useMemo(() => {
    const grouped = {
      all: [],
      open: [],
      in_progress: [],
      resolved: [],
      archived: []
    };

    tickets.forEach(ticket => {
      const isArchived = !!ticket.archived_at;
      if (isArchived) {
        grouped.archived.push(ticket);
      } else {
        grouped.all.push(ticket);
        if (ticket.status === 'open') {
          grouped.open.push(ticket);
        } else if (ticket.status === 'in_progress') {
          grouped.in_progress.push(ticket);
        } else if (ticket.status === 'resolved' || ticket.status === 'closed') {
          grouped.resolved.push(ticket);
        }
      }
    });

    return grouped;
  }, [tickets]);

  // Filter and search tickets based on active tab
  const filteredTickets = useMemo(() => {
    let filtered = ticketsByStatus[activeTab] || [];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ticket =>
        ticket.ticket_number?.toLowerCase().includes(query) ||
        ticket.title?.toLowerCase().includes(query) ||
        ticket.description?.toLowerCase().includes(query) ||
        ticket.reporter_email?.toLowerCase().includes(query) ||
        ticket.reporter_profile?.full_name?.toLowerCase().includes(query) ||
        ticket.reporter_profile?.email?.toLowerCase().includes(query)
      );
    }

    // Additional filters (priority, assignee)
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(ticket => ticket.priority === priorityFilter);
    }
    if (assigneeFilter !== 'all') {
      filtered = filtered.filter(ticket => 
        assigneeFilter === 'unassigned' 
          ? !ticket.assignee_id 
          : ticket.assignee_id === assigneeFilter
      );
    }

    return filtered;
  }, [ticketsByStatus, activeTab, searchQuery, priorityFilter, assigneeFilter]);

  // Get status badge styling
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

  // Get priority badge styling
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

  // Statistics
  const stats = useMemo(() => {
    const nonArchived = tickets.filter(t => !t.archived_at);
    return {
      total: nonArchived.length,
      open: nonArchived.filter(t => t.status === 'open').length,
      in_progress: nonArchived.filter(t => t.status === 'in_progress').length,
      resolved: nonArchived.filter(t => t.status === 'resolved' || t.status === 'closed').length,
      archived: tickets.filter(t => !!t.archived_at).length
    };
  }, [tickets]);

  const handleArchive = (ticketId, e) => {
    e.stopPropagation(); // Prevent navigation
    if (window.confirm('Are you sure you want to archive this ticket? The reporter will be notified if the ticket is not completed.')) {
      archiveTicketMutation.mutate(ticketId);
    }
  };

  if (!isAdmin) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-foreground">Tickets</h1>
          <p className="text-slate-600 mt-1">
            {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
          </p>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">Total</div>
            <div className="text-2xl font-bold text-slate-900 dark:text-foreground">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">Open</div>
            <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">In Progress</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.in_progress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">Resolved</div>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-48">
              <User className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full justify-start bg-white dark:bg-surface-1 border-b dark:border-border rounded-none h-auto p-0 space-x-0">
          <TabsTrigger 
            value="all" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent px-6 py-3"
          >
            All ({ticketsByStatus.all.length})
          </TabsTrigger>
          <TabsTrigger 
            value="open"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent px-6 py-3"
          >
            Open ({ticketsByStatus.open.length})
          </TabsTrigger>
          <TabsTrigger 
            value="in_progress"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent px-6 py-3"
          >
            In Progress ({ticketsByStatus.in_progress.length})
          </TabsTrigger>
          <TabsTrigger 
            value="resolved"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent px-6 py-3"
          >
            Resolved ({ticketsByStatus.resolved.length})
          </TabsTrigger>
          <TabsTrigger 
            value="archived"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-slate-900 data-[state=active]:bg-transparent px-6 py-3"
          >
            Archived ({ticketsByStatus.archived.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0 space-y-4">
          {/* Tickets List */}
          {isLoading ? (
            <Card className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-600 mt-4">Loading tickets...</p>
            </Card>
          ) : filteredTickets.length === 0 ? (
            <Card className="p-12 text-center">
              <Ticket className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No tickets found</h3>
              <p className="text-slate-600">Try adjusting your filters</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => {
                const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';
                const isArchived = !!ticket.archived_at;
                
                return (
                  <Card
                    key={ticket.id}
                    className={`
                      hover:shadow-lg transition-all cursor-pointer
                      ${isResolved 
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                        : isArchived
                        ? 'bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 opacity-60'
                        : 'bg-white dark:bg-surface-1'
                      }
                    `}
                    onClick={() => navigate(createPageUrl(`TicketDetail?id=${ticket.id}`))}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <span className={`font-semibold ${isArchived ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-foreground'}`}>
                              {ticket.ticket_number}
                            </span>
                            {getStatusBadge(ticket.status)}
                            {getPriorityBadge(ticket.priority)}
                            {isArchived && (
                              <Badge className="bg-amber-500 text-white">Archived</Badge>
                            )}
                          </div>
                      <h3 className={`font-semibold text-lg mb-1 ${
                        isResolved 
                          ? 'text-green-900 dark:text-green-200' 
                          : isArchived
                          ? 'text-slate-500 dark:text-slate-400'
                          : 'text-slate-900 dark:text-foreground'
                      }`}>
                        {ticket.title}
                      </h3>
                      <p className={`text-sm line-clamp-2 mb-3 ${
                        isResolved 
                          ? 'text-green-700 dark:text-green-300' 
                          : isArchived
                          ? 'text-slate-400 dark:text-slate-500'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}>
                        {ticket.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {ticket.reporter_profile 
                            ? (ticket.reporter_profile.full_name || ticket.reporter_profile.email || 'Unknown User')
                            : (ticket.reporter_email || 'Anonymous')
                          }
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {getUserName(ticket.assignee_id)}
                        </span>
                        <span>
                          Created {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                        </span>
                        {ticket.resolved_at && (
                          <span className="text-green-600 dark:text-green-400">
                            Resolved {format(new Date(ticket.resolved_at), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isArchived && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleArchive(ticket.id, e)}
                          disabled={archiveTicketMutation.isPending}
                          className="flex-shrink-0"
                          title="Archive ticket"
                        >
                          {archiveTicketMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <ArrowRight className={`h-5 w-5 flex-shrink-0 ${
                        isResolved 
                          ? 'text-green-600 dark:text-green-400' 
                          : isArchived
                          ? 'text-slate-400 dark:text-slate-500'
                          : 'text-slate-400'
                      }`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

