import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createEndOfYearNotification, createRenewalNotifications, createNeglectedAccountNotifications } from '@/services/notificationService';
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
  AlertTriangle,
  TrendingUp,
  Calendar,
  ArrowRight,
  Clock,
  ExternalLink,
  BellOff,
  Upload
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

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
    // Check if renewal notifications already exist for today
    // This prevents duplicate runs across different browser sessions/devices
    const checkAndRunRenewals = async () => {
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
        }
      } catch (error) {
        console.error('Error checking/creating renewal notifications:', error);
      }
    };
    
    // Create neglected account notifications on mount and daily
    // Always run to ensure all neglected accounts have notifications (function handles duplicates)
    const checkAndRunNeglected = async () => {
      try {
        // Get current user to filter notifications
        const currentUser = await base44.auth.me();
        if (!currentUser?.id) {
          console.warn('No current user, skipping neglected account notification check');
          return;
        }
        
        // Always run notification creation - it will skip accounts that already have notifications
        // This ensures newly neglected accounts get notifications even if the function ran earlier today
        await createNeglectedAccountNotifications();
        // Invalidate queries to refresh notifications
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
      } catch (error) {
        console.error('Error checking/creating neglected account notifications:', error);
      }
    };
    
    // Run on mount
    checkAndRunRenewals();
    checkAndRunNeglected();
    
    // Schedule daily check at midnight
    const scheduleNextRun = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0); // Midnight
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      return setTimeout(async () => {
        await checkAndRunRenewals();
        await checkAndRunNeglected();
        // Schedule next day
        scheduleNextRun();
      }, msUntilMidnight);
    };
    
    const timeoutId = scheduleNextRun();
    
    return () => clearTimeout(timeoutId);
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
    if (!account.last_interaction_date) return true;
    const daysSince = differenceInDays(new Date(), new Date(account.last_interaction_date));
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

  // Overdue tasks
  const overdueTasks = tasks.filter(task => {
    if (task.status === 'completed' || !task.due_date) return false;
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
      tip: 'This shows your active accounts. These are accounts marked as active in your CRM.'
    },
    {
      title: 'Total Contacts',
      value: contacts.length,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      tip: 'This shows your total contacts. This is the total number of contacts across all accounts.'
    },
    {
      title: 'Open Tasks',
      value: myTasks,
      icon: CheckSquare,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      tip: 'This shows your open tasks. These are tasks that haven\'t been completed yet.'
    },
    {
      title: 'At Risk Accounts',
      value: atRiskAccounts,
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      tip: 'This shows your at risk accounts. These are accounts flagged as at-risk.'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">Dashboard</h1>
          <p className="text-slate-600 mt-2 text-sm md:text-base">Overview of your sales pipeline and activities</p>
        </div>
        <Button 
          onClick={() => setIsImportDialogOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
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
                className={`border-slate-200/50 bg-white/80 backdrop-blur-sm hover:border-slate-300 transition-all group ${isClickable ? 'cursor-pointer hover:shadow-md' : ''}`}
                onClick={isClickable ? handleClick : undefined}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs md:text-sm font-medium text-slate-600 mb-1">{stat.title}</p>
                      <p className="text-2xl md:text-3xl font-bold text-slate-900">{stat.value}</p>
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
          tip="Accounts with renewals coming up within 6 months. These are marked as at-risk and need attention. Click on account names to prepare renewal proposals, review contracts, or schedule renewal meetings. Click the title to view all at-risk accounts."
          step={1}
          position="bottom"
        >
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle 
                  className="text-lg flex items-center gap-2 text-slate-900 cursor-pointer hover:text-red-700 transition-colors"
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
              <p className="text-sm text-slate-600 mb-3">Renewing within 6 months</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {atRiskRenewals.slice(0, 5).map(account => {
                  const daysUntil = differenceInDays(new Date(account.calculated_renewal_date), new Date());
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-red-50 transition-colors border border-red-100"
                    >
                      <Link
                        to={createPageUrl(`AccountDetail?id=${account.id}`)}
                        className="flex-1"
                      >
                        <p className="font-medium text-slate-900">{account.name}</p>
                        <p className="text-xs text-slate-500">
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
                  <p className="text-sm text-slate-500 text-center py-4">No at-risk renewals 🎉</p>
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
          tip="Accounts here haven't been contacted recently (A/B segments: 30+ days, C/D segments: 90+ days). Click any account name to view details, log interactions, or update contact information. Click 'View All' to see all neglected accounts. This helps you identify accounts that need attention."
          step={1}
          position="bottom"
        >
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle 
                  className="text-lg flex items-center gap-2 text-slate-900 cursor-pointer hover:text-amber-700 transition-colors"
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
            <p className="text-sm text-slate-600 mb-3">No contact (A/B: 30+ days, C/D: 90+ days)</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {neglectedAccounts.slice(0, 5).map(account => (
                <div
                  key={account.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg hover:bg-amber-50 transition-colors border border-amber-100"
                >
                  <Link
                    to={createPageUrl(`AccountDetail?id=${account.id}`)}
                    className="flex-1"
                  >
                    <p className="font-medium text-slate-900">{account.name}</p>
                    <p className="text-xs text-slate-500">
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
                <p className="text-sm text-slate-500 text-center py-4">No neglected accounts 🎉</p>
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
          tip="Tasks that are past their due date. These need immediate attention. Click on task titles to view details, update status, or reschedule. Staying on top of overdue tasks helps maintain client relationships."
          step={1}
          position="bottom"
        >
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Overdue Tasks
              </CardTitle>
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                {overdueTasks.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-3">Tasks past their due date</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {overdueTasks.slice(0, 5).map(task => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100"
                >
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{task.title}</p>
                    <p className="text-xs text-slate-500">
                      Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    {task.priority}
                  </Badge>
                </div>
              ))}
              {overdueTasks.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No overdue tasks 🎉</p>
              )}
            </div>
          </CardContent>
        </Card>
        </TutorialTooltip>

        {/* Active Sequences */}
        <TutorialTooltip
          tip="Accounts currently enrolled in automated outreach sequences. Sequences are multi-step automated follow-ups that help you stay in touch with prospects and customers. View active enrollments to see progress."
          step={1}
          position="bottom"
        >
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Active Sequences
              </CardTitle>
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 border-indigo-200">
                {sequences.filter(s => s.status === 'active').length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 mb-3">Accounts in sequences</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sequences.filter(s => s.status === 'active').slice(0, 5).map(enrollment => {
                const account = accounts.find(a => a.id === enrollment.account_id);
                return (
                  <div
                    key={enrollment.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{account?.name || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">
                        Step {enrollment.current_step} • Next: {enrollment.next_action_date ? format(new Date(enrollment.next_action_date), 'MMM d') : 'TBD'}
                      </p>
                    </div>
                  </div>
                );
              })}
              {sequences.filter(s => s.status === 'active').length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No active sequences</p>
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


