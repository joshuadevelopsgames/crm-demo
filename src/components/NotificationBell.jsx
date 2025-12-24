import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isPast, differenceInDays } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Capacitor } from '@capacitor/core';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Check if running in native app
  useEffect(() => {
    setIsNativeApp(Capacitor.isNativePlatform());
  }, []);

  // Get current user
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return user;
    }
  });

  // Fetch notifications for current user (all notifications, sorted by newest first)
  const { data: allNotifications = [] } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      return base44.entities.Notification.filter({ user_id: currentUser.id }, '-created_at');
    },
    enabled: !!currentUser?.id
  });

  // Filter to show unread first, then read
  const notifications = [...allNotifications].sort((a, b) => {
    if (a.is_read !== b.is_read) {
      return a.is_read ? 1 : -1; // Unread first
    }
    return 0;
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => base44.entities.Notification.markAllAsRead(currentUser?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const unreadCount = allNotifications.filter(n => !n.is_read).length;

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markAsReadMutation.mutate(notification.id);
    }
    
    // Navigate based on notification type
    if (notification.type === 'end_of_year_analysis') {
      const currentYear = new Date().getFullYear();
      navigate(`${createPageUrl('Reports')}?year=${currentYear}`);
      setIsOpen(false);
    } else if (notification.related_task_id) {
      navigate('/tasks');
      setIsOpen(false);
    } else if (notification.related_account_id) {
      navigate(createPageUrl(`AccountDetail?id=${notification.related_account_id}`));
      setIsOpen(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'task_reminder':
        return '📋';
      case 'task_overdue':
        return '⚠️';
      case 'task_due_today':
        return '🔔';
      case 'end_of_year_analysis':
        return '📊';
      default:
        return '📬';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'task_overdue':
        return 'bg-red-50 border-red-200';
      case 'task_due_today':
        return 'bg-amber-50 border-amber-200';
      case 'end_of_year_analysis':
        return 'bg-emerald-50 border-emerald-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
        title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'Notifications'}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <>
            {/* Pulse animation ring */}
            <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full animate-ping opacity-75" />
            {/* Badge */}
            <Badge className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 bg-red-500 text-white text-[10px] font-semibold z-10">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          </>
        )}
      </Button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className={isNativeApp ? "fixed left-0 right-0 z-50 flex justify-center px-4" : "absolute right-0 z-50 mt-2"} style={isNativeApp ? {
            top: `calc(4rem + env(safe-area-inset-top, 0px) + 0.5rem)`,
            paddingLeft: `max(1rem, env(safe-area-inset-left, 0px) + 1rem)`,
            paddingRight: `max(1rem, env(safe-area-inset-right, 0px) + 1rem)`
          } : {
            top: '100%'
          }}>
            <Card className="max-h-[600px] overflow-y-auto shadow-xl w-full max-w-sm">
            <CardContent className="p-0">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Notifications</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAllAsReadMutation.mutate()}
                    className="text-xs"
                    disabled={unreadCount === 0}
                  >
                    Mark all read
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors ${
                        !notification.is_read ? getNotificationColor(notification.type) : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-sm font-medium ${!notification.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                              {notification.title}
                            </h4>
                            {!notification.is_read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-sm text-slate-600 mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs text-slate-400 mt-2">
                            {notification.scheduled_for 
                              ? format(new Date(notification.scheduled_for), 'MMM d, h:mm a')
                              : format(new Date(notification.created_at), 'MMM d, h:mm a')
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

