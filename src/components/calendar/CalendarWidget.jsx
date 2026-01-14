import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, Clock, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchCalendarEvents, isCalendarConnected } from '@/services/calendarService';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

export default function CalendarWidget() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  // Check connection status - use React Query to cache and auto-refresh
  const { data: connectionStatus } = useQuery({
    queryKey: ['calendar-connection-status'],
    queryFn: async () => {
      console.log('🔍 CalendarWidget: Checking connection status...');
      const connected = await isCalendarConnected();
      console.log('📊 CalendarWidget: Connection status:', connected);
      return connected;
    },
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    staleTime: 30 * 1000, // 30 seconds
    retry: 3,
    retryDelay: 2000
  });

  React.useEffect(() => {
    if (connectionStatus !== undefined) {
      console.log('✅ CalendarWidget: Setting connection state to:', connectionStatus);
      setIsConnected(connectionStatus);
    }
  }, [connectionStatus]);

  // Fetch calendar events for the current week
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });

  const { data: eventsData, isLoading, error: eventsError, refetch: refetchCalendarEvents } = useQuery({
    queryKey: ['calendar-events', weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: async () => {
      try {
        const result = await fetchCalendarEvents({
          timeMin: weekStart.toISOString(),
          timeMax: weekEnd.toISOString(),
          maxResults: 50
        });
        return result.items || [];
      } catch (error) {
        console.error('Error fetching calendar events:', error);
        // If it's an authentication scope error, mark as not connected
        if (error.message?.includes('insufficient authentication scopes') || 
            error.message?.includes('403')) {
          setIsConnected(false);
        }
        throw error; // Re-throw to let React Query handle it
      }
    },
    enabled: isConnected,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on auth errors
  });

  // Handle refresh button click
  const handleRefresh = async () => {
    if (!isConnected) {
      toast.error('Calendar not connected');
      return;
    }
    
    try {
      // Invalidate and refetch calendar events
      await queryClient.invalidateQueries({ 
        queryKey: ['calendar-events'] 
      });
      await refetchCalendarEvents();
      toast.success('Calendar events refreshed');
    } catch (error) {
      console.error('Error refreshing calendar events:', error);
      toast.error('Failed to refresh calendar events');
    }
  };

  const events = eventsData || [];

  // Group events by date
  const eventsByDate = events.reduce((acc, event) => {
    const startDate = event.start?.dateTime || event.start?.date;
    if (!startDate) return acc;
    
    const dateKey = format(parseISO(startDate), 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {});

  // Get days of current week
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    weekDays.push(date);
  }

  const handlePreviousWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const handleNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const handleToday = () => {
    setCurrentWeek(new Date());
  };

  const formatEventTime = (event) => {
    if (event.start?.dateTime) {
      return format(parseISO(event.start.dateTime), 'h:mm a');
    }
    if (event.start?.date) {
      return 'All day';
    }
    return '';
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <p className="text-slate-600 dark:text-slate-400 mb-2">
            Connect Google Calendar to see events
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/settings'}
          >
            Go to Settings
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Events
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh calendar events"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousWeek}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleToday}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextWeek}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : eventsError ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50 text-red-400" />
            <p className="text-red-600 dark:text-red-400 mb-2 font-medium">
              {eventsError.message?.includes('insufficient authentication scopes') || 
               eventsError.message?.includes('permissions needed') ||
               eventsError.message?.includes('403')
                ? 'Calendar permissions needed'
                : 'Error loading events'}
            </p>
            {(eventsError.message?.includes('insufficient authentication scopes') || 
              eventsError.message?.includes('permissions needed')) && (
              <p className="text-sm mb-3 text-slate-600 dark:text-slate-400">
                Please reconnect Calendar in Settings to grant access.
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/settings'}
            >
              Go to Settings
            </Button>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No events this week</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-4">
            {weekDays.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDate[dateKey] || [];
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={dateKey}
                  className={`p-3 rounded-lg border ${
                    isToday
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col items-center mb-3">
                    <span
                      className={`text-xs font-medium mb-1 ${
                        isToday
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {format(day, 'EEE')}
                    </span>
                    <span
                      className={`text-lg font-semibold ${
                        isToday
                          ? 'text-blue-900 dark:text-blue-100'
                          : 'text-slate-900 dark:text-white'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <Badge variant="outline" className="text-xs mt-1">
                        {dayEvents.length}
                      </Badge>
                    )}
                  </div>
                  {dayEvents.length > 0 ? (
                    <div className="space-y-2">
                      {dayEvents.slice(0, 4).map((event) => (
                        <div
                          key={event.id}
                          className="flex items-start gap-1.5 text-xs p-1.5 rounded bg-white dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Clock className="w-2.5 h-2.5 mt-0.5 text-slate-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate text-xs leading-tight">
                              {event.summary || 'No title'}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {formatEventTime(event)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {dayEvents.length > 4 && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 text-center pt-1">
                          +{dayEvents.length - 4} more
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic text-center">
                      No events
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
