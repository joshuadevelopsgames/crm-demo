import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfDay, isToday, isPast } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { parseCalgaryDate } from '@/utils/timezone';

export default function TaskCalendarView({ tasks, onTaskClick, currentUser }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'

  // Parse task due dates using Calgary timezone
  const parseLocalDate = (dateString) => {
    return parseCalgaryDate(dateString);
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
      tasks: getTasksForDate(day)
    }));
  }, [currentDate, tasks]);

  // Week view
  const weekView = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
    
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    return days.map(day => ({
      date: day,
      tasks: getTasksForDate(day)
    }));
  }, [currentDate, tasks]);

  // Day view
  const dayView = useMemo(() => {
    return [{
      date: currentDate,
      tasks: getTasksForDate(currentDate)
    }];
  }, [currentDate, tasks]);

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

  const renderCalendarGrid = (days) => {
    if (viewMode === 'day') {
      const day = days[0];
      return (
        <div className="h-full">
          <div className="border-b p-4 bg-slate-50">
            <div className="text-2xl font-bold">{format(day.date, 'EEEE, MMMM d, yyyy')}</div>
            {isToday(day.date) && <Badge className="mt-2">Today</Badge>}
          </div>
          <div className="p-4 space-y-2 h-[calc(100vh-300px)] overflow-y-auto">
            {day.tasks.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No tasks for this day</p>
            ) : (
              day.tasks.map(task => (
                <Card 
                  key={task.id} 
                  className="p-3 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => onTaskClick(task)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{task.title}</h4>
                        <Badge className={`text-xs ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-xs text-slate-600 line-clamp-2">{task.description}</p>
                      )}
                      {task.due_time && (
                        <p className="text-xs text-slate-500 mt-1">{task.due_time}</p>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      );
    }

    if (viewMode === 'week') {
      return (
        <div className="grid grid-cols-7 gap-1 h-full">
          {days.map((day, index) => (
            <div key={index} className="border-r last:border-r-0 flex flex-col min-h-[500px]">
              <div className={`p-2 border-b text-center ${isToday(day.date) ? 'bg-blue-50 font-bold' : 'bg-slate-50'}`}>
                <div className="text-xs text-slate-600">{format(day.date, 'EEE')}</div>
                <div className={`text-lg ${isToday(day.date) ? 'text-blue-600' : ''}`}>
                  {format(day.date, 'd')}
                </div>
              </div>
              <div className="flex-1 p-1 space-y-1 overflow-y-auto">
                {day.tasks.slice(0, 3).map(task => (
                  <div
                    key={task.id}
                    className={`text-xs p-1.5 rounded cursor-pointer hover:opacity-80 ${getPriorityColor(task.priority)}`}
                    onClick={() => onTaskClick(task)}
                    title={task.title}
                  >
                    <div className="truncate">{task.title}</div>
                  </div>
                ))}
                {day.tasks.length > 3 && (
                  <div className="text-xs text-slate-500 text-center py-1">
                    +{day.tasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          ))}
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
                const isOverdue = isPast(startOfDay(day.date)) && !isToday(day.date) && day.tasks.length > 0;
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
                    <div className="flex-1 space-y-0.5 overflow-y-auto">
                      {day.tasks.slice(0, 3).map(task => (
                        <div
                          key={task.id}
                          className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 truncate ${getPriorityColor(task.priority)}`}
                          onClick={() => onTaskClick(task)}
                          title={task.title}
                        >
                          {task.title}
                        </div>
                      ))}
                      {day.tasks.length > 3 && (
                        <div className="text-xs text-slate-500 text-center py-0.5">
                          +{day.tasks.length - 3}
                        </div>
                      )}
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

