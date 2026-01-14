import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfDay, isToday, isPast, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, ExternalLink, AlertTriangle, Ban, ChevronsUp, ChevronsDown, Minus, Circle, CheckCircle2, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { parseCalgaryDate } from '@/utils/timezone';
import { fetchCalendarEvents, isCalendarConnected } from '@/services/calendarService';
import toast from 'react-hot-toast';

export default function TaskCalendarView({ tasks, onTaskClick, currentUser, onPriorityChange, onStatusChange }) {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'
  const [isCalendarConnectedState, setIsCalendarConnectedState] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check calendar connection status
  const { data: connectionStatus } = useQuery({
    queryKey: ['calendar-connection-status'],
    queryFn: async () => {
      const connected = await isCalendarConnected();
      return connected;
    },
    refetchOnWindowFocus: true,
    staleTime: 30 * 1000, // 30 seconds
  });

  useEffect(() => {
    if (connectionStatus !== undefined) {
      setIsCalendarConnectedState(connectionStatus);
    }
  }, [connectionStatus]);

  // Calculate date range for fetching calendar events based on view mode
  const getDateRange = useMemo(() => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return {
        timeMin: calendarStart.toISOString(),
        timeMax: calendarEnd.toISOString()
      };
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return {
        timeMin: weekStart.toISOString(),
        timeMax: weekEnd.toISOString()
      };
    } else {
      // Day view - fetch events for the day plus buffer
      const dayStart = startOfDay(currentDate);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      return {
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString()
      };
    }
  }, [currentDate, viewMode]);

  // Fetch Google Calendar events
  const { data: calendarEventsData, isLoading: isLoadingEvents, refetch: refetchCalendarEvents } = useQuery({
    queryKey: ['calendar-events', getDateRange.timeMin, getDateRange.timeMax],
    queryFn: async () => {
      try {
        const result = await fetchCalendarEvents({
          timeMin: getDateRange.timeMin,
          timeMax: getDateRange.timeMax,
          maxResults: 250
        });
        return result.items || [];
      } catch (error) {
        console.error('Error fetching calendar events:', error);
        if (error.message?.includes('insufficient authentication scopes') || 
            error.message?.includes('403')) {
          setIsCalendarConnectedState(false);
        }
        return [];
      }
    },
    enabled: isCalendarConnectedState,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });

  // Handle refresh button click
  const handleRefresh = async () => {
    if (!isCalendarConnectedState) {
      toast.error('Calendar not connected');
      return;
    }
    
    setIsRefreshing(true);
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
    } finally {
      setIsRefreshing(false);
    }
  };

  const calendarEvents = calendarEventsData || [];

  // Parse task due dates using Calgary timezone
  const parseLocalDate = (dateString) => {
    return parseCalgaryDate(dateString);
  };

  // Get calendar events for a specific date
  const getCalendarEventsForDate = (date) => {
    if (!date || !calendarEvents.length) return [];
    return calendarEvents.filter(event => {
      const startDate = event.start?.dateTime || event.start?.date;
      if (!startDate) return false;
      const eventDate = parseISO(startDate);
      return isSameDay(eventDate, date);
    });
  };

  // Get tasks for a specific date
  const getTasksForDate = (date) => {
    if (!date) return [];
    return tasks.filter(task => {
      if (!task.due_date || task.status === 'completed') return false;
      const taskDate = parseLocalDate(task.due_date);
      if (!taskDate) return false;
      return isSameDay(taskDate, date);
    });
  };

  // Format event time
  const formatEventTime = (event) => {
    if (event.start?.dateTime) {
      return format(parseISO(event.start.dateTime), 'h:mm a');
    }
    if (event.start?.date) {
      return 'All day';
    }
    return '';
  };

  // Handle calendar event click - open in Google Calendar
  const handleCalendarEventClick = (event) => {
    if (event.htmlLink) {
      window.open(event.htmlLink, '_blank');
    }
  };

  // Month view
  const monthView = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    return days.map(day => ({
      date: day,
      isCurrentMonth: isSameMonth(day, currentDate),
      tasks: getTasksForDate(day),
      calendarEvents: getCalendarEventsForDate(day)
    }));
  }, [currentDate, tasks, calendarEvents]);

  // Week view
  const weekView = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
    
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    return days.map(day => ({
      date: day,
      tasks: getTasksForDate(day),
      calendarEvents: getCalendarEventsForDate(day)
    }));
  }, [currentDate, tasks, calendarEvents]);

  // Day view
  const dayView = useMemo(() => {
    return [{
      date: currentDate,
      tasks: getTasksForDate(currentDate),
      calendarEvents: getCalendarEventsForDate(currentDate)
    }];
  }, [currentDate, tasks, calendarEvents]);

  const navigateDate = (direction) => {
    if (viewMode === 'month') {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getPriorityColor = (priority) => {
    const colors = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      blocker: 'bg-red-100 text-red-800 border-red-300',
      major: 'bg-orange-100 text-orange-800 border-orange-300',
      normal: 'bg-blue-100 text-blue-800 border-blue-300',
      minor: 'bg-slate-100 text-slate-800 border-slate-300',
      trivial: 'bg-gray-100 text-gray-800 border-gray-300'
    };
    return colors[priority] || colors.normal;
  };

  const getPriorityFlag = (priority) => {
    const flags = {
      critical: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
      blocker: { icon: Ban, color: 'text-red-700', bgColor: 'bg-red-100', borderColor: 'border-red-300' },
      major: { icon: ChevronsUp, color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
      normal: { icon: Minus, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
      minor: { icon: ChevronsDown, color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200' },
      trivial: { icon: Circle, color: 'text-gray-500', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
    };
    return flags[priority] || flags.normal;
  };

  const getStatusIcon = (status) => {
    const icons = {
      todo: Circle,
      in_progress: Clock,
      blocked: AlertCircle,
      completed: CheckCircle2,
    };
    return icons[status] || Circle;
  };

  const getStatusColor = (status) => {
    const colors = {
      todo: 'text-slate-400',
      in_progress: 'text-blue-500',
      blocked: 'text-red-500',
      completed: 'text-emerald-500',
    };
    return colors[status] || colors.todo;
  };

  const renderCalendarGrid = (days) => {
    if (viewMode === 'day') {
      const day = days[0];
      const allItems = [
        ...day.tasks.map(t => ({ type: 'task', data: t })),
        ...day.calendarEvents.map(e => ({ type: 'event', data: e }))
      ].sort((a, b) => {
        // Sort by time if available
        if (a.type === 'event' && b.type === 'event') {
          const aTime = a.data.start?.dateTime || a.data.start?.date;
          const bTime = b.data.start?.dateTime || b.data.start?.date;
          if (aTime && bTime) return new Date(aTime) - new Date(bTime);
        }
        if (a.type === 'task' && a.data.due_time && b.type === 'event' && b.data.start?.dateTime) {
          return -1; // Tasks with time come before events
        }
        return 0;
      });

      return (
        <div className="h-full">
          <div className="border-b p-4 bg-slate-50">
            <div className="text-2xl font-bold">{format(day.date, 'EEEE, MMMM d, yyyy')}</div>
            {isToday(day.date) && <Badge className="mt-2">Today</Badge>}
          </div>
          <div className="p-4 space-y-2 h-[calc(100vh-300px)] overflow-y-auto overflow-x-hidden" style={{ scrollbarGutter: 'stable' }}>
            {allItems.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No tasks or events for this day</p>
            ) : (
              allItems.map((item, index) => {
                if (item.type === 'task') {
                  const task = item.data;
                  const priorityFlag = getPriorityFlag(task.priority);
                  const PriorityIcon = priorityFlag.icon;
                  const StatusIcon = getStatusIcon(task.status);
                  
                  return (
                    <Card 
                      key={`task-${task.id}`} 
                      className="p-3 hover:bg-slate-50 transition-colors border-l-4 border-l-blue-500"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0" onClick={() => onTaskClick(task)}>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm cursor-pointer">📋 {task.title}</h4>
                          </div>
                          {task.description && (
                            <p className="text-xs text-slate-600 line-clamp-2">{task.description}</p>
                          )}
                          {task.due_time && (
                            <p className="text-xs text-slate-500 mt-1">⏰ {task.due_time}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          {onPriorityChange && (
                            <Select
                              value={task.priority || 'normal'}
                              onValueChange={(value) => {
                                onPriorityChange(task.id, value);
                              }}
                            >
                              <SelectTrigger
                                className="w-6 h-6 p-0 border-0 hover:opacity-80 flex items-center justify-center flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <PriorityIcon
                                  className={`w-3.5 h-3.5 ${priorityFlag.color} ${PriorityIcon === Circle ? 'fill-current' : ''}`}
                                />
                              </SelectTrigger>
                              <SelectContent
                                position="item-aligned"
                                onClick={(e) => e.stopPropagation()}
                                className="max-h-[300px] overflow-y-auto"
                              >
                                <SelectItem value="critical">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                    Critical
                                  </div>
                                </SelectItem>
                                <SelectItem value="blocker">
                                  <div className="flex items-center gap-2">
                                    <Ban className="w-4 h-4 text-red-700" />
                                    Blocker
                                  </div>
                                </SelectItem>
                                <SelectItem value="major">
                                  <div className="flex items-center gap-2">
                                    <ChevronsUp className="w-4 h-4 text-orange-600" />
                                    Major
                                  </div>
                                </SelectItem>
                                <SelectItem value="normal">
                                  <div className="flex items-center gap-2">
                                    <Minus className="w-4 h-4 text-blue-600" />
                                    Normal
                                  </div>
                                </SelectItem>
                                <SelectItem value="minor">
                                  <div className="flex items-center gap-2">
                                    <ChevronsDown className="w-4 h-4 text-slate-600" />
                                    Minor
                                  </div>
                                </SelectItem>
                                <SelectItem value="trivial">
                                  <div className="flex items-center gap-2">
                                    <Circle className="w-4 h-4 text-gray-500 fill-current" />
                                    Trivial
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          {onStatusChange && (
                            <Select
                              value={task.status}
                              onValueChange={(value) => {
                                onStatusChange(task.id, value);
                              }}
                            >
                              <SelectTrigger
                                className="w-6 h-6 p-0 border-0 hover:opacity-80 flex items-center justify-center flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <StatusIcon
                                  className={`w-3.5 h-3.5 ${getStatusColor(task.status)} flex-shrink-0`}
                                />
                              </SelectTrigger>
                              <SelectContent
                                position="item-aligned"
                                onClick={(e) => e.stopPropagation()}
                                className="max-h-[300px] overflow-y-auto"
                              >
                                <SelectItem value="todo">To Do</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="blocked">Blocked</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                } else {
                  const event = item.data;
                  return (
                    <Card 
                      key={`event-${event.id}`} 
                      className="p-3 cursor-pointer hover:bg-green-50 transition-colors border-l-4 border-l-green-500"
                      onClick={() => handleCalendarEventClick(event)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-sm">📅 {event.summary || 'No title'}</h4>
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                              Calendar
                            </Badge>
                            {event.htmlLink && (
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            )}
                          </div>
                          {event.description && (
                            <p className="text-xs text-slate-600 line-clamp-2">{event.description}</p>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <p className="text-xs text-slate-500">{formatEventTime(event)}</p>
                          </div>
                          {event.location && (
                            <p className="text-xs text-slate-500 mt-1">📍 {event.location}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                }
              })
            )}
          </div>
        </div>
      );
    }

    if (viewMode === 'week') {
      return (
        <div className="grid grid-cols-7 gap-1 h-full">
          {days.map((day, index) => {
            const allItems = [
              ...day.tasks.map(t => ({ type: 'task', data: t })),
              ...day.calendarEvents.map(e => ({ type: 'event', data: e }))
            ];
            const displayItems = allItems.slice(0, 5);
            const remainingCount = allItems.length - displayItems.length;

            return (
              <div key={index} className="border-r last:border-r-0 flex flex-col min-h-[500px]">
                <div className={`p-2 border-b text-center ${isToday(day.date) ? 'bg-blue-50 font-bold' : 'bg-slate-50'}`}>
                  <div className="text-xs text-slate-600">{format(day.date, 'EEE')}</div>
                  <div className={`text-lg ${isToday(day.date) ? 'text-blue-600' : ''}`}>
                    {format(day.date, 'd')}
                  </div>
                </div>
                <div className="flex-1 p-1 space-y-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarGutter: 'stable' }}>
                  {displayItems.map((item, itemIndex) => {
                    if (item.type === 'task') {
                      const task = item.data;
                      const priorityFlag = getPriorityFlag(task.priority);
                      const PriorityIcon = priorityFlag.icon;
                      return (
                        <div
                          key={`task-${task.id}`}
                          className={`text-xs p-1.5 rounded hover:opacity-80 border-l-2 border-l-blue-500 ${getPriorityColor(task.priority)} flex items-center justify-between gap-1`}
                          onClick={(e) => {
                            // Only open task if clicking on the text area, not on dropdowns
                            if (e.target.closest('.priority-select, .status-select')) {
                              return;
                            }
                            onTaskClick(task);
                          }}
                          title={task.title}
                        >
                          <div className="truncate flex-1 cursor-pointer">📋 {task.title}</div>
                          {onPriorityChange && (
                            <Select
                              value={task.priority || 'normal'}
                              onValueChange={(value) => {
                                onPriorityChange(task.id, value);
                              }}
                            >
                              <SelectTrigger
                                className="priority-select w-4 h-4 p-0 border-0 hover:opacity-80 flex items-center justify-center flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <PriorityIcon
                                  className={`w-3 h-3 ${priorityFlag.color} ${PriorityIcon === Circle ? 'fill-current' : ''}`}
                                />
                              </SelectTrigger>
                              <SelectContent
                                position="item-aligned"
                                onClick={(e) => e.stopPropagation()}
                                className="max-h-[300px] overflow-y-auto"
                              >
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="blocker">Blocker</SelectItem>
                                <SelectItem value="major">Major</SelectItem>
                                <SelectItem value="normal">Normal</SelectItem>
                                <SelectItem value="minor">Minor</SelectItem>
                                <SelectItem value="trivial">Trivial</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      );
                    } else {
                      const event = item.data;
                      return (
                        <div
                          key={`event-${event.id}`}
                          className="text-xs p-1.5 rounded cursor-pointer hover:opacity-80 bg-green-50 text-green-800 border-l-2 border-l-green-500"
                          onClick={() => handleCalendarEventClick(event)}
                          title={event.summary || 'No title'}
                        >
                          <div className="truncate">📅 {event.summary || 'No title'}</div>
                          {event.start?.dateTime && (
                            <div className="text-[10px] text-green-600 mt-0.5">
                              {formatEventTime(event)}
                            </div>
                          )}
                        </div>
                      );
                    }
                  })}
                  {remainingCount > 0 && (
                    <div className="text-xs text-slate-500 text-center py-1">
                      +{remainingCount} more
                    </div>
                  )}
                  {allItems.length === 0 && (
                    <div className="text-xs text-slate-400 text-center py-2 italic">
                      No items
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Month view
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <div className="flex flex-col h-full">
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 border-b pb-2 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-xs font-semibold text-slate-600">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="flex-1 grid grid-rows-6 gap-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-1">
              {week.map((day, dayIndex) => {
                const isOverdue = isPast(startOfDay(day.date)) && !isToday(day.date) && (day.tasks.length > 0 || day.calendarEvents.length > 0);
                return (
                  <div
                    key={dayIndex}
                    className={`border rounded-lg p-1.5 flex flex-col min-h-[100px] ${
                      !day.isCurrentMonth ? 'bg-slate-50 opacity-50' : 'bg-white'
                    } ${isToday(day.date) ? 'ring-2 ring-blue-500' : ''} ${isOverdue ? 'border-red-300' : ''}`}
                  >
                    <div className={`text-sm font-medium mb-1 ${isToday(day.date) ? 'text-blue-600' : ''}`}>
                      {format(day.date, 'd')}
                    </div>
                    <div className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden" style={{ scrollbarGutter: 'stable' }}>
                      {(() => {
                        const allItems = [
                          ...day.tasks.map(t => ({ type: 'task', data: t })),
                          ...day.calendarEvents.map(e => ({ type: 'event', data: e }))
                        ];
                        const displayItems = allItems.slice(0, 3);
                        const remainingCount = allItems.length - displayItems.length;

                        return (
                          <>
                            {displayItems.map((item) => {
                              if (item.type === 'task') {
                                const task = item.data;
                                const priorityFlag = getPriorityFlag(task.priority);
                                const PriorityIcon = priorityFlag.icon;
                                return (
                                  <div
                                    key={`task-${task.id}`}
                                    className={`text-xs p-1 rounded hover:opacity-80 truncate border-l-2 border-l-blue-500 ${getPriorityColor(task.priority)} flex items-center justify-between gap-1`}
                                    onClick={(e) => {
                                      if (e.target.closest('.priority-select')) {
                                        return;
                                      }
                                      onTaskClick(task);
                                    }}
                                    title={task.title}
                                  >
                                    <span className="truncate flex-1 cursor-pointer">📋 {task.title}</span>
                                    {onPriorityChange && (
                                      <Select
                                        value={task.priority || 'normal'}
                                        onValueChange={(value) => {
                                          onPriorityChange(task.id, value);
                                        }}
                                      >
                                        <SelectTrigger
                                          className="priority-select w-4 h-4 p-0 border-0 hover:opacity-80 flex items-center justify-center flex-shrink-0"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                          }}
                                          onMouseDown={(e) => {
                                            e.stopPropagation();
                                          }}
                                        >
                                          <PriorityIcon
                                            className={`w-2.5 h-2.5 ${priorityFlag.color} ${PriorityIcon === Circle ? 'fill-current' : ''}`}
                                          />
                                        </SelectTrigger>
                                        <SelectContent
                                          position="item-aligned"
                                          onClick={(e) => e.stopPropagation()}
                                          className="max-h-[300px] overflow-y-auto"
                                        >
                                          <SelectItem value="critical">Critical</SelectItem>
                                          <SelectItem value="blocker">Blocker</SelectItem>
                                          <SelectItem value="major">Major</SelectItem>
                                          <SelectItem value="normal">Normal</SelectItem>
                                          <SelectItem value="minor">Minor</SelectItem>
                                          <SelectItem value="trivial">Trivial</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                );
                              } else {
                                const event = item.data;
                                return (
                                  <div
                                    key={`event-${event.id}`}
                                    className="text-xs p-1 rounded cursor-pointer hover:opacity-80 truncate bg-green-50 text-green-800 border-l-2 border-l-green-500"
                                    onClick={() => handleCalendarEventClick(event)}
                                    title={event.summary || 'No title'}
                                  >
                                    📅 {event.summary || 'No title'}
                                  </div>
                                );
                              }
                            })}
                            {remainingCount > 0 && (
                              <div className="text-xs text-slate-500 text-center py-0.5">
                                +{remainingCount}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getViewData = () => {
    switch (viewMode) {
      case 'week':
        return weekView;
      case 'day':
        return dayView;
      default:
        return monthView;
    }
  };

  const getDateLabel = () => {
    switch (viewMode) {
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      default:
        return format(currentDate, 'MMMM yyyy');
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="p-4 flex-1 flex flex-col">
        {/* Header with navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('prev')}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateDate('next')}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <h2 className="text-xl font-bold ml-4">{getDateLabel()}</h2>
            {isCalendarConnectedState && (
              <>
                <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-300">
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  Google Calendar Connected
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoadingEvents || isRefreshing}
                  className="ml-2"
                  title="Refresh calendar events"
                >
                  {(isLoadingEvents || isRefreshing) ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </>
            )}
          </div>
          
          {/* View mode selector */}
          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === 'month' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
            >
              Month
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
            >
              Week
            </Button>
            <Button
              variant={viewMode === 'day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('day')}
            >
              Day
            </Button>
          </div>
        </div>

        {/* Calendar content */}
        <div className="flex-1 overflow-hidden">
          {renderCalendarGrid(getViewData())}
        </div>
      </CardContent>
    </Card>
  );
}

