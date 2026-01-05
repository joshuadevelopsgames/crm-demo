import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, BellOff, List, LayoutGrid, Building2, AlertCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { createPageUrl } from '@/utils';
import SnoozeDialog from '@/components/SnoozeDialog';
import { snoozeNotification } from '@/services/notificationService';
import { useYearSelector } from '@/contexts/YearSelectorContext';
import { getRevenueForYear, getSegmentForYear } from '@/utils/revenueSegmentCalculator';
import toast from 'react-hot-toast';

export default function NeglectedAccounts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [snoozeAccount, setSnoozeAccount] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'card'
  const { selectedYear, getCurrentYear } = useYearSelector();

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list()
  });

  // Fetch all scorecards to check which accounts have completed ICP scorecards
  const { data: allScorecards = [] } = useQuery({
    queryKey: ['scorecards'],
    queryFn: async () => {
      const response = await fetch('/api/data/scorecards');
      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    }
  });

  // Fetch notification snoozes
  const { data: notificationSnoozes = [] } = useQuery({
    queryKey: ['notificationSnoozes'],
    queryFn: async () => {
      const response = await fetch('/api/data/notificationSnoozes');
      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? (result.data || []) : [];
    }
  });

  // Create a map of account IDs that have completed scorecards
  const accountsWithScorecards = useMemo(() => {
    const accountIds = new Set();
    allScorecards.forEach(scorecard => {
      if (scorecard.account_id && scorecard.completed_date) {
        accountIds.add(scorecard.account_id);
      }
    });
    return accountIds;
  }, [allScorecards]);

  // Neglected accounts (A/B segments: 30+ days, others: 90+ days, not snoozed, not N/A)
  const neglectedAccounts = accounts.filter(account => {
    // Skip archived accounts
    if (account.archived) return false;
    
    // Skip accounts with ICP status = 'na' (permanently excluded)
    if (account.icp_status === 'na') return false;
    
    // Skip if 'neglected_account' notification is snoozed for this account
    const isSnoozed = notificationSnoozes.some(snooze => 
      snooze.notification_type === 'neglected_account' &&
      snooze.related_account_id === account.id &&
      new Date(snooze.snoozed_until) > new Date()
    );
    if (isSnoozed) return false;
    
    // Determine threshold based on revenue segment
    // A and B segments: 30+ days, others: 90+ days
    // Default to 'C' (90 days) if segment is missing
    const segment = getSegmentForYear(account, selectedYear) || 'C';
    const thresholdDays = (segment === 'A' || segment === 'B') ? 30 : 90;
    
    // Check if no interaction beyond threshold
    if (!account.last_interaction_date) return true;
    const daysSince = differenceInDays(new Date(), new Date(account.last_interaction_date));
    return daysSince > thresholdDays;
  });

  const handleSnooze = async (account, notificationType, duration, unit) => {
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
      case 'forever':
        // Set to 100 years in the future (effectively forever)
        snoozedUntil = new Date(now.getFullYear() + 100, now.getMonth(), now.getDate());
        break;
      default:
        console.error('Invalid snooze unit:', unit, 'duration:', duration);
        toast.error('Invalid snooze duration');
        return;
    }
    
    try {
      await snoozeNotification('neglected_account', account.id, snoozedUntil);
      queryClient.invalidateQueries({ queryKey: ['notificationSnoozes'] });
      setSnoozeAccount(null);
      toast.success('✓ Account snoozed');
    } catch (error) {
      console.error('Error snoozing notification:', error);
      toast.error(`Failed to snooze account: ${error?.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(createPageUrl('Dashboard'))}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-[#ffffff]">Neglected Accounts</h1>
            <p className="text-slate-600 dark:text-slate-300 mt-1">Accounts with no contact (A/B segments: 30+ days, C/D segments: 90+ days)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-lg px-4 py-2">
            {neglectedAccounts.length} accounts
          </Badge>
          {/* View Toggle */}
          <div className="flex items-center gap-1 border border-slate-300 dark:border-slate-700 rounded-lg p-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={`h-8 px-3 ${viewMode === 'list' ? 'bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600' : ''}`}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('card')}
              className={`h-8 px-3 ${viewMode === 'card' ? 'bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600' : ''}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Accounts List/Card View */}
      {neglectedAccounts.length > 0 ? (
        viewMode === 'list' ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 dark:text-[#ffffff] uppercase tracking-wider">
                      Account
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-[#ffffff] uppercase tracking-wider">
                      Last Contact
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-[#ffffff] uppercase tracking-wider">
                      Days Since
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-[#ffffff] uppercase tracking-wider">
                      Annual Revenue
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-[#ffffff] uppercase tracking-wider">
                      Organization Score
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-700 dark:text-[#ffffff] uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                  {neglectedAccounts.map(account => {
                    const daysSince = account.last_interaction_date
                      ? differenceInDays(new Date(), new Date(account.last_interaction_date))
                      : null;
                    
                    return (
                      <tr 
                        key={account.id}
                        onClick={() => navigate(createPageUrl(`AccountDetail?id=${account.id}`))}
                        className="hover:bg-amber-50/50 dark:hover:bg-amber-900/20 transition-colors cursor-pointer"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-[#ffffff]">{account.name}</div>
                              {account.account_type && (
                                <div className="text-sm text-slate-500 dark:text-slate-400">{account.account_type}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-sm text-slate-600 dark:text-slate-300">
                              {account.last_interaction_date
                                ? format(new Date(account.last_interaction_date), 'MMM d, yyyy')
                                : 'Never'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {daysSince !== null ? (
                            <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                              {daysSince} days
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800">
                              No contact
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-900 dark:text-[#ffffff] font-medium">
                          {(() => {
                            const revenue = getRevenueForYear(account, selectedYear);
                            return revenue > 0 ? `$${revenue.toLocaleString()}` : '-';
                          })()}
                        </td>
                        <td className="px-4 py-4">
                          {accountsWithScorecards.has(account.id) && account.organization_score !== null && account.organization_score !== undefined ? (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-[#ffffff]">{account.organization_score}</span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">/100</span>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400 dark:text-slate-500">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSnoozeAccount(account);
                            }}
                            className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20"
                          >
                            <BellOff className="w-4 h-4 mr-1" />
                            Snooze
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {neglectedAccounts.map(account => {
              const daysSince = account.last_interaction_date
                ? differenceInDays(new Date(), new Date(account.last_interaction_date))
                : null;
              
              return (
                <Card
                  key={account.id}
                  className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(createPageUrl(`AccountDetail?id=${account.id}`))}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg text-slate-900 dark:text-[#ffffff]">{account.name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSnoozeAccount(account);
                        }}
                        className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/20"
                      >
                        <BellOff className="w-4 h-4 mr-1" />
                        Snooze
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {account.last_interaction_date ? (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-slate-600 dark:text-slate-300">
                            Last contact: {format(new Date(account.last_interaction_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          <span className="text-slate-600 dark:text-slate-300">No interactions logged</span>
                        </div>
                      )}
                      {daysSince !== null && (
                        <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800">
                          {daysSince} days ago
                        </Badge>
                      )}
                      {(() => {
                        const revenue = getRevenueForYear(account, selectedYear);
                        return revenue > 0 ? (
                        <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                          <p className="text-xs text-slate-500 dark:text-slate-400">Annual Revenue</p>
                          <p className="text-sm font-semibold text-slate-900 dark:text-[#ffffff]">
                              ${revenue.toLocaleString()}
                          </p>
                        </div>
                        ) : null;
                      })()}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <Card className="p-12 text-center">
          <Clock className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 dark:text-[#ffffff] mb-1">No neglected accounts</h3>
          <p className="text-slate-600 dark:text-slate-300">All accounts have been contacted recently or are snoozed 🎉</p>
        </Card>
      )}

      {/* Snooze Dialog */}
      {snoozeAccount && (
        <SnoozeDialog
          account={snoozeAccount}
          notificationType="neglected_account"
          open={!!snoozeAccount}
          onOpenChange={(open) => !open && setSnoozeAccount(null)}
          onSnooze={handleSnooze}
        />
      )}
    </div>
  );
}

