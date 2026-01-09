import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Ticket,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Filter,
  ArrowRight
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { getSupabaseAuth } from '@/services/supabaseClient';
import { format } from 'date-fns';

export default function MyTickets() {
  const navigate = useNavigate();
  const { user, isLoading: userLoading } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Get auth token for API calls
  const getAuthToken = async () => {
    const supabase = getSupabaseAuth();
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // Fetch tickets
  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ['my-tickets', statusFilter, priorityFilter],
    queryFn: async () => {
      const token = await getAuthToken();
      if (!token) return [];

      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (priorityFilter !== 'all') {
        params.append('priority', priorityFilter);
      }

      const response = await fetch(`/api/tickets?${params.toString()}`, {
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
    enabled: !userLoading && !!user
  });

  // Filter and search tickets
  const filteredTickets = useMemo(() => {
    let filtered = tickets;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ticket =>
        ticket.ticket_number?.toLowerCase().includes(query) ||
        ticket.title?.toLowerCase().includes(query) ||
        ticket.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [tickets, searchQuery]);

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

  // Get status icon
  const getStatusIcon = (status) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'open':
        return <AlertCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <Ticket className="h-5 w-5 text-slate-500" />;
    }
  };

  // Group tickets by status for tabs
  const ticketsByStatus = useMemo(() => {
    return {
      all: filteredTickets,
      open: filteredTickets.filter(t => t.status === 'open'),
      in_progress: filteredTickets.filter(t => t.status === 'in_progress'),
      resolved: filteredTickets.filter(t => t.status === 'resolved' || t.status === 'closed')
    };
  }, [filteredTickets]);

  const [activeTab, setActiveTab] = useState('all');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-foreground">My Tickets</h1>
          <p className="text-slate-600 mt-1">
            {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
          </p>
        </div>
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
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
        </TabsList>

        <TabsContent value={activeTab} className="mt-0 space-y-4">
          {isLoading ? (
            <Card className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-slate-600 mt-4">Loading tickets...</p>
            </Card>
          ) : ticketsByStatus[activeTab]?.length === 0 ? (
            <Card className="p-12 text-center">
              <Ticket className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No tickets found</h3>
              <p className="text-slate-600">
                {activeTab === 'all' 
                  ? 'You haven\'t submitted any bug reports yet.'
                  : `No ${activeTab.replace('_', ' ')} tickets found.`
                }
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {ticketsByStatus[activeTab].map((ticket) => {
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
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 opacity-75'
                        : 'bg-white dark:bg-surface-1'
                      }
                    `}
                    onClick={() => navigate(createPageUrl(`TicketDetail?id=${ticket.id}`))}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusIcon(ticket.status)}
                            <span className="font-semibold text-slate-900 dark:text-foreground">
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
                              : 'text-slate-900 dark:text-foreground'
                          }`}>
                            {ticket.title}
                          </h3>
                          <p className={`text-sm line-clamp-2 mb-3 ${
                            isResolved 
                              ? 'text-green-700 dark:text-green-300' 
                              : 'text-slate-600 dark:text-slate-400'
                          }`}>
                            {ticket.description}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
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
                        <ArrowRight className={`h-5 w-5 flex-shrink-0 ${
                          isResolved 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-slate-400'
                        }`} />
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

