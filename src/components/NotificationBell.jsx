import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, Check, X, BellOff, ChevronDown, ChevronRight, RefreshCw, Clock, AlertCircle, AlertTriangle, Clipboard, BarChart, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isPast, differenceInDays, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Capacitor } from '@capacitor/core';
import { snoozeNotification } from '@/services/notificationService';
import { useUser } from '@/contexts/UserContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Check if running in native app
  useEffect(() => {
    setIsNativeApp(Capacitor.isNativePlatform());
  }, []);

  // Get current user from UserContext (more reliable than base44.auth.me)
  const { user: contextUser, profile } = useUser();
  const currentUser = contextUser || profile;
  const currentUserId = currentUser?.id;

  // Fetch notifications for current user (all notifications, sorted by newest first)
  const { data: allNotifications = [], refetch: refetchNotifications } = useQuery({
    queryKey: ['notifications', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) {
        console.log('🔔 NotificationBell: No current user ID');
        return [];
      }
      const notifications = await base44.entities.Notification.filter({ user_id: currentUser.id }, '-created_at');
      console.log(`🔔 NotificationBell: Fetched ${notifications.length} notifications for user ${currentUser.id}`, {
        renewalReminders: notifications.filter(n => n.type === 'renewal_reminder').length,
        unread: notifications.filter(n => !n.is_read).length
      });
      return notifications;
    },
    enabled: !!currentUser?.id,
    refetchInterval: 30000, // Refetch every 30 seconds to catch new notifications
    refetchOnMount: true, // Always refetch on mount (not cached)
  });

  // Force fresh notification fetch on component mount
  useEffect(() => {
    if (currentUser?.id) {
      console.log('🔔 NotificationBell: Forcing fresh notification fetch on mount');
      refetchNotifications();
    }
  }, [currentUser?.id, refetchNotifications]);

  // Fetch universal snoozes (applies to all users)
  const { data: snoozes = [] } = useQuery({
    queryKey: ['notificationSnoozes'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/data/notificationSnoozes');
        const result = await response.json();
        return result.success ? (result.data || []) : [];
      } catch (error) {
        console.error('Error fetching snoozes:', error);
        return [];
      }
    }
  });

  // Fetch accounts and estimates to calculate renewal dates (source of truth)
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
    enabled: !!currentUser?.id
  });
  
  const { data: estimates = [], isLoading: estimatesLoading } = useQuery({
    queryKey: ['estimates'],
    queryFn: async () => {
      const response = await fetch('/api/data/estimates');
      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    },
    enabled: !!currentUser?.id
  });
  
  // Calculate which accounts SHOULD be at_risk based on renewal dates (source of truth)
  // This is more accurate than relying on the status field, which might not update if API calls fail
  const [accountsThatShouldBeAtRisk, setAccountsThatShouldBeAtRisk] = useState(new Set());
  const [atRiskCalculationComplete, setAtRiskCalculationComplete] = useState(false);
  
  useEffect(() => {
    if (accountsLoading || estimatesLoading || accounts.length === 0 || estimates.length === 0) {
      setAccountsThatShouldBeAtRisk(new Set());
      setAtRiskCalculationComplete(false);
      return;
    }
    
    setAtRiskCalculationComplete(false);
    
    // Dynamically import utilities
    Promise.all([
      import('@/utils/renewalDateCalculator'),
      import('date-fns')
    ]).then(([{ calculateRenewalDate }, { differenceInDays, startOfDay }]) => {
      const today = startOfDay(new Date());
      const atRiskSet = new Set();
      
      accounts.forEach(account => {
        if (account.archived) return;
        const accountEstimates = estimates.filter(est => est.account_id === account.id);
        const renewalDate = calculateRenewalDate(accountEstimates);
        if (renewalDate) {
          const renewalDateStart = startOfDay(renewalDate);
          const daysUntilRenewal = differenceInDays(renewalDateStart, today);
          // Account should be at_risk if renewal is within 6 months (180 days) and in the future
          if (daysUntilRenewal >= 0 && daysUntilRenewal <= 180) {
            atRiskSet.add(account.id);
          }
        }
      });
      
      console.log(`🔍 NotificationBell: Calculated ${atRiskSet.size} accounts that should be at_risk from renewal dates`);
      setAccountsThatShouldBeAtRisk(atRiskSet);
      setAtRiskCalculationComplete(true);
    });
  }, [accounts, estimates, accountsLoading, estimatesLoading]);
  
  // Filter out snoozed notifications and notifications for accounts that shouldn't be at_risk
  const activeNotifications = allNotifications.filter(notification => {
    // For renewal reminders, only show if account SHOULD be at_risk based on renewal date (source of truth)
    if (notification.type === 'renewal_reminder') {
      // If accounts/estimates haven't loaded yet, or calculation hasn't completed, don't show renewal notifications
      if (accountsLoading || estimatesLoading || accounts.length === 0 || estimates.length === 0 || !atRiskCalculationComplete) {
        return false;
      }
      
      // Handle null, undefined, or 'null' string values
      const accountId = notification.related_account_id;
      if (!accountId || accountId === 'null' || accountId === null || accountId === undefined) {
        return false; // No account ID means we can't verify if it should be at-risk
      }
      
      // Once calculation is complete, only show notifications for accounts that SHOULD be at_risk (based on renewal date)
      // Use string comparison to handle type mismatches (UUID vs text)
      const accountIdStr = String(accountId).trim();
      const atRiskAccountIds = Array.from(accountsThatShouldBeAtRisk).map(id => String(id).trim());
      const isInAtRiskSet = atRiskAccountIds.includes(accountIdStr);
      
      if (!isInAtRiskSet) {
        return false; // Account should not be at_risk based on renewal date, don't show notification
      }
      
      // If we get here, the notification should be shown (account is at-risk)
      // But we still need to check if it's snoozed
    }
    
    // Check if this notification is snoozed (universal)
    const now = new Date();
    const isSnoozed = snoozes.some(snooze => 
      snooze.notification_type === notification.type &&
      (notification.related_account_id 
        ? snooze.related_account_id === notification.related_account_id
        : (snooze.related_account_id === null || snooze.related_account_id === 'null')) &&
      new Date(snooze.snoozed_until) > now
    );
    return !isSnoozed;
  });

  // Debug logging
  useEffect(() => {
    if (allNotifications.length > 0 && atRiskCalculationComplete) {
      const renewalCount = allNotifications.filter(n => n.type === 'renewal_reminder').length;
      const activeRenewalCount = activeNotifications.filter(n => n.type === 'renewal_reminder').length;
      const renewalNotifications = allNotifications.filter(n => n.type === 'renewal_reminder');
      const renewalAccountIds = renewalNotifications.map(n => String(n.related_account_id).trim()).filter(Boolean);
      const uniqueRenewalAccountIds = [...new Set(renewalAccountIds)];
      
      console.log(`🔔 NotificationBell: ${allNotifications.length} total, ${renewalCount} renewal reminders, ${activeRenewalCount} active (not snoozed)`, {
        accountsThatShouldBeAtRisk: accountsThatShouldBeAtRisk.size,
        atRiskCalculationComplete,
        accountsLoading,
        estimatesLoading,
        accountsCount: accounts.length,
        estimatesCount: estimates.length,
        uniqueRenewalAccountIds: uniqueRenewalAccountIds.length,
        atRiskAccountIds: Array.from(accountsThatShouldBeAtRisk).map(id => String(id).trim()).slice(0, 5),
        renewalAccountIdsSample: uniqueRenewalAccountIds.slice(0, 5)
      });
      
      // Check for mismatches
      if (renewalCount > 0 && accountsThatShouldBeAtRisk.size > 0) {
        const atRiskIds = Array.from(accountsThatShouldBeAtRisk).map(id => String(id).trim());
        const missingFromAtRisk = uniqueRenewalAccountIds.filter(id => {
          const trimmedId = String(id).trim();
          return trimmedId && trimmedId !== 'null' && !atRiskIds.includes(trimmedId);
        });
        if (missingFromAtRisk.length > 0) {
          console.warn(`⚠️ Found ${missingFromAtRisk.length} renewal notifications for accounts NOT in at-risk set:`, missingFromAtRisk.slice(0, 10));
        }
        
        // Count how many notifications should be filtered
        const notificationsToFilter = renewalNotifications.filter(n => {
          const accountId = n.related_account_id;
          if (!accountId || accountId === 'null' || accountId === null) return true;
          const accountIdStr = String(accountId).trim();
          return !atRiskIds.includes(accountIdStr);
        }).length;
        
        console.log(`📊 Filter analysis: ${renewalCount} total renewal notifications, ${notificationsToFilter} should be filtered out, ${renewalCount - notificationsToFilter} should remain`);
      }
    }
  }, [allNotifications, activeNotifications, accountsThatShouldBeAtRisk, accountsLoading, estimatesLoading, accounts.length, estimates.length, atRiskCalculationComplete]);

  // Filter to show unread first, then read (only active notifications)
  const sortedNotifications = [...activeNotifications].sort((a, b) => {
    if (a.is_read !== b.is_read) {
      return a.is_read ? 1 : -1; // Unread first
    }
    return 0;
  });

  // Group notifications by type
  const groupedNotifications = sortedNotifications.reduce((groups, notification) => {
    const type = notification.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(notification);
    return groups;
  }, {});

  // Convert grouped object to array of groups
  const notificationGroups = Object.entries(groupedNotifications).map(([type, notifications]) => ({
    type,
    notifications,
    count: notifications.length,
    unreadCount: notifications.filter(n => !n.is_read).length
  }));

  // Define notification type priority (lower number = higher priority)
  const getTypePriority = (type) => {
    const priorities = {
      'renewal_reminder': 1,
      'neglected_account': 2,
      'task_overdue': 3,
      'task_due_today': 4,
      'task_reminder': 5,
      'end_of_year_analysis': 6
    };
    return priorities[type] || 99; // Unknown types go last
  };

  // Sort groups by priority, then unread count, then total count
  notificationGroups.sort((a, b) => {
    // First, sort by type priority
    const priorityA = getTypePriority(a.type);
    const priorityB = getTypePriority(b.type);
    if (priorityA !== priorityB) {
      return priorityA - priorityB; // Lower priority number = higher priority
    }
    // Then by unread count (groups with unread first)
    if (a.unreadCount !== b.unreadCount) {
      return b.unreadCount - a.unreadCount; // More unread first
    }
    // Finally by total count
    return b.count - a.count; // More notifications first
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => base44.entities.Notification.markAllAsRead(currentUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const unreadCount = activeNotifications.filter(n => !n.is_read).length;
  
  // For badge count, show total unread (not grouped)
  const displayUnreadCount = unreadCount;

  // Snooze notification mutation (universal - affects all users)
  const snoozeNotificationMutation = useMutation({
    mutationFn: async ({ notification, duration, unit }) => {
      if (!currentUserId) throw new Error('Not authenticated');
      
      const now = new Date();
      let snoozedUntil;
      switch (unit) {
        case 'days':
          snoozedUntil = addDays(now, duration);
          break;
        case 'weeks':
          snoozedUntil = addWeeks(now, duration);
          break;
        case 'months':
          snoozedUntil = addMonths(now, duration);
          break;
        case 'years':
          snoozedUntil = addYears(now, duration);
          break;
        default:
          snoozedUntil = addWeeks(now, duration);
      }
      
      // Snooze universally (for all users)
      await snoozeNotification(
        notification.type,
        notification.related_account_id || null,
        snoozedUntil,
        currentUserId // Track who snoozed it (optional)
      );
      
      // Mark notification as read for current user when snoozed
      await base44.entities.Notification.markAsRead(notification.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notificationSnoozes'] });
    }
  });

  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [snoozeDuration, setSnoozeDuration] = useState(1);
  const [snoozeUnit, setSnoozeUnit] = useState('weeks');
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  const handleSnoozeClick = (e, notification) => {
    e.stopPropagation();
    setSelectedNotification(notification);
    setSnoozeDialogOpen(true);
  };

  const handleSnoozeConfirm = () => {
    if (selectedNotification) {
      snoozeNotificationMutation.mutate({
        notification: selectedNotification,
        duration: snoozeDuration,
        unit: snoozeUnit
      });
      setSnoozeDialogOpen(false);
      setSelectedNotification(null);
    }
  };

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
        return <Clipboard className="w-6 h-6 text-slate-600" />;
      case 'task_overdue':
        return <AlertCircle className="w-6 h-6 text-orange-600" />;
      case 'task_due_today':
        return <Bell className="w-6 h-6 text-blue-600" />;
      case 'end_of_year_analysis':
        return <BarChart className="w-6 h-6 text-purple-600" />;
      case 'renewal_reminder':
        return <AlertTriangle className="w-6 h-6 text-red-600" />;
      case 'neglected_account':
        return <Clock className="w-6 h-6 text-amber-600" />;
      default:
        return <Mail className="w-6 h-6 text-slate-600" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'task_overdue':
        return 'bg-orange-50 border-orange-200';
      case 'task_due_today':
        return 'bg-amber-50 border-amber-200';
      case 'end_of_year_analysis':
        return 'bg-emerald-50 border-emerald-200';
      case 'renewal_reminder':
        return 'bg-red-50 border-red-200';
      case 'neglected_account':
        return 'bg-amber-50 border-amber-200';
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
                {notificationGroups.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  notificationGroups.map((group) => {
                    const isExpanded = expandedGroups.has(group.type);
                    const hasMultiple = group.count > 1;
                    const groupName = group.type === 'renewal_reminder' ? 'At Risk Accounts' :
                                     group.type === 'neglected_account' ? 'Neglected Accounts' :
                                     group.type === 'task_reminder' ? 'Task Reminders' :
                                     group.type === 'task_overdue' ? 'Overdue Tasks' :
                                     group.type === 'task_due_today' ? 'Tasks Due Today' :
                                     group.type === 'end_of_year_analysis' ? 'Reports' :
                                     'Notifications';

                    return (
                      <div key={group.type} className="divide-y divide-slate-100">
                        {/* Group Header - Clickable to expand/collapse if multiple */}
                        <div 
                          className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                            hasMultiple && group.unreadCount > 0 ? getNotificationColor(group.type) : ''
                          }`}
                          onClick={() => {
                            if (hasMultiple) {
                              const newExpanded = new Set(expandedGroups);
                              if (isExpanded) {
                                newExpanded.delete(group.type);
                              } else {
                                newExpanded.add(group.type);
                              }
                              setExpandedGroups(newExpanded);
                            } else if (group.notifications[0]) {
                              // Single notification - click through to it
                              handleNotificationClick(group.notifications[0]);
                            }
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="text-2xl flex-shrink-0">
                              {getNotificationIcon(group.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1">
                                  <h4 className={`text-sm font-medium ${group.unreadCount > 0 ? 'text-slate-900' : 'text-slate-600'}`}>
                                    {hasMultiple ? groupName : group.notifications[0]?.title || groupName}
                                  </h4>
                                  {hasMultiple && (
                                    <Badge variant="secondary" className="text-xs">
                                      {group.count}
                                    </Badge>
                                  )}
                                  {group.unreadCount > 0 && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {hasMultiple && (
                                    <ChevronRight 
                                      className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                    />
                                  )}
                                  {!hasMultiple && (group.notifications[0]?.type === 'renewal_reminder' || group.notifications[0]?.type === 'neglected_account') && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (group.notifications[0]) {
                                          handleSnoozeClick(e, group.notifications[0]);
                                        }
                                      }}
                                      title="Snooze this notification"
                                    >
                                      <BellOff className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              {hasMultiple && (
                                <p className="text-sm text-slate-600 mt-1">
                                  {group.unreadCount > 0 
                                    ? `${group.unreadCount} unread ${group.unreadCount === 1 ? 'notification' : 'notifications'}`
                                    : `${group.count} ${group.count === 1 ? 'notification' : 'notifications'}`
                                  }
                                </p>
                              )}
                              {!hasMultiple && group.notifications[0] && (
                                <>
                                  <p className="text-sm text-slate-600 mt-1">
                                    {group.notifications[0].message}
                                  </p>
                                  <p className="text-xs text-slate-400 mt-2">
                                    {group.notifications[0].scheduled_for 
                                      ? format(new Date(group.notifications[0].scheduled_for), 'MMM d, h:mm a')
                                      : format(new Date(group.notifications[0].created_at), 'MMM d, h:mm a')
                                    }
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Expanded Notifications List */}
                        {hasMultiple && isExpanded && (
                          <div className="bg-slate-50">
                            {group.notifications.map((notification) => (
                              <div
                                key={notification.id}
                                className={`p-4 pl-12 hover:bg-slate-100 transition-colors border-l-2 border-slate-200 ${
                                  !notification.is_read ? getNotificationColor(notification.type) : ''
                                }`}
                              >
                                <div 
                                  className="flex-1 min-w-0 cursor-pointer"
                                  onClick={() => handleNotificationClick(notification)}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className={`text-sm font-medium ${!notification.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                                      {notification.title}
                                    </h4>
                                    <div className="flex items-center gap-2">
                                      {!notification.is_read && (
                                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                                      )}
                                      {(notification.type === 'renewal_reminder' || notification.type === 'neglected_account') && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 px-2 text-xs"
                                          onClick={(e) => handleSnoozeClick(e, notification)}
                                          title="Snooze this notification"
                                        >
                                          <BellOff className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
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
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Snooze Dialog */}
      <Dialog open={snoozeDialogOpen} onOpenChange={setSnoozeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BellOff className="w-5 h-5 text-amber-600" />
              Snooze Notification
            </DialogTitle>
            <DialogDescription>
              Hide this notification for a period of time. It will reappear after the snooze period ends.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  value={snoozeDuration}
                  onChange={(e) => setSnoozeDuration(parseInt(e.target.value) || 1)}
                  className="w-24"
                />
                <Select value={snoozeUnit} onValueChange={setSnoozeUnit}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">Day(s)</SelectItem>
                    <SelectItem value="weeks">Week(s)</SelectItem>
                    <SelectItem value="months">Month(s)</SelectItem>
                    <SelectItem value="years">Year(s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">
                Notification will reappear on{' '}
                <span className="font-semibold text-slate-900">
                  {format(
                    (() => {
                      const now = new Date();
                      switch (snoozeUnit) {
                        case 'days': return addDays(now, snoozeDuration);
                        case 'weeks': return addWeeks(now, snoozeDuration);
                        case 'months': return addMonths(now, snoozeDuration);
                        case 'years': return addYears(now, snoozeDuration);
                        default: return addWeeks(now, snoozeDuration);
                      }
                    })(),
                    'MMM d, yyyy'
                  )}
                </span>
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSnoozeDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSnoozeConfirm} 
                className="bg-amber-600 hover:bg-amber-700"
                disabled={snoozeNotificationMutation.isPending}
              >
                <BellOff className="w-4 h-4 mr-2" />
                {snoozeNotificationMutation.isPending ? 'Snoozing...' : 'Snooze'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

