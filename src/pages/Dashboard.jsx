import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createEndOfYearNotification, createRenewalNotifications, createNeglectedAccountNotifications, createOverdueTaskNotifications } from '@/services/notificationService';
import { generateRecurringTaskInstances } from '@/services/recurringTaskService';
import { calculateRenewalDate } from '@/utils/renewalDateCalculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import TutorialTooltip from '../components/TutorialTooltip';
import SnoozeDialog from '@/components/SnoozeDialog';
import ImportLeadsDialog from '../components/ImportLeadsDialog';
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

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [snoozeAccount, setSnoozeAccount] = useState(null);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  
  // Check for end of year notification on mount
  useEffect(() => {
    createEndOfYearNotification().catch(error => {
      console.error('Error checking for end of year notification:', error);
    });
  }, []);

  // Force fresh notification fetch on page load (not cached)
  useEffect(() => {
    // Invalidate notifications query to force fresh fetch on page load
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    console.log('🔄 Dashboard: Invalidated notifications cache on page load');
  }, [queryClient]);

  // Create renewal notifications on mount and daily
  useEffect(() => {
    let lastNotificationCheck = 0;
    const NOTIFICATION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes - don't run full check more often than this
    
    // Check if renewal notifications already exist for today
    // This prevents duplicate runs across different browser sessions/devices
    const checkAndRunRenewals = async (force = false) => {
      try {
        // Get current user to filter notifications
        const currentUser = await base44.auth.me();
        if (!currentUser?.id) {
          console.warn('No current user, skipping renewal notification check');
          return;
        }
        
        // Get today's renewal notifications for current user to see if we've already run today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const notifications = await base44.entities.Notification.filter({
          user_id: currentUser.id,
          type: 'renewal_reminder'
        });
        
        // Check if any renewal notifications were created today
        const hasNotificationsToday = notifications.some(notif => {
          const notifDate = new Date(notif.created_at);
          notifDate.setHours(0, 0, 0, 0);
          return notifDate.getTime() === today.getTime();
        });
        
        // Only run if we haven't created notifications today
        if (!hasNotificationsToday) {
          await createRenewalNotifications();
          // Invalidate queries to refresh both notifications and accounts (for at_risk status)
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
          queryClient.invalidateQueries({ queryKey: ['accounts'] });
          lastNotificationCheck = Date.now();
        }
      } catch (error) {
        console.error('Error checking/creating renewal notifications:', error);
      }
    };
    
    // Create neglected account notifications on mount and daily
    // Always run to ensure all neglected accounts have notifications (function handles duplicates)
    const checkAndRunNeglected = async (force = false) => {
      try {
        // Skip if we just ran recently (unless forced)
        const timeSinceLastCheck = Date.now() - lastNotificationCheck;
        if (!force && timeSinceLastCheck < NOTIFICATION_CHECK_INTERVAL) {
          return; // Skip to avoid too frequent checks
        }
        
        // Get current user to filter notifications
        const currentUser = await base44.auth.me();
        if (!currentUser?.id) {
          console.warn('No current user, skipping neglected account notification check');
          return;
        }
        
        // Run notification creation - it will skip accounts that already have notifications
        // This ensures newly neglected accounts get notifications even if the function ran earlier today
        await createNeglectedAccountNotifications();
        // Invalidate queries to refresh notifications
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        lastNotificationCheck = Date.now();
      } catch (error) {
        console.error('Error checking/creating neglected account notifications:', error);
      }
    };
    
    // Check and create overdue task notifications
    const checkAndRunOverdueTasks = async (force = false) => {
      try {
        // Skip if we just ran recently (unless forced)
        const timeSinceLastCheck = Date.now() - lastNotificationCheck;
        if (!force && timeSinceLastCheck < NOTIFICATION_CHECK_INTERVAL) {
          return; // Skip to avoid too frequent checks
        }
        
        // Get current user to filter notifications
        const currentUser = await base44.auth.me();
        if (!currentUser?.id) {
          console.warn('No current user, skipping overdue task notification check');
          return;
        }
        
        // Run notification creation - it will skip tasks that already have notifications
        await createOverdueTaskNotifications();
        // Invalidate queries to refresh notifications
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        lastNotificationCheck = Date.now();
      } catch (error) {
        console.error('Error checking/creating overdue task notifications:', error);
      }
    };
    
    // Run on mount (force run)
    checkAndRunRenewals(true);
    checkAndRunNeglected(true);
    checkAndRunOverdueTasks(true);
    
    // Generate recurring task instances on page load
    generateRecurringTaskInstances().catch(error => {
      console.error('Error generating recurring task instances:', error);
    });
    
    // Schedule periodic check every 15 minutes
    const intervalId = setInterval(async () => {
      await checkAndRunRenewals();
      await checkAndRunNeglected();
      await checkAndRunOverdueTasks();
    }, 15 * 60 * 1000); // Check every 15 minutes
    
    // Note: Task assignment notifications are already handled automatically when tasks are created/updated
    // via createTaskAssignmentNotifications() in Tasks.jsx, so no periodic check needed for those
    
    return () => {
      clearInterval(intervalId);
    };
  }, [queryClient]);
  
  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list()
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list()
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list()
  });

  // Fetch estimates to calculate renewal dates
  const { data: estimates = [] } = useQuery({
    queryKey: ['estimates'],
    queryFn: async () => {
      const response = await fetch('/api/data/estimates');
      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    }
  });

  const { data: sequences = [] } = useQuery({
    queryKey: ['sequence-enrollments'],
    queryFn: () => base44.entities.SequenceEnrollment.list()
  });

  // Calculate metrics
  // Active accounts = all non-archived accounts (matches Accounts page logic)
  const activeAccounts = accounts.filter(a => a.status !== 'archived' && a.archived !== true).length;
  const archivedAccounts = accounts.filter(a => a.status === 'archived' || a.archived === true).length;
  const totalAccounts = accounts.length;
  const atRiskAccounts = accounts.filter(a => a.status === 'at_risk').length;
  const myTasks = tasks.filter(t => t.status !== 'completed').length;
  
  // Debug logging to verify counts
  useEffect(() => {
    console.log('📊 Account Counts:', {
      total: totalAccounts,
      active: activeAccounts,
      archived: archivedAccounts,
      atRisk: atRiskAccounts,
      sum: activeAccounts + archivedAccounts,
      difference: totalAccounts - (activeAccounts + archivedAccounts)
    });
  }, [totalAccounts, activeAccounts, archivedAccounts, atRiskAccounts]);
  
  // Neglected accounts (A/B segments: 30+ days, others: 90+ days, not snoozed, not N/A)
  const neglectedAccounts = accounts.filter(account => {
    // Skip archived accounts
    if (account.archived) return false;
    
    // Skip accounts with ICP status = 'na' (permanently excluded)
    if (account.icp_status === 'na') return false;
    
    // Skip if snoozed
    if (account.snoozed_until) {
      const snoozeDate = new Date(account.snoozed_until);
      if (snoozeDate > new Date()) {
        return false; // Still snoozed
      }
    }
    
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
    if (accounts.length > 0) {
      const active = accounts.filter(a => a.status !== 'archived' && a.archived !== true);
      const excludedByICP = active.filter(a => a.icp_status === 'na').length;
      const snoozed = active.filter(a => {
        if (!a.snoozed_until) return false;
        const snoozeDate = new Date(a.snoozed_until);
        return snoozeDate > new Date();
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
  }, [accounts, neglectedAccounts]);

  // At-risk accounts (renewals within 6 months / 180 days)
  // Calculate renewal dates from estimates for each account
  const atRiskRenewals = accounts
    .map(account => {
      if (account.archived) return null;
      if (account.status !== 'at_risk') return null;
      
      // Get estimates for this account
      const accountEstimates = estimates.filter(est => est.account_id === account.id);
      
      // Calculate renewal date from estimates
      const renewalDate = calculateRenewalDate(accountEstimates);
      
      if (!renewalDate) return null;
      
      const daysUntil = differenceInDays(new Date(renewalDate), new Date());
      
      // Only include if renewal is within 6 months (180 days) and in the future
      if (daysUntil <= 0 || daysUntil > 180) return null;
      
      return {
        ...account,
        renewal_date: renewalDate.toISOString(),
        calculated_renewal_date: renewalDate
      };
    })
    .filter(Boolean) // Remove null entries
    .sort((a, b) => {
      // Sort by days until renewal (soonest first)
      const daysA = differenceInDays(new Date(a.calculated_renewal_date), new Date());
      const daysB = differenceInDays(new Date(b.calculated_renewal_date), new Date());
      return daysA - daysB;
    });

  // Overdue tasks (matches notification service logic)
  const overdueTasks = tasks.filter(task => {
    // Skip tasks without due dates or completed tasks
    if (!task.due_date || task.status === 'completed') return false;
    // Task is overdue if due date is before now (matches notification service: new Date(task.due_date) < new Date())
    return new Date(task.due_date) < new Date();
  });

  const updateAccountMutation = useMutation({
    mutationFn: ({ accountId, data }) => base44.entities.Account.update(accountId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setSnoozeAccount(null);
    }
  });

  const handleSnooze = (account, duration, unit) => {
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
    
    updateAccountMutation.mutate({
      accountId: account.id,
      data: { snoozed_until: snoozedUntil.toISOString() }
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
      value: atRiskAccounts,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      tip: 'Accounts with contract renewals coming up within the next 6 months. These need attention to ensure they renew successfully. Click to view all at-risk accounts, then click individual accounts to prepare renewal proposals, review contracts, or schedule renewal meetings.'
    }
  ];

  // #region agent log
  useEffect(() => {
    const logData5 = {location:'Dashboard.jsx:render',message:'Dashboard component rendering',data:{activeAccounts,contactsCount:contacts.length,myTasks,atRiskAccounts},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
    console.log('🔍 DEBUG:', logData5);
    fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData5)}).catch(()=>{});
  }, [activeAccounts, contacts.length, myTasks, atRiskAccounts]);
  // #endregion

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
        <Button 
          onClick={() => setIsImportDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-primary dark:hover:bg-primary-hover dark:active:bg-primary-active dark:text-primary-foreground"
        >
          <Upload className="w-4 h-4 mr-2" />
          Import from LMN
        </Button>
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
        {/* At Risk Accounts */}
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
                {atRiskRenewals.slice(0, 5).map(account => {
                  const daysUntil = differenceInDays(new Date(account.calculated_renewal_date), new Date());
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3 bg-white dark:bg-surface-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-red-100 dark:border-border"
                    >
                      <Link
                        to={createPageUrl(`AccountDetail?id=${account.id}`)}
                        className="flex-1"
                      >
                        <p className="font-medium text-slate-900 dark:text-foreground">{account.name}</p>
                        <p className="text-xs text-slate-500 dark:text-text-muted">
                          Renews in {daysUntil} day{daysUntil !== 1 ? 's' : ''} • {format(new Date(account.calculated_renewal_date), 'MMM d, yyyy')}
                        </p>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          setSnoozeAccount(account);
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
                  {neglectedAccounts.length > 5 && (
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
            <p className="text-sm text-slate-600 dark:text-text-muted mb-3">No contact (A/B: 30+ days, C/D: 90+ days)</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {neglectedAccounts.slice(0, 5).map(account => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-surface-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors border border-amber-100 dark:border-border"
                >
                  <Link
                    to={createPageUrl(`AccountDetail?id=${account.id}`)}
                    className="flex-1"
                  >
                    <p className="font-medium text-slate-900 dark:text-slate-100">{account.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {account.last_interaction_date
                        ? `Last contact: ${format(new Date(account.last_interaction_date), 'MMM d, yyyy')}`
                        : 'No interactions logged'}
                    </p>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      setSnoozeAccount(account);
                    }}
                    className="text-amber-700 hover:text-amber-900 hover:bg-amber-100 ml-2"
                  >
                    <BellOff className="w-4 h-4 mr-1" />
                    Snooze
                  </Button>
                </div>
              ))}
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
                {sequences.filter(s => s.status === 'active').length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 dark:text-text-muted mb-3">Accounts in sequences</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sequences.filter(s => s.status === 'active').slice(0, 5).map(enrollment => {
                const account = accounts.find(a => a.id === enrollment.account_id);
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
              {sequences.filter(s => s.status === 'active').length === 0 && (
                <p className="text-sm text-slate-500 dark:text-text-muted text-center py-4">No active sequences</p>
              )}
            </div>
          </CardContent>
        </Card>
        </TutorialTooltip>
      </div>

      {/* Snooze Dialog */}
      {snoozeAccount && (
        <SnoozeDialog
          account={snoozeAccount}
          open={!!snoozeAccount}
          onOpenChange={(open) => !open && setSnoozeAccount(null)}
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
