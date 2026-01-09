import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, Check, X, BellOff, ChevronDown, ChevronRight, RefreshCw, Clock, AlertCircle, AlertTriangle, Clipboard, BarChart, Mail, Trash2, User, Bug, Ticket, MessageSquare, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isPast, differenceInDays, addDays, addWeeks, addMonths, addYears, startOfDay } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Capacitor } from '@capacitor/core';
import { snoozeNotification } from '@/services/notificationService';
import { useUser } from '@/contexts/UserContext';
import { getSupabaseClient } from '@/services/supabaseClient';
import toast from 'react-hot-toast';
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
  const { user: contextUser, profile, isLoading: userLoading } = useUser();
  const [fallbackUser, setFallbackUser] = useState(null);
  
  // Fallback: if UserContext doesn't provide user, try base44.auth.me()
  useEffect(() => {
    if (!contextUser && !profile && !userLoading) {
      base44.auth.me().then(user => {
        if (user?.id) {
          console.log('🔔 NotificationBell: Using fallback user from base44.auth.me()', user.id);
          setFallbackUser(user);
        }
      }).catch(err => {
        console.error('🔔 NotificationBell: Error getting fallback user:', err);
      });
    } else {
      setFallbackUser(null);
    }
  }, [contextUser, profile, userLoading]);
  
  const currentUser = contextUser || profile || fallbackUser;
  const currentUserId = currentUser?.id;
  
  // Store previous user ID to prevent query key changes from clearing data
  const [stableUserId, setStableUserId] = React.useState(currentUserId);
  React.useEffect(() => {
    if (currentUserId) {
      setStableUserId(currentUserId);
    }
  }, [currentUserId]);

  // Fetch notifications using unified API
  const { data: notificationsData, refetch: refetchNotifications, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications', stableUserId],
    queryFn: async () => {
      // Use stableUserId instead of currentUser?.id to prevent empty data during navigation
      if (!stableUserId) {
        console.log('🔔 NotificationBell: No stable user ID', { hasContextUser: !!contextUser, hasProfile: !!profile, userLoading, stableUserId });
        return { atRiskAccounts: [], neglectedAccounts: [], taskNotifications: [], systemNotifications: [], duplicateEstimates: [] };
      }
      try {
        const currentUserIdStr = String(stableUserId).trim();
        
        // Fetch all notifications from unified API
        const response = await fetch(`/api/notifications?type=all&user_id=${encodeURIComponent(currentUserIdStr)}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch notifications: ${response.status}`);
        }
        const result = await response.json();
        
        if (!result.success) {
          console.error('❌ Failed to fetch notifications:', result.error);
          return { atRiskAccounts: [], neglectedAccounts: [], taskNotifications: [], systemNotifications: [], ticketNotifications: [], duplicateEstimates: [] };
        }
        
        // Convert at-risk and neglected accounts to notification format
        const atRiskNotifications = (result.data.atRiskAccounts || []).map(account => ({
          id: `at_risk_${account.account_id}`,
          type: 'renewal_reminder',
          title: `At Risk: ${account.account_name}`,
          message: `Renewal in ${account.days_until_renewal} day${account.days_until_renewal !== 1 ? 's' : ''}`,
          related_account_id: account.account_id,
          is_read: false,
          created_at: new Date().toISOString(),
          has_duplicates: account.has_duplicates,
          duplicate_estimates: account.duplicate_estimates
        }));
        
        const neglectedNotifications = (result.data.neglectedAccounts || []).map(account => ({
          id: `neglected_${account.account_id}`,
          type: 'neglected_account',
          title: `Neglected Account: ${account.account_name}`,
          message: account.days_since_interaction 
            ? `No contact in ${account.days_since_interaction} days`
            : 'No interactions logged',
          related_account_id: account.account_id,
          is_read: false,
          created_at: new Date().toISOString()
        }));
        
        // Convert duplicate estimates to notifications
        const duplicateNotifications = (result.data.duplicateEstimates || []).map(dup => ({
          id: `duplicate_${dup.id}`,
          type: 'duplicate_at_risk_estimates',
          title: `Duplicate At-Risk Estimates: ${dup.account_name}`,
          message: `Account has ${dup.estimate_ids?.length || 0} at-risk estimates with same department and address`,
          related_account_id: dup.account_id,
          is_read: false,
          created_at: dup.detected_at || new Date().toISOString(),
          metadata: dup
        }));
        
        // Combine all notifications
        const allNotifications = [
          ...atRiskNotifications,
          ...neglectedNotifications,
          ...result.data.taskNotifications || [],
          ...result.data.systemNotifications || [],
          ...result.data.ticketNotifications || [],
          ...duplicateNotifications
        ];
        
        // Sort by created_at descending (newest first)
        allNotifications.sort((a, b) => {
          const dateA = new Date(a.created_at || 0);
          const dateB = new Date(b.created_at || 0);
          return dateB - dateA;
        });
        
        return {
          notifications: allNotifications,
          atRiskAccounts: result.data.atRiskAccounts || [],
          neglectedAccounts: result.data.neglectedAccounts || [],
          duplicateEstimates: result.data.duplicateEstimates || []
        };
      } catch (error) {
        console.error('🔔 NotificationBell: Error fetching notifications:', error);
        return { notifications: [], atRiskAccounts: [], neglectedAccounts: [], duplicateEstimates: [] };
      }
    },
    enabled: !!stableUserId && !userLoading,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes - keep data in cache longer to prevent disappearing
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: 'always', // Always refetch on mount to get latest cache data
    refetchOnWindowFocus: true, // Refetch when window regains focus to get latest cache
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData, // Keep previous data while refetching
    // Use initialDataUpdatedAt to prevent data from being considered stale immediately
    initialDataUpdatedAt: () => Date.now(),
  });
  
  // Set up Supabase Realtime subscriptions for instant updates
  useEffect(() => {
    if (!currentUser?.id) return;
    
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    // Subscribe to cache updates (at-risk, neglected)
    const cacheChannel = supabase
      .channel('notification-cache')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notification_cache'
      }, () => {
        console.log('🔔 Cache updated, invalidating notifications query');
        queryClient.invalidateQueries(['notifications', currentUser.id]);
      });
    
    // Subscribe to new task notifications
    const taskChannel = supabase
      .channel(`notifications:${currentUser.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${currentUser.id}`
      }, (payload) => {
        console.log('🔔 New notification received:', payload.new);
        // Optimistically add to UI
        queryClient.setQueryData(['notifications', stableUserId], (old) => {
          if (!old || !old.notifications) return old;
          return {
            ...old,
            notifications: [payload.new, ...old.notifications]
          };
        });
      });
    
    // Subscribe to duplicate estimates
    const duplicateChannel = supabase
      .channel('duplicate-estimates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'duplicate_at_risk_estimates'
      }, () => {
        console.log('🔔 New duplicate estimate detected, invalidating notifications');
        queryClient.invalidateQueries({ queryKey: ['notifications', stableUserId] });
      });
    
    cacheChannel.subscribe();
    taskChannel.subscribe();
    duplicateChannel.subscribe();
    
    return () => {
      supabase.removeChannel(cacheChannel);
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(duplicateChannel);
    };
  }, [stableUserId, queryClient]);
  
  // Extract notifications from data - use cached data if available to prevent disappearing
  const allNotificationsRaw = notificationsData?.notifications || [];
  
  // Store previous notifications to prevent disappearing during refetch
  const previousNotificationsRef = useRef(allNotificationsRaw);
  useEffect(() => {
    if (allNotificationsRaw && allNotificationsRaw.length > 0) {
      previousNotificationsRef.current = allNotificationsRaw;
    }
  }, [allNotificationsRaw]);
  
  // Use cached data if current data is empty but we have previous data
  const stableNotificationsRaw = allNotificationsRaw.length > 0 
    ? allNotificationsRaw 
    : previousNotificationsRef.current;

  // Safety check: Filter out any notifications that don't match current user (defensive programming)
  // This ensures we never show notifications from other users, even if the API returns them
  // NOTE: Bulk notifications (neglected_account, renewal_reminder) don't have user_id because
  // they're already user-specific (fetched from user_notification_states table for this user)
  const allNotifications = useMemo(() => {
    if (!currentUserId) return previousNotificationsRef.current || [];
    const currentUserIdStr = String(currentUserId).trim();
    return stableNotificationsRaw.filter(notification => {
      // Bulk notifications (neglected_account, renewal_reminder) don't have user_id
      // They're already user-specific, so always include them
      if (notification.type === 'neglected_account' || notification.type === 'renewal_reminder') {
        return true; // Already user-specific, no need to check user_id
      }
      // Task notifications have user_id and must match current user
      const notificationUserId = notification.user_id ? String(notification.user_id).trim() : null;
      return notificationUserId === currentUserIdStr;
    });
  }, [stableNotificationsRaw, currentUserId]);

  // Removed forced refetch on mount - now uses cached data to reduce egress

  // Fetch tasks to check if they're overdue (needed to filter task_assigned notifications)
  // Add caching to reduce egress
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      try {
        return await base44.entities.Task.list();
      } catch (error) {
        console.error('🔔 NotificationBell: Error fetching tasks:', error);
        return [];
      }
    },
    enabled: !!currentUser?.id, // Only fetch if user is available
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on focus
  });

  // Create a set of overdue task IDs for quick lookup
  const overdueTaskIds = useMemo(() => {
    const now = new Date();
    return new Set(
      tasks
        .filter(task => {
          if (!task.due_date || task.status === 'completed') return false;
          return new Date(task.due_date) < now;
        })
        .map(task => task.id)
    );
  }, [tasks]);

  // Fetch universal snoozes (applies to all users)
  // Add caching to reduce egress
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
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on focus
  });

  // Fetch accounts and estimates to calculate renewal dates (source of truth)
  // Add caching to reduce egress
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
    enabled: !!currentUser?.id && !userLoading, // Wait for user to load
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on focus
  });
  
  const { data: estimates = [], isLoading: estimatesLoading } = useQuery({
    queryKey: ['estimates'],
    queryFn: async () => {
      const response = await fetch('/api/data/estimates');
      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    },
    enabled: !!currentUser?.id && !userLoading, // Wait for user to load
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch on focus
  });
  
  // Note: We now use the notification_cache as the source of truth for at-risk accounts
  // The cache is maintained by background jobs and includes all the same logic
  // This ensures consistency between Dashboard and NotificationBell

  // Use cached data from notification_cache for counts (same as Dashboard)
  // This ensures notification bell counts match dashboard counts and use the same source of truth
  const cachedCounts = useMemo(() => {
    const now = new Date();
    
    // Get at-risk accounts from cache (already filtered by snoozes in cache calculation)
    const atRiskFromCache = notificationsData?.atRiskAccounts || [];
    const atRiskCount = atRiskFromCache.filter(account => {
      // Double-check snoozes (cache should already filter, but verify client-side)
      const isSnoozed = snoozes.some(snooze => 
        snooze.notification_type === 'renewal_reminder' &&
        snooze.related_account_id === account.account_id &&
        new Date(snooze.snoozed_until) > now
      );
      return !isSnoozed;
    }).length;
    
    // Get neglected accounts from cache (already filtered by snoozes in cache calculation)
    const neglectedFromCache = notificationsData?.neglectedAccounts || [];
    const neglectedCount = neglectedFromCache.filter(account => {
      // Double-check snoozes (cache should already filter, but verify client-side)
      const isSnoozed = snoozes.some(snooze => 
        snooze.notification_type === 'neglected_account' &&
        snooze.related_account_id === account.account_id &&
        new Date(snooze.snoozed_until) > now
      );
      return !isSnoozed;
    }).length;
    
    return { atRisk: atRiskCount, neglected: neglectedCount };
  }, [notificationsData?.atRiskAccounts, notificationsData?.neglectedAccounts, snoozes]);
  
  // Filter out snoozed notifications and notifications for accounts that shouldn't be at_risk
  // Also ensure we only show notifications for the current user
  const activeNotifications = useMemo(() => {
    if (!currentUserId) {
      return [];
    }
    const currentUserIdStr = String(currentUserId).trim();
    
    const filteredCount = { renewal_reminder: 0, neglected_account: 0, task: 0 };
    const filteredOutCount = { renewal_reminder: 0, neglected_account: 0, task: 0 };
    const filteredOutReasons = { noUserId: 0, noAccountId: 0, snoozed: 0, taskOverdue: 0, other: 0 };
    
    const filtered = allNotifications.filter(notification => {
      // For JSONB notifications (neglected_account, renewal_reminder), they don't have user_id
      // because they're already user-specific (fetched from user_notification_states table)
      // For task notifications (individual rows), check user_id
      let notificationUserId = null;
      
      if (notification.type === 'neglected_account' || notification.type === 'renewal_reminder') {
        // JSONB notifications are already user-specific, no need to check user_id
        // They were fetched specifically for this user
      } else {
        // Task notifications need user_id check
        notificationUserId = notification.user_id ? String(notification.user_id).trim() : null;
        if (notificationUserId !== currentUserIdStr) {
          filteredOutReasons.noUserId++;
          return false; // Not for current user
        }
      }
      
      // Debug logging for task_overdue notifications
      if (notification.type === 'task_overdue') {
        const userMatch = notificationUserId === currentUserIdStr;
        // Task overdue notifications are always shown if they match the current user
      }
      
    // For renewal reminders, always show them (server is source of truth)
    // The client-side calculation is just for verification/debugging
    if (notification.type === 'renewal_reminder') {
      // Handle null, undefined, or 'null' string values
      const accountId = notification.related_account_id;
      if (!accountId || accountId === 'null' || accountId === null || accountId === undefined) {
        filteredOutReasons.noAccountId++;
        return false; // No account ID means we can't verify if it should be at-risk
      }
      
      // Always show renewal reminders - server created them, so they're valid
      
      // Continue to snooze check below (don't filter out based on at-risk calculation)
    }
    
    // For neglected_account notifications, they should always be shown (server created them)
    // Just need to check if snoozed (check happens below)
    if (notification.type === 'neglected_account') {
      // Continue to snooze check below - don't filter out
    }
    
    // For task_assigned notifications, hide them if the task is overdue
    // (overdue tasks should only show task_overdue notifications, not task_assigned)
    if (notification.type === 'task_assigned' && notification.related_task_id) {
      if (overdueTaskIds.has(notification.related_task_id)) {
        return false; // Hide task_assigned notification for overdue tasks
      }
    }
    
    // Check if this notification is snoozed (universal)
    // Note: Task notifications (task_overdue, task_due_today, task_reminder, task_assigned) 
    // and bug_report notifications are not snoozeable via the notification_snoozes table, so skip snooze check for them
    if (notification.type.startsWith('task_') || notification.type === 'bug_report') {
      return true; // Task and bug report notifications are not snoozeable, always show them (unless filtered above)
    }
    
    // Safety check: if snoozes haven't loaded yet, show the notification (don't filter it out)
    // Also, if snoozes is an empty array, show all notifications
    if (!snoozes || !Array.isArray(snoozes) || snoozes.length === 0) {
      return true; // No snoozes loaded, show all notifications
    }
    
    const now = new Date();
    const notificationAccountId = notification.related_account_id 
      ? String(notification.related_account_id).trim() 
      : null;
    
    // For renewal_reminder and neglected_account: these are UNIVERSAL notifications
    // If ANY user snoozes them, they're snoozed for ALL users
    // Check if this specific notification is snoozed
    // Only match snoozes that:
    // 1. Have the same notification type
    // 2. Have the same account ID (or both are null for universal snoozes)
    // 3. Are still active (not expired) - API already filters this, but double-check
    const isSnoozed = snoozes.some(snooze => {
      // Type must match exactly
      if (snooze.notification_type !== notification.type) return false;
      
      // Check account ID match (handle null/undefined/'null' string)
      const snoozeAccountId = snooze.related_account_id 
        ? String(snooze.related_account_id).trim() 
        : null;
      
      // For account ID matching (universal snoozes):
      // - If notification has an account ID, snooze must have the SAME account ID
      // - If notification has NO account ID (null), only match snoozes that also have NO account ID (universal snooze for this type)
      // - Never match a notification with an account ID to a snooze without one (or vice versa)
      if (notificationAccountId && notificationAccountId !== 'null') {
        // Notification has an account ID - snooze must match exactly
        if (!snoozeAccountId || snoozeAccountId === 'null') return false;
        if (notificationAccountId !== snoozeAccountId) return false;
      } else {
        // Notification has NO account ID - only match snoozes that also have NO account ID (universal snooze)
        if (snoozeAccountId && snoozeAccountId !== 'null') return false;
      }
      
      // Double-check if snooze is still active (API should already filter, but be safe)
      const snoozedUntil = new Date(snooze.snoozed_until);
      if (isNaN(snoozedUntil.getTime())) {
        console.warn(`⚠️ Invalid snooze date for snooze:`, snooze);
        return false; // Invalid date, don't match
      }
      return snoozedUntil > now;
    });
    
    
    const shouldShow = !isSnoozed;
    
    if (isSnoozed) {
      filteredOutReasons.snoozed++;
    }
    
    // Track filtering with detailed logging (only log first few to avoid spam)
    if (notification.type === 'renewal_reminder' || notification.type === 'neglected_account' || notification.type.startsWith('task_')) {
      const typeKey = notification.type === 'renewal_reminder' ? 'renewal_reminder' : notification.type === 'neglected_account' ? 'neglected_account' : 'task';
      if (shouldShow) {
        filteredCount[typeKey]++;
      } else {
        filteredOutCount[typeKey]++;
        // Only log if all notifications are being filtered (critical issue)
        // Otherwise, silent filtering to reduce console spam
      }
    }
    
    return shouldShow;
    });
    
    // Log filtering results
    const totalFilteredOut = filteredOutCount.renewal_reminder + filteredOutCount.neglected_account + filteredOutCount.task;
    const totalShown = filteredCount.renewal_reminder + filteredCount.neglected_account + filteredCount.task;
    const now = new Date();
    const activeSnoozes = snoozes?.filter(s => {
      const until = new Date(s.snoozed_until);
      return !isNaN(until.getTime()) && until > now;
    }) || [];
    
    // Only log if there are notifications and some were filtered out (to diagnose issues)
    if (allNotifications.length > 0 && totalFilteredOut > 0 && totalShown === 0) {
      // Critical: All notifications filtered out - this indicates a problem
      console.error(`❌ CRITICAL: All ${allNotifications.length} notifications were filtered out!`, {
        totalNotifications: allNotifications.length,
        totalFilteredOut,
        snoozesCount: snoozes?.length || 0,
        activeSnoozesCount: activeSnoozes.length,
        filterReasons: filteredOutReasons,
        sampleSnoozes: activeSnoozes.slice(0, 3).map(s => ({
          type: s.notification_type,
          account_id: s.related_account_id || 'null (universal)',
          snoozed_until: s.snoozed_until
        }))
      });
    }
    
    return filtered;
  }, [allNotifications, currentUserId, snoozes, overdueTaskIds]);

  // Debug logging removed to reduce console noise

  // Sort by newest first (created_at descending), then unread status
  // This ensures newest notifications (usually tasks) appear at the top
  const sortedNotifications = [...activeNotifications].sort((a, b) => {
    // First, sort by creation date (newest first)
    const dateA = new Date(a.created_at || a.scheduled_for || 0);
    const dateB = new Date(b.created_at || b.scheduled_for || 0);
    const dateDiff = dateB - dateA; // Newest first
    
    // If dates are the same (or very close), prioritize unread
    if (Math.abs(dateDiff) < 1000) { // Within 1 second
      if (a.is_read !== b.is_read) {
        return a.is_read ? 1 : -1; // Unread first
      }
    }
    
    return dateDiff; // Newest first
  });

  // Group notifications by type
  // Additional safety: filter by current user before grouping
  const groupedNotifications = useMemo(() => {
    const currentUserIdStr = currentUserId ? String(currentUserId).trim() : null;
    const userFilteredNotifications = currentUserIdStr 
      ? sortedNotifications.filter(n => {
          // JSONB notifications (neglected_account, renewal_reminder) don't have user_id
          // They're already user-specific (fetched from user_notification_states)
          if (n.type === 'neglected_account' || n.type === 'renewal_reminder') {
            return true; // Already user-specific
          }
          // Task notifications need user_id check
          const notificationUserId = n.user_id ? String(n.user_id).trim() : null;
          return notificationUserId === currentUserIdStr;
        })
      : sortedNotifications;
    
    return userFilteredNotifications.reduce((groups, notification) => {
      const type = notification.type;
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push(notification);
      return groups;
    }, {});
  }, [sortedNotifications, currentUserId]);

  // Extract priority from bug report notification (must be defined before useMemo that uses it)
  const getBugReportPriority = (notification) => {
    if (notification.type !== 'bug_report') return null;
    
    try {
      if (notification.message && notification.message.includes('---FULL_DATA---')) {
        const parts = notification.message.split('---FULL_DATA---\n');
        if (parts[1]) {
          const bugReportData = JSON.parse(parts[1]);
          return bugReportData.priority || 'medium';
        }
      }
    } catch (e) {
      console.error('Error parsing bug report priority:', e);
    }
    
    return 'medium'; // Default
  };

  // Get priority badge styling for bug reports (must be defined before useMemo that uses it)
  const getPriorityBadge = (priorityValue) => {
    const priorityLabels = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      critical: 'Critical'
    };
    const priorityStyles = {
      low: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700',
      medium: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
      high: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700',
      critical: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700'
    };
    const priority = priorityValue || 'medium';
    const label = priorityLabels[priority] || 'Medium';
    const style = priorityStyles[priority] || priorityStyles.medium;
    
    return (
      <Badge className={`${style} border text-xs font-semibold px-2 py-0.5`}>
        {label}
      </Badge>
    );
  };

  // Convert grouped object to array of groups
  // Use useMemo to ensure recalculation when snoozes change
  // Note: groupedNotifications already filters by current user, so notifications here are already filtered
  const notificationGroups = useMemo(() => {
    if (!currentUserId) return [];
    
    const taskOverdueInGrouped = groupedNotifications['task_overdue'] || [];
    
    return Object.entries(groupedNotifications).map(([type, notifications]) => {
      // Sort notifications within each group by newest first, then unread status
      // For bug reports, also sort by priority (critical > high > medium > low)
      const sortedGroupNotifications = [...notifications].sort((a, b) => {
        // For bug reports, prioritize by priority level first
        if (type === 'bug_report') {
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          const priorityA = priorityOrder[getBugReportPriority(a)] || 2;
          const priorityB = priorityOrder[getBugReportPriority(b)] || 2;
          if (priorityA !== priorityB) {
            return priorityB - priorityA; // Higher priority first
          }
        }
        
        // Then sort by creation date (newest first)
        const dateA = new Date(a.created_at || a.scheduled_for || 0);
        const dateB = new Date(b.created_at || b.scheduled_for || 0);
        const dateDiff = dateB - dateA; // Newest first
        
        // If dates are the same (or very close), prioritize unread
        if (Math.abs(dateDiff) < 1000) { // Within 1 second
          if (a.is_read !== b.is_read) {
            return a.is_read ? 1 : -1; // Unread first
          }
        }
        
        return dateDiff; // Newest first
      });
      // Notifications are already filtered by user in groupedNotifications
      // For renewal_reminder and neglected_account, count unique accounts instead of total notifications
      // This prevents showing duplicate counts if there are multiple notifications per account
      // Also ensures snoozed notifications are excluded (they should already be filtered in activeNotifications)
      // Use sortedGroupNotifications for counts to match what we display
      let count = sortedGroupNotifications.length;
      let unreadCount = sortedGroupNotifications.filter(n => !n.is_read).length;
      
      if (type === 'renewal_reminder' || type === 'neglected_account') {
        // Additional safety: filter out any snoozed notifications (they should already be filtered, but double-check)
        // This ensures snoozed notifications don't affect the badge or unread count
        const now = new Date();
        const activeNotificationsOnly = sortedGroupNotifications.filter(n => {
          // Check if this notification is snoozed
          if (!snoozes || !Array.isArray(snoozes)) {
            return true; // If snoozes not loaded, include all
          }
          
          // Check for snooze match - need to handle string/number/object comparisons
          const isSnoozed = snoozes.some(snooze => {
            // Type must match
            if (snooze.notification_type !== n.type) return false;
            
            // Check if snooze is still active
            const snoozedUntil = new Date(snooze.snoozed_until);
            if (snoozedUntil <= now) return false; // Snooze expired
            
            // Check account ID match - handle null, undefined, and string comparisons
            const snoozeAccountId = snooze.related_account_id ? String(snooze.related_account_id).trim() : null;
            const notifAccountId = n.related_account_id ? String(n.related_account_id).trim() : null;
            
            // Both null/empty means match (general snooze for this type)
            if (!snoozeAccountId && !notifAccountId) return true;
            
            // One is null, one isn't - no match
            if (!snoozeAccountId || !notifAccountId) return false;
            
            // Both have values - compare as strings
            return snoozeAccountId === notifAccountId;
          });
          
          return !isSnoozed;
        });
        
        // Debug: log if we filtered out any notifications
        if (type === 'neglected_account') {
          if (false) { // Debug logging disabled
            if (notifications.length !== activeNotificationsOnly.length) {
            console.log(`🔔 Neglected account: Filtered ${notifications.length - activeNotificationsOnly.length} snoozed notifications (${notifications.length} -> ${activeNotificationsOnly.length})`);
          } else {
            console.log(`🔔 Neglected account: No snoozed notifications found (checked ${snoozes?.length || 0} snoozes)`);
            // Debug: show what snoozes exist and why they're not matching
            if (snoozes && snoozes.length > 0) {
              const snoozeDetails = snoozes.map(s => ({
                id: s.id,
                notification_type: s.notification_type,
                related_account_id: s.related_account_id,
                related_account_id_type: typeof s.related_account_id,
                snoozed_until: s.snoozed_until,
                isExpired: new Date(s.snoozed_until) <= now
              }));
              console.log(`🔔 All snoozes (${snoozes.length}):`, JSON.stringify(snoozeDetails, null, 2));
              const neglectedSnoozes = snoozes.filter(s => s.notification_type === 'neglected_account');
              console.log(`🔔 Found ${neglectedSnoozes.length} neglected_account snoozes`);
              
              // Check why notifications aren't matching - test against ALL notifications
              if (snoozes.length > 0 && notifications.length > 0) {
                const sampleSnooze = snoozes[0];
                console.log(`🔔 Sample snooze:`, JSON.stringify({
                  id: sampleSnooze.id,
                  notification_type: sampleSnooze.notification_type,
                  related_account_id: sampleSnooze.related_account_id,
                  related_account_id_type: typeof sampleSnooze.related_account_id,
                  snoozed_until: sampleSnooze.snoozed_until,
                  isExpired: new Date(sampleSnooze.snoozed_until) <= now
                }, null, 2));
                
                // Test first few notifications
                notifications.slice(0, 3).forEach((notif, idx) => {
                  const snoozeAccountId = sampleSnooze.related_account_id ? String(sampleSnooze.related_account_id).trim() : null;
                  const notifAccountId = notif.related_account_id ? String(notif.related_account_id).trim() : null;
                  const typeMatch = sampleSnooze.notification_type === notif.type;
                  const accountMatch = (snoozeAccountId === notifAccountId) || (!snoozeAccountId && !notifAccountId);
                  const notExpired = new Date(sampleSnooze.snoozed_until) > now;
                  const shouldMatch = typeMatch && accountMatch && notExpired;
                  
                  console.log(`🔔 Notification ${idx} match test:`, {
                    notifType: notif.type,
                    notifAccountId,
                    snoozeType: sampleSnooze.notification_type,
                    snoozeAccountId,
                    typeMatch,
                    accountMatch,
                    notExpired,
                    shouldMatch
                  });
                });
              }
            }
          }
          }
        }
        
        // For renewal_reminder and neglected_account, use cached counts from notification_cache
        // This ensures notification bell counts match dashboard counts and use the same source of truth
        if (type === 'renewal_reminder') {
          count = cachedCounts.atRisk;
          // For unread count, use the same as count (all matching accounts are considered unread)
          unreadCount = cachedCounts.atRisk;
        } else if (type === 'neglected_account') {
          count = cachedCounts.neglected;
          // For unread count, use the same as count (all matching accounts are considered unread)
          unreadCount = cachedCounts.neglected;
        } else {
          // For other types, count unique accounts from notifications
          const allAccountIds = activeNotificationsOnly
            .map(n => n.related_account_id)
            .filter(id => id && id !== 'null' && id !== null)
            .map(id => String(id).trim());
          
          const uniqueAccountIds = new Set(allAccountIds);
          count = uniqueAccountIds.size;
          
          // For unread count, use the EXACT SAME logic as count, but only for unread notifications
          const unreadNotifications = activeNotificationsOnly.filter(n => !n.is_read);
          const unreadAccountIds = unreadNotifications
            .map(n => n.related_account_id)
            .filter(id => id && id !== 'null' && id !== null)
            .map(id => String(id).trim());
          
          const uniqueUnreadAccountIds = new Set(unreadAccountIds);
          unreadCount = uniqueUnreadAccountIds.size;
          
          // Safety: if calculation somehow fails, fall back to count
          if (unreadCount > count) {
            console.warn(`⚠️ unreadCount (${unreadCount}) > count (${count}), using count instead`);
            unreadCount = count;
          }
        }
        
        // Debug logging disabled to reduce console noise
        // Uncomment if needed for debugging:
        // if (unreadNotifications.length !== unreadCount && unreadNotifications.length > 0) {
        //   console.log(`🔔 Unread count mismatch: ${unreadNotifications.length} unread notifications, ${unreadCount} unique accounts`);
        // }
      }
      
      const group = {
        type,
        notifications: sortedGroupNotifications, // Use sorted notifications (newest first, unread first)
        count,
        unreadCount
      };
      
      // Debug logging disabled to reduce console noise
      
      return group;
    });
  }, [groupedNotifications, currentUserId, snoozes]);

  // Define notification type priority (lower number = higher priority)
  // Order: At Risk (1) -> Neglected Accounts (2) -> Overdue Tasks (3) -> Others
  const getTypePriority = (type) => {
    const priorities = {
      'renewal_reminder': 1,        // At Risk - highest priority
      'neglected_account': 2,       // Neglected Accounts - second priority
      'bug_report': 2.5,            // Bug Reports - high priority (after neglected accounts)
      'task_overdue': 3,            // Overdue Tasks - third priority (after neglected accounts)
      'task_assigned': 4,
      'task_due_today': 5,
      'task_reminder': 6,
      'ticket_opened': 2.5,       // New tickets - high priority (same as bug reports)
      'ticket_comment': 3.5,      // Ticket comments - high priority
      'ticket_status_change': 3.5, // Ticket status changes - high priority
      'ticket_assigned': 3.5,     // Ticket assignments - high priority
      'ticket_archived': 3.5,     // Ticket archived - high priority
      'end_of_year_analysis': 7
    };
    return priorities[type] || 99; // Unknown types go last
  };

  // Sort groups by priority first, then by newest notification, then unread count
  notificationGroups.sort((a, b) => {
    // First, sort by type priority (priority takes precedence over date)
    const priorityA = getTypePriority(a.type);
    const priorityB = getTypePriority(b.type);
    if (priorityA !== priorityB) {
      return priorityA - priorityB; // Lower priority number = higher priority
    }
    // Then by newest notification in each group (newest groups first)
    const newestA = a.notifications.length > 0 
      ? new Date(a.notifications[0].created_at || a.notifications[0].scheduled_for || 0).getTime()
      : 0;
    const newestB = b.notifications.length > 0 
      ? new Date(b.notifications[0].created_at || b.notifications[0].scheduled_for || 0).getTime()
      : 0;
    if (newestA !== newestB) {
      return newestB - newestA; // Newest first
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

  const deleteNotificationMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onMutate: async (deletedId) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      
      // Snapshot the previous value
      const previousNotifications = queryClient.getQueryData(['notifications', currentUserId]);
      
      // Optimistically remove the deleted notification from cache
      queryClient.setQueryData(['notifications', currentUserId], (old) => {
        if (!old || !old.notifications) return old;
        return {
          ...old,
          notifications: old.notifications.filter(n => n.id !== deletedId)
        };
      });
      
      // Return context with snapshot
      return { previousNotifications };
    },
    onSuccess: () => {
      // Invalidate to ensure server state is synced, but optimistic update already handled UI
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('✓ Notification deleted');
    },
    onError: (error, deletedId, context) => {
      // Rollback to previous state on error
      if (context?.previousNotifications) {
        queryClient.setQueryData(['notifications', currentUserId], context.previousNotifications);
      }
      console.error('Error deleting notification:', error);
      toast.error(error.message || 'Failed to delete notification');
    }
  });

  // Calculate total unread count from grouped notifications (respects unique account logic)
  const totalUnreadCount = notificationGroups.reduce((sum, group) => {
    // For renewal_reminder and neglected_account, use unreadCount (unique accounts)
    // For other types, use unreadCount (which equals count for non-account types)
    return sum + (group.unreadCount || 0);
  }, 0);
  
  // For badge count, show total unread from groups (respects unique account logic)
  const displayUnreadCount = totalUnreadCount;

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
      // Handle both JSONB notifications (from user_notification_states) and individual row notifications
      if (notification.type === 'neglected_account' || notification.type === 'renewal_reminder') {
        // JSONB notification - update via userNotificationStates API
        try {
          const response = await fetch('/api/data/userNotificationStates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update_read',
              data: {
                user_id: currentUserId,
                notification_id: notification.id,
                is_read: true
              }
            })
          });
          const result = await response.json();
          if (!result.success) {
            console.error('Error marking JSONB notification as read:', result.error);
          }
        } catch (error) {
          console.error('Error marking JSONB notification as read:', error);
        }
      } else {
        // Individual row notification - use standard API
        try {
          await base44.entities.Notification.markAsRead(notification.id);
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      }
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
  const [bugReportDialogOpen, setBugReportDialogOpen] = useState(false);
  const [selectedBugReport, setSelectedBugReport] = useState(null);

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
    
    // Show bug report details in a dialog
    if (notification.type === 'bug_report') {
      setSelectedBugReport(notification);
      setBugReportDialogOpen(true);
      setIsOpen(false);
      return;
    }
    
    // Navigate based on notification type
    if (notification.type === 'end_of_year_analysis') {
      // Helper to get current year (respects year selector) - REQUIRED, no fallback
      // Per user requirement: Never fall back to current year, only ever go by selected year
      function getCurrentYearForCalculation() {
        // Use window function if available (set by TestModeProvider)
        if (typeof window !== 'undefined' && window.__testModeGetCurrentYear) {
          return window.__testModeGetCurrentYear();
        }
        // Fallback to YearSelectorContext
        if (typeof window !== 'undefined' && window.__getCurrentYear) {
          return window.__getCurrentYear();
        }
        // No fallback - selected year is required
        throw new Error('NotificationBell.getCurrentYearForCalculation: YearSelectorContext not initialized. Selected year is required.');
      }
      const currentYear = getCurrentYearForCalculation();
      navigate(`${createPageUrl('Reports')}?year=${currentYear}`);
      setIsOpen(false);
    } else if (notification.related_ticket_id) {
      navigate(createPageUrl(`TicketDetail?id=${notification.related_ticket_id}`));
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
      case 'task_assigned':
        return <User className="w-6 h-6 text-blue-600" />;
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
      case 'bug_report':
        return <Bug className="w-6 h-6 text-red-600" />;
      case 'ticket_comment':
        return <MessageSquare className="w-6 h-6 text-blue-600" />;
      case 'ticket_status_change':
        return <Ticket className="w-6 h-6 text-purple-600" />;
      case 'ticket_assigned':
        return <Ticket className="w-6 h-6 text-green-600" />;
      case 'ticket_archived':
        return <Archive className="w-6 h-6 text-amber-600" />;
      case 'ticket_opened':
        return <Ticket className="w-6 h-6 text-blue-600" />;
      default:
        return <Mail className="w-6 h-6 text-slate-600" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'task_assigned':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'task_overdue':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800';
      case 'task_due_today':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
      case 'end_of_year_analysis':
        return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';
      case 'renewal_reminder':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'neglected_account':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
      case 'bug_report':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'ticket_comment':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      case 'ticket_status_change':
        return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800';
      case 'ticket_assigned':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'ticket_archived':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
      case 'ticket_opened':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };


  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
        title={displayUnreadCount > 0 ? `${displayUnreadCount} unread notification${displayUnreadCount !== 1 ? 's' : ''}` : 'Notifications'}
      >
        <Bell className="w-5 h-5" />
        {displayUnreadCount > 0 && (
          <>
            {/* Pulse animation ring */}
            <div className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full animate-ping opacity-75" />
            {/* Badge */}
            <Badge className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center p-0 bg-red-500 text-white text-[10px] font-semibold z-10">
              {displayUnreadCount > 9 ? '9+' : displayUnreadCount}
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
          <div className={isNativeApp ? "fixed left-0 right-0 flex justify-center px-4" : "absolute right-0 mt-2"} style={isNativeApp ? {
            top: `calc(4rem + env(safe-area-inset-top, 0px) + 0.5rem)`,
            paddingLeft: `max(1rem, env(safe-area-inset-left, 0px) + 1rem)`,
            paddingRight: `max(1rem, env(safe-area-inset-right, 0px) + 1rem)`,
            zIndex: 100 // Higher than announcement banner (55) to ensure it appears on top
          } : {
            top: '100%',
            zIndex: 100 // Higher than announcement banner (55) to ensure it appears on top
          }}>
            <Card className="max-h-[600px] overflow-y-auto shadow-xl w-full max-w-sm">
            <CardContent className="p-0">
              <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-[#ffffff]">Notifications</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAllAsReadMutation.mutate()}
                    className="text-xs"
                    disabled={displayUnreadCount === 0}
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
              
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {notificationGroups.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                    <Bell className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p>No notifications</p>
                  </div>
                ) : (
                  notificationGroups.map((group) => {
                    const isExpanded = expandedGroups.has(group.type);
                    const hasMultiple = group.count > 1;
                    const groupName = group.type === 'renewal_reminder' ? 'At Risk Accounts' :
                                     group.type === 'neglected_account' ? 'Neglected Accounts' :
                                     group.type === 'task_assigned' ? 'Task Assignments' :
                                     group.type === 'task_reminder' ? 'Task Reminders' :
                                     group.type === 'task_overdue' ? 'Overdue Tasks' :
                                     group.type === 'task_due_today' ? 'Tasks Due Today' :
                                     group.type === 'ticket_comment' ? 'Ticket Comments' :
                                     group.type === 'ticket_status_change' ? 'Ticket Updates' :
                                     group.type === 'ticket_assigned' ? 'Ticket Assignments' :
                                     group.type === 'ticket_archived' ? 'Archived Tickets' :
                                     group.type === 'end_of_year_analysis' ? 'Reports' :
                                     group.type === 'bug_report' ? 'Bug Reports' :
                                     'Notifications';

                    return (
                      <div key={group.type} className="divide-y divide-slate-100 dark:divide-slate-700">
                        {/* Group Header - Clickable to expand/collapse if multiple */}
                        <div 
                          className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${
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
                                  <h4 className={`text-sm font-medium ${group.unreadCount > 0 ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-text-muted'}`}>
                                    {hasMultiple ? groupName : group.notifications[0]?.title || groupName}
                                  </h4>
                                  {!hasMultiple && group.notifications[0]?.type === 'bug_report' && getPriorityBadge(getBugReportPriority(group.notifications[0]))}
                                  {hasMultiple && (
                                    <Badge variant="secondary" className="text-xs">
                                      {/* For renewal reminders and neglected accounts, show unread count (accounts with unread notifications) */}
                                      {/* For other types, show total count */}
                                      {(group.type === 'renewal_reminder' || group.type === 'neglected_account') 
                                        ? (group.unreadCount > 0 ? group.unreadCount : group.count)
                                        : group.count}
                                    </Badge>
                                  )}
                                  {group.unreadCount > 0 && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {hasMultiple && (
                                    <ChevronRight 
                                      className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                    />
                                  )}
                                  {!hasMultiple && (
                                    <>
                                      {(group.notifications[0]?.type === 'renewal_reminder' || group.notifications[0]?.type === 'neglected_account') && (
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
                                      {/* Only allow deleting individual notifications, not groups */}
                                      {/* Single notification can be deleted from here */}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (group.notifications[0] && confirm('Are you sure you want to delete this notification?')) {
                                            deleteNotificationMutation.mutate(group.notifications[0].id);
                                          }
                                        }}
                                        title="Delete this notification"
                                        disabled={deleteNotificationMutation.isPending}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </>
                                  )}
                                  {/* Never show delete button on group header when multiple notifications exist */}
                                  {/* Users must expand the group and delete individual notifications */}
                                </div>
                              </div>
                              {hasMultiple && (
                                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                                  {(() => {
                                    // Debug logging removed
                                    return group.unreadCount > 0 
                                      ? `${group.unreadCount} unread ${group.unreadCount === 1 ? 'notification' : 'notifications'}`
                                      : `${group.count} ${group.count === 1 ? 'notification' : 'notifications'}`;
                                  })()}
                                </p>
                              )}
                              {!hasMultiple && group.notifications[0] && (
                                <>
                                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                                    {group.notifications[0].message}
                                  </p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
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
                          <div className="bg-slate-50 dark:bg-slate-800/50">
                            {group.notifications.map((notification) => (
                              <div
                                key={notification.id}
                                className={`p-4 pl-12 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors border-l-2 border-slate-200 dark:border-slate-700 ${
                                  !notification.is_read ? getNotificationColor(notification.type) : ''
                                }`}
                              >
                                <div 
                                  className="flex-1 min-w-0 cursor-pointer"
                                  onClick={() => handleNotificationClick(notification)}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <h4 className={`text-sm font-medium ${!notification.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-text-muted'}`}>
                                        {notification.title}
                                      </h4>
                                      {notification.type === 'bug_report' && getPriorityBadge(getBugReportPriority(notification))}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {!notification.is_read && (
                                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm('Are you sure you want to delete this notification?')) {
                                            deleteNotificationMutation.mutate(notification.id);
                                          }
                                        }}
                                        title="Delete this notification"
                                        disabled={deleteNotificationMutation.isPending}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
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
                                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
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

      {/* Bug Report Details Dialog */}
      <Dialog open={bugReportDialogOpen} onOpenChange={setBugReportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-red-600" />
              Bug Report Details
            </DialogTitle>
            <DialogDescription>
              Full debugging information from the bug report
            </DialogDescription>
          </DialogHeader>
          {selectedBugReport && (() => {
            // Parse full bug report data from message
            let bugReportData = null;
            let messagePreview = selectedBugReport.message;
            
            if (selectedBugReport.message && selectedBugReport.message.includes('---FULL_DATA---')) {
              const parts = selectedBugReport.message.split('---FULL_DATA---\n');
              messagePreview = parts[0].trim();
              try {
                bugReportData = JSON.parse(parts[1] || '{}');
              } catch (e) {
                console.error('Error parsing bug report data:', e);
              }
            }
            
            return (
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Reported At</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      {format(new Date(selectedBugReport.created_at), 'PPpp')}
                    </p>
                  </div>
                  {bugReportData?.priority && getPriorityBadge(bugReportData.priority)}
                </div>

                <div>
                  <Label className="text-sm font-semibold">Description</Label>
                  <div className="mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                      {bugReportData?.description || messagePreview}
                    </p>
                  </div>
                </div>

                {bugReportData?.userEmail && bugReportData.userEmail !== 'Not provided' && (
                  <div>
                    <Label className="text-sm font-semibold">Reporter Email</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      {bugReportData.userEmail}
                    </p>
                  </div>
                )}

                {bugReportData?.userInfo && (
                  <div>
                    <Label className="text-sm font-semibold">User Information</Label>
                    <div className="mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                        <p><strong>URL:</strong> {bugReportData.userInfo.url || 'Unknown'}</p>
                        <p><strong>User Agent:</strong> {bugReportData.userInfo.userAgent || 'Unknown'}</p>
                        <p><strong>Viewport:</strong> {bugReportData.userInfo.viewport?.width || 'Unknown'}x{bugReportData.userInfo.viewport?.height || 'Unknown'}</p>
                        <p><strong>Timestamp:</strong> {bugReportData.userInfo.timestamp ? format(new Date(bugReportData.userInfo.timestamp), 'PPpp') : 'Unknown'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {bugReportData?.selectedElement && (
                  <div>
                    <Label className="text-sm font-semibold">Selected Element</Label>
                    <div className="mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
                        <p><strong>Tag:</strong> {bugReportData.selectedElement.tagName || 'N/A'}</p>
                        <p><strong>ID:</strong> {bugReportData.selectedElement.id || 'None'}</p>
                        <p><strong>Class:</strong> {bugReportData.selectedElement.className || 'None'}</p>
                        <p><strong>XPath:</strong> {bugReportData.selectedElement.xpath || 'N/A'}</p>
                        {bugReportData.selectedElement.textContent && (
                          <p><strong>Text Content:</strong> {bugReportData.selectedElement.textContent.substring(0, 200)}{bugReportData.selectedElement.textContent.length > 200 ? '...' : ''}</p>
                        )}
                      </div>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200">
                          View Full Element Details (JSON)
                        </summary>
                        <pre className="mt-2 p-2 bg-slate-100 dark:bg-slate-900 text-xs overflow-x-auto rounded">
                          {JSON.stringify(bugReportData.selectedElement, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </div>
                )}

                {bugReportData?.consoleLogs && bugReportData.consoleLogs.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold">Console Logs ({bugReportData.consoleLogs.length} entries)</Label>
                    <div className="mt-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg max-h-96 overflow-y-auto">
                      <pre className="text-xs text-slate-700 dark:text-slate-200 font-mono whitespace-pre-wrap">
                        {bugReportData.consoleLogs.map(log => 
                          `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`
                        ).join('\n')}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setBugReportDialogOpen(false);
                      setSelectedBugReport(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

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

