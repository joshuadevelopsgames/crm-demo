import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useUser } from '@/contexts/UserContext';
import { createEndOfYearNotification, createRenewalNotifications, createNeglectedAccountNotifications, createOverdueTaskNotifications, snoozeNotification } from '@/services/notificationService';
import { generateRecurringTaskInstances } from '@/services/recurringTaskService';
import { getDaysUntilRenewal } from '@/utils/renewalDateCalculator';
import { getSupabaseClient } from '@/services/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '../utils';
import TutorialTooltip from '../components/TutorialTooltip';
import SnoozeDialog from '@/components/SnoozeDialog';
import ImportLeadsDialog from '../components/ImportLeadsDialog';
import { useYearSelector } from '@/contexts/YearSelectorContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ICPManagementPanel from '../components/ICPManagementPanel';
import {
  Building2,
  Users,
  CheckSquare,
  AlertCircle,
  AlertTriangle,
  TrendingUp,
  Calendar,
  ArrowRight,
  Clock,
  ExternalLink,
  BellOff,
  Upload
} from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import { formatDateString } from '@/utils/dateFormatter';

export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedYear, setYear, yearOptions } = useYearSelector();
  const queryClient = useQueryClient();
  const { user, isLoading: userLoading } = useUser();
  const [snoozeAccount, setSnoozeAccount] = useState(null);
  const [snoozeNotificationType, setSnoozeNotificationType] = useState(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  
  // Check for end of year notification on mount
  useEffect(() => {
    createEndOfYearNotification().catch(error => {
      console.error('Error checking for end of year notification:', error);
    });
  }, []);

  // Note: Removed forced invalidation of notifications query
  // This was causing notifications to disappear when navigating to Dashboard
  // The notifications query will refetch naturally when needed based on staleTime

  // OPTIMIZED: Notifications are maintained by database triggers
  // On page load, we just fetch the pre-built list - no expensive recalculation!
  useEffect(() => {
    // Only update account statuses periodically - triggers handle notification updates automatically
    let lastStatusCheck = 0;
    const STATUS_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes - only check account statuses
    
    // Update account statuses (at_risk) based on renewal dates
    // Triggers will automatically update notifications when account.status changes
    const checkAndUpdateAccountStatuses = async (force = false) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:61',message:'checkAndUpdateAccountStatuses called',data:{force,timeSinceLastCheck:Date.now()-lastStatusCheck},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      try {
        // Skip if we just ran recently (unless forced)
        const timeSinceLastCheck = Date.now() - lastStatusCheck;
        if (!force && timeSinceLastCheck < STATUS_CHECK_INTERVAL) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:65',message:'Skipping status check - too soon',data:{timeSinceLastCheck},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
          // #endregion
          return;
        }
        
        // Get current user
        const currentUser = await base44.auth.me();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:70',message:'Got current user',data:{hasUser:!!currentUser,hasId:!!currentUser?.id,userId:currentUser?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
        if (!currentUser?.id) {
          console.warn('No current user, skipping account status check');
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:72',message:'No current user - skipping',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
          // #endregion
          return;
        }
        
        // Only update account statuses - triggers handle notification updates
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:77',message:'About to call createRenewalNotifications',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
        await createRenewalNotifications();
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:78',message:'createRenewalNotifications completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
        // Invalidate queries to refresh accounts (notifications are auto-updated by triggers)
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        // Don't invalidate notifications here - triggers handle updates automatically
        // Invalidating causes notifications to disappear when navigating to Dashboard
        lastStatusCheck = Date.now();
      } catch (error) {
        console.error('Error checking/updating account statuses:', error);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:83',message:'Error in checkAndUpdateAccountStatuses',data:{error:error.message,stack:error.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
      }
    };
    
    // Check and create overdue task notifications (these are still handled in JS for now)
    const checkAndRunOverdueTasks = async (force = false) => {
      try {
        const timeSinceLastCheck = Date.now() - lastStatusCheck;
        if (!force && timeSinceLastCheck < STATUS_CHECK_INTERVAL) {
          return;
        }
        
        const currentUser = await base44.auth.me();
        if (!currentUser?.id) {
          console.warn('No current user, skipping overdue task notification check');
          return;
        }
        
        await createOverdueTaskNotifications();
        // Only invalidate tasks, not notifications - notifications will update via triggers or natural refetch
        // Invalidating notifications causes them to disappear when navigating to Dashboard
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        lastStatusCheck = Date.now();
      } catch (error) {
        console.error('Error checking/creating overdue task notifications:', error);
      }
    };
    
    // Run on mount (force run) - but only update statuses, not full notification recalculation
    checkAndUpdateAccountStatuses(true);
    checkAndRunOverdueTasks(true);
    
    // Generate recurring task instances on page load
    generateRecurringTaskInstances().catch(error => {
      console.error('Error generating recurring task instances:', error);
    });
    
    // Schedule periodic check every 30 minutes
    const intervalId = setInterval(async () => {
      await checkAndUpdateAccountStatuses();
      await checkAndRunOverdueTasks();
    }, 30 * 60 * 1000);
    
    // Note: 
    // - Bulk notifications (neglected_account, renewal_reminder) are maintained by database triggers
    // - Task notifications are still handled in JavaScript (task_assigned, task_overdue, etc.)
    // - On page load, NotificationBell just fetches the pre-built list from user_notification_states
    
    return () => {
      clearInterval(intervalId);
    };
  }, [queryClient]);
  
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:135',message:'Fetching accounts',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const accountsList = await base44.entities.Account.list();
      // #region agent log
      const atRiskAccounts = accountsList.filter(a => a.status === 'at_risk');
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:137',message:'Accounts loaded',data:{total:accountsList.length,atRiskStatus:atRiskAccounts.length,atRiskIds:atRiskAccounts.slice(0,5).map(a=>a.id),sampleAccounts:accountsList.slice(0,3).map(a=>({id:a.id,name:a.name,status:a.status}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return accountsList;
    },
    enabled: !userLoading && !!user // Wait for user to load before fetching
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list(),
    enabled: !userLoading && !!user // Wait for user to load before fetching
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list(),
    enabled: !userLoading && !!user // Wait for user to load before fetching
  });

  // Fetch at-risk accounts from unified API
  const { data: atRiskAccountsData = [], isLoading: atRiskAccountsLoading } = useQuery({
    queryKey: ['at-risk-accounts'],
    queryFn: async () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:192',message:'Fetching at-risk accounts',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      const response = await fetch('/api/notifications?type=at-risk-accounts');
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:195',message:'At-risk accounts response',data:{ok:response.ok,status:response.status,statusText:response.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      if (!response.ok) {
        console.error('❌ Failed to fetch at-risk accounts:', response.status, response.statusText);
        return [];
      }
      const result = await response.json();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:202',message:'At-risk accounts result',data:{success:result.success,hasData:!!result.data,isArray:Array.isArray(result.data),dataType:typeof result.data,dataLength:result.data?.length,error:result.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      if (!result.success) {
        console.error('❌ At-risk accounts API returned error:', result.error);
        return [];
      }
      const data = result.data || [];
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:207',message:'At-risk accounts final data',data:{isArray:Array.isArray(data),length:data.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      console.log('✅ Fetched at-risk accounts:', data.length, 'accounts');
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
  
  // Fetch duplicate estimates
  const { data: duplicateEstimates = [] } = useQuery({
    queryKey: ['duplicate-estimates'],
    queryFn: async () => {
      const response = await fetch('/api/notifications?type=duplicate-estimates');
      if (!response.ok) {
        console.error('❌ Failed to fetch duplicate estimates:', response.status);
        return [];
      }
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
  
  // Set up Supabase Realtime subscriptions for instant updates
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    // Subscribe to cache updates
    const cacheChannel = supabase
      .channel('dashboard-notification-cache')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notification_cache'
      }, () => {
        console.log('🔔 Cache updated, refreshing dashboard data');
        queryClient.invalidateQueries(['at-risk-accounts']);
        queryClient.invalidateQueries(['duplicate-estimates']);
      });
    
    // Subscribe to duplicate estimates
    const duplicateChannel = supabase
      .channel('dashboard-duplicate-estimates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'duplicate_at_risk_estimates'
      }, () => {
        queryClient.invalidateQueries(['duplicate-estimates']);
      });
    
    cacheChannel.subscribe();
    duplicateChannel.subscribe();
    
    return () => {
      supabase.removeChannel(cacheChannel);
      supabase.removeChannel(duplicateChannel);
    };
  }, [queryClient]);

  const { data: sequencesRaw = [] } = useQuery({
    queryKey: ['sequence-enrollments'],
    queryFn: () => base44.entities.SequenceEnrollment.list()
  });

  // Fetch notification snoozes to filter accounts
  const { data: notificationSnoozes = [] } = useQuery({
    queryKey: ['notificationSnoozes'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/data/notificationSnoozes');
        const result = await response.json();
        return result.success ? (result.data || []) : [];
      } catch (error) {
        console.error('Error fetching notification snoozes:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch notifications to get accurate counts that match the notification bell
  // This ensures the dashboard badge counts always match the notification bell counts
  const { data: allNotificationsRaw = [] } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const currentUserIdStr = String(user.id).trim();
        const [bulkNotificationsResponse, taskNotifications] = await Promise.all([
          fetch(`/api/data/userNotificationStates?user_id=${encodeURIComponent(currentUserIdStr)}`)
            .then(async r => {
              const json = await r.json();
              return r.ok ? json : { success: false, error: json.error || 'Unknown error' };
            })
            .catch(error => ({ success: false, error: error.message })),
          base44.entities.Notification.filter({ user_id: currentUserIdStr }, '-created_at')
        ]);
        
        const bulkNotifications = bulkNotificationsResponse.success 
          ? (bulkNotificationsResponse.data?.notifications || [])
          : [];
        
        return [...bulkNotifications, ...taskNotifications];
      } catch (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }
    },
    enabled: !userLoading && !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Process notifications to get counts that match the notification bell
  // This ensures dashboard badge counts always match notification bell counts
  const notificationCounts = useMemo(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:331',message:'notificationCounts useMemo entry',data:{hasAllNotificationsRaw:!!allNotificationsRaw,isArray:Array.isArray(allNotificationsRaw),type:typeof allNotificationsRaw,length:allNotificationsRaw?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    // #endregion
    if (!Array.isArray(allNotificationsRaw) || allNotificationsRaw.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Dashboard.jsx:334',message:'notificationCounts early return',data:{reason:!Array.isArray(allNotificationsRaw)?'not-array':'empty'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      return { neglected_account: 0, renewal_reminder: 0 };
    }
    
    const now = new Date();
    
    // Ensure notificationSnoozes is an array
    const snoozes = Array.isArray(notificationSnoozes) ? notificationSnoozes : [];
    
    // Filter out snoozed notifications (same logic as NotificationBell)
    const activeNotifications = allNotificationsRaw.filter(notification => {
      // Check if this notification is snoozed
      if (!snoozes || snoozes.length === 0) {
        return true; // If snoozes not loaded, include all
      }
      
      const isSnoozed = snoozes.some(snooze => {
        // Type must match
        if (snooze.notification_type !== notification.type) return false;
        
        // Check if snooze is still active
        const snoozedUntil = new Date(snooze.snoozed_until);
        if (snoozedUntil <= now) return false; // Snooze expired
        
        // Check account ID match - handle null, undefined, and string comparisons
        const snoozeAccountId = snooze.related_account_id ? String(snooze.related_account_id).trim() : null;
        const notifAccountId = notification.related_account_id ? String(notification.related_account_id).trim() : null;
        
        // Both null/empty means match (general snooze for this type)
        if (!snoozeAccountId && !notifAccountId) return true;
        
        // One is null, one isn't - no match
        if (!snoozeAccountId || !notifAccountId) return false;
        
        // Both have values - compare as strings
        return snoozeAccountId === notifAccountId;
      });
      
      return !isSnoozed;
    });
    
    // Count unique accounts for neglected_account and renewal_reminder (same logic as NotificationBell)
    const neglectedAccountIds = activeNotifications
      .filter(n => n.type === 'neglected_account')
      .map(n => n.related_account_id)
      .filter(id => id && id !== 'null' && id !== null)
      .map(id => String(id).trim());
    const uniqueNeglectedAccountIds = new Set(neglectedAccountIds);
    
    const renewalReminderAccountIds = activeNotifications
      .filter(n => n.type === 'renewal_reminder')
      .map(n => n.related_account_id)
      .filter(id => id && id !== 'null' && id !== null)
      .map(id => String(id).trim());
    const uniqueRenewalReminderAccountIds = new Set(renewalReminderAccountIds);
    
    return {
      neglected_account: uniqueNeglectedAccountIds.size,
      renewal_reminder: uniqueRenewalReminderAccountIds.size
    };
  }, [allNotificationsRaw, notificationSnoozes]);

  // Calculate metrics
  // Active accounts = all non-archived accounts (matches Accounts page logic)
  const accountsArray = Array.isArray(accounts) ? accounts : [];
  const tasksArray = Array.isArray(tasks) ? tasks : [];
  const activeAccounts = accountsArray.filter(a => a.status !== 'archived' && a.archived !== true).length;
  const archivedAccounts = accountsArray.filter(a => a.status === 'archived' || a.archived === true).length;
  const totalAccounts = accountsArray.length;
  // Calculate at-risk accounts based on renewal dates (not just status)
  // This ensures the count matches what's actually shown in the dashboard
  // Note: atRiskRenewals is calculated below, so we'll use that length
  const myTasks = tasksArray.filter(t => t.status !== 'completed').length;
  
  // At-risk accounts from the unified API
  // The cache is automatically maintained by background job every 5 minutes
  const atRiskRenewals = useMemo(() => {
    // Ensure atRiskAccountsData is an array
    if (!Array.isArray(atRiskAccountsData) || atRiskAccountsData.length === 0) {
      return [];
    }
    
    // Ensure accounts is an array
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return [];
    }
    
    // Map at-risk accounts data to account objects with renewal info
    return atRiskAccountsData
      .map(atRiskRecord => {
        // Find the corresponding account
        const account = accounts.find(acc => acc.id === atRiskRecord.account_id);
        if (!account) {
          // Account not found in accounts list, skip it
          return null;
        }
        
        return {
          ...account,
          renewal_date: atRiskRecord.renewal_date,
          calculated_renewal_date: atRiskRecord.renewal_date,
          days_until_renewal: atRiskRecord.days_until_renewal,
          expiring_estimate_id: atRiskRecord.expiring_estimate_id,
          expiring_estimate_number: atRiskRecord.expiring_estimate_number,
          has_duplicates: atRiskRecord.has_duplicates || false,
          duplicate_estimates: atRiskRecord.duplicate_estimates || []
        };
      })
      .filter(Boolean) // Remove null entries
      .sort((a, b) => {
        // Sort by days until renewal (soonest first, 0-180 days only per R16)
        const daysA = a.days_until_renewal ?? 999;
        const daysB = b.days_until_renewal ?? 999;
        return daysA - daysB;
      });
  }, [atRiskAccountsData, accounts]);

  // Debug logging for at-risk accounts
  useEffect(() => {
    if (accounts.length > 0 && atRiskAccountsData.length > 0) {
      console.log('🔍 At-Risk Accounts Debug:', {
        totalAccounts: accounts.length,
        atRiskAccountsInTable: atRiskAccountsData.length,
        atRiskRenewalsCount: atRiskRenewals.length,
        atRiskRenewals: atRiskRenewals.slice(0, 5).map(acc => ({
          name: acc.name,
          renewalDate: acc.calculated_renewal_date,
          daysUntil: acc.days_until_renewal
        }))
      });
    }
  }, [accounts, atRiskAccountsData, atRiskRenewals]);

  // Use at-risk renewals count for stats
  const atRiskAccounts = atRiskRenewals.length;
  
  // Debug logging to verify counts
  useEffect(() => {
    console.log('📊 Account Counts:', {
      total: totalAccounts,
      active: activeAccounts,
      archived: archivedAccounts,
      atRisk: atRiskAccounts,
      atRiskRenewalsCount: atRiskRenewals.length,
      sum: activeAccounts + archivedAccounts,
      difference: totalAccounts - (activeAccounts + archivedAccounts)
    });
  }, [totalAccounts, activeAccounts, archivedAccounts, atRiskAccounts, atRiskRenewals.length]);
  
  // Neglected accounts (A/B segments: 30+ days, others: 90+ days, not snoozed, not N/A)
  const neglectedAccounts = (Array.isArray(accounts) ? accounts : []).filter(account => {
    // Skip archived accounts
    if (account.archived) return false;
    
    // Skip accounts with ICP status = 'na' (permanently excluded)
    if (account.icp_status === 'na') return false;
    
    // Skip if 'neglected_account' notification is snoozed for this account
    const snoozes = Array.isArray(notificationSnoozes) ? notificationSnoozes : [];
    const isSnoozed = snoozes.some(snooze => 
      snooze.notification_type === 'neglected_account' &&
      snooze.related_account_id === account.id &&
      new Date(snooze.snoozed_until) > new Date()
    );
    if (isSnoozed) return false;
    
    // Determine threshold based on revenue segment
    // A and B segments: 30+ days, others: 90+ days
    // Default to 'C' (90 days) if segment is missing
    const segment = account.revenue_segment || 'C';
    const thresholdDays = (segment === 'A' || segment === 'B') ? 30 : 90;
    
    // Check if no interaction beyond threshold
    // Use startOfDay for consistent date comparison (matches notification service)
    const today = startOfDay(new Date());
    if (!account.last_interaction_date) return true;
    const lastInteractionDate = startOfDay(new Date(account.last_interaction_date));
    const daysSince = differenceInDays(today, lastInteractionDate);
    return daysSince > thresholdDays;
  });
  
  // Debug logging for neglected accounts calculation
  useEffect(() => {
    if (Array.isArray(accounts) && accounts.length > 0) {
      const active = accounts.filter(a => a.status !== 'archived' && a.archived !== true);
      const excludedByICP = active.filter(a => a.icp_status === 'na').length;
      const snoozesArray = Array.isArray(notificationSnoozes) ? notificationSnoozes : [];
      const snoozed = active.filter(a => {
        return snoozesArray.some(snooze => 
          snooze.related_account_id === a.id &&
          new Date(snooze.snoozed_until) > new Date()
        );
      }).length;
      const hasRecentInteraction = active.filter(a => {
        if (!a.last_interaction_date) return false;
        const segment = a.revenue_segment || 'C'; // Default to 'C' if missing
        const thresholdDays = (segment === 'A' || segment === 'B') ? 30 : 90;
        const daysSince = differenceInDays(new Date(), new Date(a.last_interaction_date));
        return daysSince <= thresholdDays;
      }).length;
      const noInteractionDate = active.filter(a => !a.last_interaction_date).length;
      const oldInteraction = active.filter(a => {
        if (!a.last_interaction_date) return false;
        const segment = a.revenue_segment || 'C'; // Default to 'C' if missing
        const thresholdDays = (segment === 'A' || segment === 'B') ? 30 : 90;
        const daysSince = differenceInDays(new Date(), new Date(a.last_interaction_date));
        return daysSince > thresholdDays;
      }).length;
      
      console.log('📊 Neglected Accounts Analysis:', {
        activeAccounts: active.length,
        neglectedAccounts: neglectedAccounts.length,
        excludedByICP,
        snoozed,
        hasRecentInteraction: `${hasRecentInteraction} (interaction within threshold: A/B=30 days, C/D=90 days)`,
        noInteractionDate: `${noInteractionDate} (no last_interaction_date - should be neglected)`,
        oldInteraction: `${oldInteraction} (interaction beyond threshold: A/B=30 days, C/D=90 days - should be neglected)`,
        expectedNeglected: noInteractionDate + oldInteraction - excludedByICP - snoozed,
        difference: active.length - neglectedAccounts.length
      });
    }
  }, [accounts, neglectedAccounts, notificationSnoozes]);

  // Overdue tasks (matches notification service logic)
  const overdueTasks = tasks.filter(task => {
    // Skip tasks without due dates or completed tasks
    if (!task.due_date || task.status === 'completed') return false;
    // Task is overdue if due date is before now (matches notification service: new Date(task.due_date) < new Date())
    return new Date(task.due_date) < new Date();
  });

  const snoozeMutation = useMutation({
    mutationFn: ({ notificationType, accountId, snoozedUntil }) => 
      snoozeNotification(notificationType, accountId, snoozedUntil),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationSnoozes'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setSnoozeAccount(null);
      setSnoozeNotificationType(null);
    }
  });

  const handleSnooze = (account, notificationType, duration, unit) => {
    const now = new Date();
    let snoozedUntil;
    
    switch (unit) {
      case 'days':
        snoozedUntil = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
        break;
      case 'weeks':
        snoozedUntil = new Date(now.getTime() + duration * 7 * 24 * 60 * 60 * 1000);
        break;
      case 'months':
        snoozedUntil = new Date(now.getFullYear(), now.getMonth() + duration, now.getDate());
        break;
      case 'years':
        snoozedUntil = new Date(now.getFullYear() + duration, now.getMonth(), now.getDate());
        break;
      default:
        return;
    }
    
    snoozeMutation.mutate({
      notificationType,
      accountId: account.id,
      snoozedUntil
    });
  };

  const stats = [
    {
      title: 'Active Accounts',
      value: activeAccounts,
      icon: Building2,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      tip: 'Companies you\'re actively working with or pursuing. Click to view all accounts, filter by status, or search for specific companies. Use this to track your sales pipeline and customer base.'
    },
    {
      title: 'Total Contacts',
      value: contacts.length,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      tip: 'All people you have relationships with across your accounts. Click to view the contacts page where you can see all contacts, filter by account, role, or search by name. Use this to manage your network and track who you know at each company.'
    },
    {
      title: 'Open Tasks',
      value: myTasks,
      icon: CheckSquare,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      tip: 'Action items that need to be completed. Click to go to the Tasks page where you can view all tasks, filter by status or priority, create new tasks, and mark tasks as complete. Tasks help you stay organized and never miss a follow-up.'
    },
    {
      title: 'At Risk Accounts',
      value: atRiskRenewals.length,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      tip: 'Accounts with contract renewals coming up within the next 6 months. These need attention to ensure they renew successfully. Click to view all at-risk accounts, then click individual accounts to prepare renewal proposals, review contracts, or schedule renewal meetings.'
    }
  ];


  return (
    <div 
      ref={(el) => {
        // Ref callback for potential future use
      }}
      className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-foreground">Dashboard</h1>
          <p className="text-slate-600 dark:text-text-muted mt-2 text-sm md:text-base">Overview of your sales pipeline and activities</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedYear.toString()} onValueChange={(value) => setYear(parseInt(value, 10))}>
            <SelectTrigger className="w-[120px]">
              <SelectValue>{selectedYear}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={() => setIsImportDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-primary dark:hover:bg-primary-hover dark:active:bg-primary-active dark:text-primary-foreground"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import from LMN
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isClickable = stat.title === 'Active Accounts' || 
                             stat.title === 'Total Contacts' || 
                             stat.title === 'Open Tasks' || 
                             stat.title === 'At Risk Accounts';
          
          const handleClick = () => {
            if (stat.title === 'Active Accounts') {
              navigate(createPageUrl('Accounts'));
            } else if (stat.title === 'Total Contacts') {
              navigate(createPageUrl('Contacts'));
            } else if (stat.title === 'Open Tasks') {
              navigate(createPageUrl('Tasks'));
            } else if (stat.title === 'At Risk Accounts') {
              navigate(`${createPageUrl('Accounts')}?status=at_risk`);
            }
          };
          
          return (
            <TutorialTooltip
              key={stat.title}
              tip={stat.tip}
              step={1}
              position="bottom"
            >
              <Card 
                className={`border-slate-200/50 dark:border-border bg-white dark:bg-surface-1 backdrop-blur-sm hover:border-slate-300 dark:hover:border-border transition-all group ${isClickable ? 'cursor-pointer hover:shadow-md' : ''}`}
                onClick={isClickable ? handleClick : undefined}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs md:text-sm font-medium text-slate-600 dark:text-text-muted mb-1">{stat.title}</p>
                      <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-foreground">{stat.value}</p>
                    </div>
                    <div className={`${stat.bgColor} p-3 md:p-4 rounded-xl group-hover:scale-110 transition-transform`}>
                      <Icon className={`w-5 h-5 md:w-6 md:h-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TutorialTooltip>
          );
        })}
      </div>

      {/* Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* At Risk Accounts - Show first for priority */}
        <TutorialTooltip
          tip="Accounts with contract renewals within the next 6 months need proactive attention. Click any account name to view details, prepare renewal proposals, review contract terms, or schedule renewal meetings. Use the snooze button to temporarily hide accounts you've already addressed. Click 'View All' to see the complete list and prioritize your renewal efforts."
          step={1}
          position="bottom"
        >
          <Card className="border-red-200 dark:border-border bg-red-50/50 dark:bg-surface-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle 
                  className="text-lg flex items-center gap-2 text-slate-900 dark:text-foreground cursor-pointer hover:text-red-700 dark:hover:text-red-400 transition-colors"
                  onClick={() => navigate(`${createPageUrl('Accounts')}?status=at_risk`)}
                >
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  At Risk Accounts
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">
                    {atRiskRenewals.length}
                  </Badge>
                  {atRiskRenewals.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`${createPageUrl('Accounts')}?status=at_risk`)}
                      className="text-red-700 hover:text-red-900 hover:bg-red-100"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View All
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-text-muted mb-3">Renewing within 6 months</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {/* Debug logging removed - estimates no longer needed for at-risk calculation */}
                  {atRiskRenewals.slice(0, 5).map(account => {
                    // Check if this account has duplicate estimates
                    const hasDuplicates = account.has_duplicates || duplicateEstimates.some(dup => dup.account_id === account.id);
                    const duplicateInfo = duplicateEstimates.find(dup => dup.account_id === account.id);
                  const daysUntil = getDaysUntilRenewal(account.calculated_renewal_date);
                  return (
                    <div
                      key={account.id}
                      className={`flex items-center justify-between p-3 bg-white dark:bg-surface-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border ${hasDuplicates ? 'border-yellow-400 border-2' : 'border-red-100 dark:border-border'}`}
                    >
                      <Link
                        to={createPageUrl(`AccountDetail?id=${account.id}`)}
                        className="flex-1"
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900 dark:text-foreground">{account.name}</p>
                          {hasDuplicates && (
                            <Badge variant="warning" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                              ⚠️ Duplicates
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-text-muted">
                          Renews in {daysUntil} day{daysUntil !== 1 ? 's' : ''} • {formatDateString(account.calculated_renewal_date, 'MMM d, yyyy')}
                        </p>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          setSnoozeAccount(account);
                          setSnoozeNotificationType('renewal_reminder');
                        }}
                        className="text-red-700 hover:text-red-900 hover:bg-red-100 ml-2"
                      >
                        <BellOff className="w-4 h-4 mr-1" />
                        Snooze
                      </Button>
                    </div>
                  );
                })}
                {atRiskRenewals.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-text-muted text-center py-4">No at-risk renewals 🎉</p>
                )}
                {atRiskRenewals.length > 5 && (
                  <Button
                    variant="outline"
                    className="w-full mt-2 border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => navigate(`${createPageUrl('Accounts')}?status=at_risk`)}
                  >
                    View All {atRiskRenewals.length} Accounts
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TutorialTooltip>

        {/* Neglected Accounts */}
        <TutorialTooltip
          tip="Accounts that haven't been contacted recently (A/B revenue segments: 30+ days, C/D segments: 90+ days). These relationships may be at risk. Click any account to view details, then log a new interaction (call, email, or meeting) to re-engage. Use the snooze button if you've already reached out. Regular contact prevents accounts from going cold."
          step={1}
          position="bottom"
        >
          <Card className="border-amber-200 dark:border-border bg-amber-50/50 dark:bg-surface-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle 
                  className="text-lg flex items-center gap-2 text-slate-900 dark:text-foreground cursor-pointer hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                  onClick={() => navigate(createPageUrl('NeglectedAccounts'))}
                >
                  <Clock className="w-5 h-5 text-amber-600" />
                  Neglected Accounts
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">
                    {neglectedAccounts.length}
                  </Badge>
                  {notificationCounts.neglected_account > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(createPageUrl('NeglectedAccounts'))}
                      className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      View All
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-text-muted mb-3">
                {neglectedAccounts.length === 0 
                  ? 'All accounts have recent interactions 🎉'
                  : 'No contact in 30+ days (A/B) or 90+ days (C/D)'
                }
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {neglectedAccounts.slice(0, 5).map(account => {
                  const segment = account.revenue_segment || 'C';
                  const thresholdDays = (segment === 'A' || segment === 'B') ? 30 : 90;
                  const daysSince = account.last_interaction_date 
                    ? differenceInDays(new Date(), new Date(account.last_interaction_date))
                    : 'No';
                  
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-surface-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors border border-amber-100 dark:border-border"
                    >
                      <Link
                        to={createPageUrl(`AccountDetail?id=${account.id}`)}
                        className="flex-1"
                      >
                        <p className="font-medium text-slate-900 dark:text-foreground">{account.name}</p>
                        <p className="text-xs text-slate-500 dark:text-text-muted">
                          {daysSince === 'No' 
                            ? 'No interaction date' 
                            : `${daysSince} day${daysSince !== 1 ? 's' : ''} since last contact`
                          } • {segment} segment
                        </p>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          setSnoozeAccount(account);
                          setSnoozeNotificationType('neglected_account');
                        }}
                        className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 ml-2"
                      >
                        <BellOff className="w-4 h-4 mr-1" />
                        Snooze
                      </Button>
                    </div>
                  );
                })}
                {neglectedAccounts.length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-text-muted text-center py-4">No neglected accounts 🎉</p>
                )}
                {neglectedAccounts.length > 5 && (
                  <Button
                    variant="outline"
                    className="w-full mt-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={() => navigate(createPageUrl('NeglectedAccounts'))}
                  >
                    View All {neglectedAccounts.length} Accounts
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TutorialTooltip>

        {/* Overdue Tasks */}
        <TutorialTooltip
          tip="Tasks that are past their due date need immediate action. Click any task to open it, then either complete it, update the due date if it's been rescheduled, or mark it as in progress. Overdue tasks can damage client relationships, so prioritize these. You can also create a new task to follow up on overdue items."
          step={1}
          position="bottom"
        >
        <Card className="border-orange-200 dark:border-border bg-orange-50/50 dark:bg-surface-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-foreground">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                Overdue Tasks
              </CardTitle>
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                {overdueTasks.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-text-muted mb-3">Tasks past their due date</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {overdueTasks.slice(0, 5).map(task => (
                <div
                  key={task.id}
                  onClick={() => navigate(`${createPageUrl('Tasks')}?taskId=${task.id}`)}
                  className="flex items-center justify-between p-3 bg-white dark:bg-surface-2 rounded-lg border border-orange-100 dark:border-border cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-foreground">{task.title}</p>
                    <p className="text-xs text-slate-500 dark:text-text-muted">
                      Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    {task.priority}
                  </Badge>
                </div>
              ))}
              {overdueTasks.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-text-muted text-center py-4">No overdue tasks</p>
              )}
            </div>
          </CardContent>
        </Card>
        </TutorialTooltip>

        {/* Active Sequences */}
        <TutorialTooltip
          tip="Accounts currently enrolled in automated outreach sequences. Sequences create ordered, blocked tasks that guide your follow-up process. Each account shows its current step and next action date. Click to view the Sequences page where you can see all enrollments, create new template sequences, or enroll additional accounts in existing sequences."
          step={1}
          position="bottom"
        >
        <Card className="border-indigo-200 dark:border-border bg-indigo-50/50 dark:bg-surface-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-foreground">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Active Sequences
              </CardTitle>
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 border-indigo-200">
                {(Array.isArray(sequencesRaw) ? sequencesRaw : []).filter(s => s.status === 'active').length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-text-muted mb-3">Accounts in sequences</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(Array.isArray(sequencesRaw) ? sequencesRaw : []).filter(s => s.status === 'active').slice(0, 5).map(enrollment => {
                const account = accountsArray.find(a => a.id === enrollment.account_id);
                return (
                  <div
                    key={enrollment.id}
                    className="flex items-center justify-between p-3 bg-white dark:bg-surface-2 rounded-lg border border-indigo-100 dark:border-border"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 dark:text-foreground">{account?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500 dark:text-text-muted">
                        Step {enrollment.current_step} • Next: {enrollment.next_action_date ? format(new Date(enrollment.next_action_date), 'MMM d') : 'TBD'}
                      </p>
                    </div>
                  </div>
                );
              })}
              {(Array.isArray(sequencesRaw) ? sequencesRaw : []).filter(s => s.status === 'active').length === 0 && (
                <p className="text-sm text-slate-500 dark:text-text-muted text-center py-4">No active sequences</p>
              )}
            </div>
          </CardContent>
        </Card>
        </TutorialTooltip>
      </div>

      {/* ICP Management Panel - Only for Jon Hopkins */}
      {user?.email?.toLowerCase() === 'jon@lecm.ca' && (
        <ICPManagementPanel />
      )}

      {/* Snooze Dialog */}
      {snoozeAccount && (
        <SnoozeDialog
          account={snoozeAccount}
          notificationType={snoozeNotificationType}
          open={!!snoozeAccount}
          onOpenChange={(open) => {
            if (!open) {
              setSnoozeAccount(null);
              setSnoozeNotificationType(null);
            }
          }}
          onSnooze={handleSnooze}
        />
      )}

      {/* Import Leads Dialog */}
      <ImportLeadsDialog 
        open={isImportDialogOpen} 
        onClose={() => setIsImportDialogOpen(false)}
      />
    </div>
  );
}


// Force rebuild
