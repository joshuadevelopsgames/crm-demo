import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, Check, X, BellOff, ChevronDown, ChevronRight, RefreshCw, Clock, AlertCircle, AlertTriangle, Clipboard, BarChart, Mail, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, isToday, isPast, differenceInDays, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Capacitor } from '@capacitor/core';
import { snoozeNotification } from '@/services/notificationService';
import { useUser } from '@/contexts/UserContext';
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
  const { user: contextUser, profile } = useUser();
  const currentUser = contextUser || profile;
  const currentUserId = currentUser?.id;

  // Fetch notifications for current user (all notifications, sorted by newest first)
  const { data: allNotificationsRaw = [], refetch: refetchNotifications } = useQuery({
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

  // Safety check: Filter out any notifications that don't match current user (defensive programming)
  // This ensures we never show notifications from other users, even if the API returns them
  const allNotifications = useMemo(() => {
    if (!currentUserId) return [];
    const currentUserIdStr = String(currentUserId).trim();
    return allNotificationsRaw.filter(notification => {
      const notificationUserId = notification.user_id ? String(notification.user_id).trim() : null;
      return notificationUserId === currentUserIdStr;
    });
  }, [allNotificationsRaw, currentUserId]);

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
  // Also ensure we only show notifications for the current user
  const activeNotifications = useMemo(() => {
    if (!currentUserId) return [];
    const currentUserIdStr = String(currentUserId).trim();
    
    return allNotifications.filter(notification => {
      // First, ensure this notification belongs to the current user
      const notificationUserId = notification.user_id ? String(notification.user_id).trim() : null;
      if (notificationUserId !== currentUserIdStr) {
        return false; // Not for current user
      }
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
  }, [allNotifications, currentUserId, accountsThatShouldBeAtRisk, accountsLoading, estimatesLoading, accounts.length, estimates.length, atRiskCalculationComplete, snoozes]);

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

  // Convert grouped object to array of groups
  // Use useMemo to ensure recalculation when snoozes change
  // Note: groupedNotifications already filters by current user, so notifications here are already filtered
  const notificationGroups = useMemo(() => {
    if (!currentUserId) return [];
    
    return Object.entries(groupedNotifications).map(([type, notifications]) => {
      // Sort notifications within each group by newest first, then unread status
      const sortedGroupNotifications = [...notifications].sort((a, b) => {
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
        
        // Normalize account IDs to strings for proper Set deduplication
        const allAccountIds = activeNotificationsOnly
          .map(n => n.related_account_id)
          .filter(id => id && id !== 'null' && id !== null)
          .map(id => String(id).trim());
        const uniqueAccountIds = new Set(allAccountIds);
        count = uniqueAccountIds.size;
        
        // For unread count, use the EXACT SAME logic as count, but only for unread notifications
        // This ensures consistency - if count works, unreadCount will work the same way
        const unreadNotifications = activeNotificationsOnly.filter(n => !n.is_read);
        
        // Use EXACT same pattern as count calculation above
        const unreadAccountIds = unreadNotifications
          .map(n => n.related_account_id)
          .filter(id => id && id !== 'null' && id !== null)
          .map(id => String(id).trim()); // Same normalization as count
        const uniqueUnreadAccountIds = new Set(unreadAccountIds); // Same Set logic as count
        unreadCount = uniqueUnreadAccountIds.size; // Same size calculation as count
        
        // Safety: if calculation somehow fails, fall back to count (all accounts have unread)
        if (unreadCount > count) {
          console.warn(`⚠️ unreadCount (${unreadCount}) > count (${count}), using count instead`);
          unreadCount = count;
        }
        
        // Debug: log account IDs if count doesn't match
        if (unreadNotifications.length !== unreadCount && unreadNotifications.length > 0) {
          console.log(`🔔 Unread count mismatch: ${unreadNotifications.length} unread notifications, ${unreadCount} unique accounts`);
          console.log(`🔔 Account IDs:`, Array.from(uniqueUnreadAccountIds).slice(0, 10));
          console.log(`🔔 All account IDs (with duplicates):`, unreadAccountIds.slice(0, 20));
        }
        
        // Debug logging for renewal reminders and neglected accounts
        if (notifications.length > 0) {
          const typeLabel = type === 'renewal_reminder' ? 'Renewal reminder' : 'Neglected account';
          console.log(`🔔 ${typeLabel} group: ${notifications.length} notifications (${activeNotificationsOnly.length} after snooze filter), ${count} unique accounts, ${unreadNotifications.length} unread notifications, ${unreadCount} unique unread accounts`);
          console.log(`🔔 Display values: count=${count}, unreadCount=${unreadCount} (should be used for badge and text)`);
          console.log(`🔔 VERIFY: unreadCount should be ${unreadCount}, not ${unreadNotifications.length}`);
          console.log(`🔔 CRITICAL: The badge should show ${count} and text should show "${unreadCount} unread notifications"`);
          
          // For neglected accounts, show detailed breakdown
          if (type === 'neglected_account') {
            console.log(`🔔 Neglected account breakdown: ${notifications.length} total, ${activeNotificationsOnly.length} after snooze, ${count} unique accounts (badge), ${unreadCount} unique unread accounts (text)`);
            if (notifications.length !== activeNotificationsOnly.length) {
              console.warn(`⚠️ WARNING: ${notifications.length - activeNotificationsOnly.length} notifications were filtered as snoozed`);
            }
            if (count !== unreadCount && unreadNotifications.length === activeNotificationsOnly.length) {
              console.warn(`⚠️ WARNING: All ${activeNotificationsOnly.length} notifications are unread, but count (${count}) != unreadCount (${unreadCount})`);
            }
          }
          
          // Log the actual account IDs to verify uniqueness
          if (unreadNotifications.length > unreadCount) {
            console.warn(`⚠️ WARNING: ${unreadNotifications.length} unread notifications but only ${unreadCount} unique accounts - this suggests duplicates`);
            const accountIdCounts = {};
            unreadAccountIds.forEach(id => {
              accountIdCounts[id] = (accountIdCounts[id] || 0) + 1;
            });
            const duplicates = Object.entries(accountIdCounts).filter(([id, count]) => count > 1);
            if (duplicates.length > 0) {
              console.warn(`⚠️ Found ${duplicates.length} accounts with multiple notifications:`, duplicates.slice(0, 5));
            }
          }
        }
      }
      
      const group = {
        type,
        notifications: sortedGroupNotifications, // Use sorted notifications (newest first, unread first)
        count,
        unreadCount
      };
      
      // Additional debug for renewal reminders and neglected accounts
      if ((type === 'renewal_reminder' || type === 'neglected_account') && notifications.length > 0) {
        console.log(`🔔 Final group object for ${type}:`, {
          notificationsCount: group.notifications.length,
          count: group.count,
          unreadCount: group.unreadCount,
          unreadNotificationsCount: group.notifications.filter(n => !n.is_read).length,
          expectedUnreadCount: unreadCount // Should match group.unreadCount
        });
        
        // CRITICAL CHECK: Verify unreadCount is correct
        if (group.unreadCount !== unreadCount) {
          console.error(`❌ ERROR: group.unreadCount (${group.unreadCount}) doesn't match calculated unreadCount (${unreadCount})`);
        }
        if (group.unreadCount === group.notifications.filter(n => !n.is_read).length && group.unreadCount > group.count) {
          console.error(`❌ ERROR: unreadCount (${group.unreadCount}) equals total unread notifications but should equal unique accounts (${group.count})`);
        }
      }
      
      return group;
    });
  }, [groupedNotifications, currentUserId, snoozes]);

  // Define notification type priority (lower number = higher priority)
  const getTypePriority = (type) => {
    const priorities = {
      'renewal_reminder': 1,
      'neglected_account': 2,
      'task_assigned': 2.5,
      'task_overdue': 3,
      'task_due_today': 4,
      'task_reminder': 5,
      'end_of_year_analysis': 6
    };
    return priorities[type] || 99; // Unknown types go last
  };

  // Sort groups by newest notification first, then priority, then unread count
  notificationGroups.sort((a, b) => {
    // First, sort by newest notification in each group (newest groups first)
    const newestA = a.notifications.length > 0 
      ? new Date(a.notifications[0].created_at || a.notifications[0].scheduled_for || 0).getTime()
      : 0;
    const newestB = b.notifications.length > 0 
      ? new Date(b.notifications[0].created_at || b.notifications[0].scheduled_for || 0).getTime()
      : 0;
    if (newestA !== newestB) {
      return newestB - newestA; // Newest first
    }
    // Then by type priority
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

  const deleteNotificationMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('✓ Notification deleted');
    },
    onError: (error) => {
      console.error('Error deleting notification:', error);
      toast.error(error.message || 'Failed to delete notification');
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
              <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-[#ffffff]">Notifications</h3>
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
                                     group.type === 'end_of_year_analysis' ? 'Reports' :
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
                                </div>
                              </div>
                              {hasMultiple && (
                                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                                  {(() => {
                                    // Debug: log what value is being used for display
                                    if (group.type === 'renewal_reminder') {
                                      console.log(`🔔 RENDERING TEXT: group.unreadCount=${group.unreadCount}, group.count=${group.count}, showing: ${group.unreadCount > 0 ? group.unreadCount : group.count}`);
                                    }
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
                                    <h4 className={`text-sm font-medium ${!notification.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-text-muted'}`}>
                                      {notification.title}
                                    </h4>
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

