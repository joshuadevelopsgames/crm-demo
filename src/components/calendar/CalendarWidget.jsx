import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ChevronLeft, ChevronRight, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchCalendarEvents } from '@/services/calendarService';
import { isCalendarConnected } from '@/services/calendarService';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import CalendarSyncButton from './CalendarSyncButton';

export default function CalendarWidget() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [isConnected, setIsConnected] = useState(false);

  // Check connection status
  React.useEffect(() => {
    const checkConnection = async () => {
      const connected = await isCalendarConnected();
      setIsConnected(connected);
    };
    checkConnection();
  }, []);

  // Fetch calendar events for the current week
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });

  const { data: eventsData, isLoading } = useQuery({
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
        return [];
      }
    },
    enabled: isConnected,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

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
            <CalendarSyncButton />
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
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No events this week</p>
          </div>
        ) : (
          <div className="space-y-4">
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-semibold ${
                          isToday
                            ? 'text-blue-900 dark:text-blue-100'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {format(day, 'EEE')}
                      </span>
                      <span
                        className={`text-sm ${
                          isToday
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {format(day, 'MMM d')}
                      </span>
                    </div>
                    {dayEvents.length > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {dayEvents.length}
                      </Badge>
                    )}
                  </div>
                  {dayEvents.length > 0 ? (
                    <div className="space-y-2 mt-2">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className="flex items-start gap-2 text-sm p-2 rounded bg-white dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                          <Clock className="w-3 h-3 mt-0.5 text-slate-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate">
                              {event.summary || 'No title'}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {formatEventTime(event)}
                            </p>
                          </div>
                          {event.htmlLink && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => window.open(event.htmlLink, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center pt-1">
                          +{dayEvents.length - 3} more
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">
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
