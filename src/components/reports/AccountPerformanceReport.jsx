import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { formatDateString, getDateStringTimestamp } from '@/utils/dateFormatter';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { calculateAccountStats, formatCurrency, enhanceAccountStatsWithMetadata } from '@/utils/reportCalculations';

export default function AccountPerformanceReport({ estimates, accounts, selectedYear, interactionStatsMap, scorecardStatsMap }) {
  const navigate = useNavigate();
  const baseAccountStats = calculateAccountStats(estimates, accounts);
  
  // Enhance account stats with metadata (organization_score, revenue_segment, interactions, scorecards)
  const accountStats = enhanceAccountStatsWithMetadata(
    baseAccountStats,
    accounts,
    interactionStatsMap || new Map(),
    scorecardStatsMap || new Map(),
    selectedYear
  );
  const [expandedAccounts, setExpandedAccounts] = useState(new Set());
  
  const toggleAccount = (accountId) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
  };
  
  const getAccountEstimates = (accountId) => {
    return estimates.filter(e => e.account_id === accountId);
  };
  
  const getStatusBadge = (status) => {
    const variants = {
      'won': { className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200', label: 'Won' },
      'lost': { className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', label: 'Lost' },
      'pending': { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200', label: 'Pending' }
    };
    const variant = variants[status] || variants['pending'];
    return <Badge variant="secondary" className={variant.className}>{variant.label}</Badge>;
  };
  
  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total Accounts</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{accountStats.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Avg Win Rate</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">
                {accountStats.length > 0 
                  ? (accountStats.reduce((sum, acc) => sum + acc.winRate, 0) / accountStats.length).toFixed(1)
                  : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                {formatCurrency(accountStats.reduce((sum, acc) => sum + acc.totalValue, 0))}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Won Revenue</p>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                {formatCurrency(accountStats.reduce((sum, acc) => sum + acc.wonValue, 0))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Account Performance Table with Drill-Down */}
      <Card>
        <CardHeader>
          <CardTitle>Account Performance Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-3 font-semibold text-slate-900 dark:text-white w-8"></th>
                  <th className="text-left p-3 font-semibold text-slate-900 dark:text-white">Account</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Total</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Won</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Lost</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Win Rate</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Total Value</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Won Value</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Est. vs Won</th>
                  <th className="text-center p-3 font-semibold text-slate-900 dark:text-white">Segment</th>
                  <th className="text-center p-3 font-semibold text-slate-900 dark:text-white">Score</th>
                  <th className="text-right p-3 font-semibold text-slate-900 dark:text-white">Interactions</th>
                  <th className="text-center p-3 font-semibold text-slate-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accountStats.map((account) => {
                  const isExpanded = expandedAccounts.has(account.accountId);
                  const accountEstimates = getAccountEstimates(account.accountId);
                  
                  return (
                    <React.Fragment key={account.accountId}>
                      <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                        <td className="p-3">
                          {accountEstimates.length > 0 && (
                            <button
                              onClick={() => toggleAccount(account.accountId)}
                              className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </td>
                        <td className="p-3 text-slate-900 dark:text-white font-medium">{account.accountName}</td>
                        <td className="p-3 text-right text-slate-600 dark:text-slate-300">{account.total}</td>
                        <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">{account.won}</td>
                        <td className="p-3 text-right text-red-600 dark:text-red-400 font-medium">{account.lost}</td>
                        <td className="p-3 text-right">
                          <Badge 
                            variant="secondary" 
                            className={account.winRate >= 50 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}
                          >
                            {account.winRate}%
                          </Badge>
                        </td>
                        <td className="p-3 text-right text-slate-600 dark:text-slate-300">
                          {formatCurrency(account.totalValue)}
                        </td>
                        <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                          {formatCurrency(account.wonValue)}
                        </td>
                        <td className="p-3 text-right text-slate-600 dark:text-slate-300">{account.estimatesVsWonRatio}%</td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(createPageUrl(`AccountDetail?id=${account.accountId}`))}
                            className="h-8 px-2"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                      
                      {/* Expanded Estimates List */}
                      {isExpanded && accountEstimates.length > 0 && (
                        <tr>
                          <td colSpan="13" className="p-0 bg-slate-50 dark:bg-slate-900/50">
                            <div className="p-4">
                              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                Estimates for {account.accountName}
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                      <th className="text-left p-2 font-semibold text-slate-700 dark:text-slate-300">Estimate #</th>
                                      <th className="text-left p-2 font-semibold text-slate-700 dark:text-slate-300">Project</th>
                                      <th className="text-left p-2 font-semibold text-slate-700 dark:text-slate-300">Date</th>
                                      <th className="text-left p-2 font-semibold text-slate-700 dark:text-slate-300">Close Date</th>
                                      <th className="text-right p-2 font-semibold text-slate-700 dark:text-slate-300">Value</th>
                                      <th className="text-center p-2 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                                      <th className="text-left p-2 font-semibold text-slate-700 dark:text-slate-300">Division</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {accountEstimates
                                      .sort((a, b) => {
                                        // Per Estimates spec R2: Year determination priority: contract_end → contract_start → estimate_date → created_date
                                        const dateA = getDateStringTimestamp(a.contract_end || a.contract_start || a.estimate_date || a.created_date);
                                        const dateB = getDateStringTimestamp(b.contract_end || b.contract_start || b.estimate_date || b.created_date);
                                        return dateB - dateA;
                                      })
                                      .map((estimate) => (
                                        <tr key={estimate.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800/70">
                                          <td className="p-2 text-slate-600 dark:text-slate-300">{estimate.estimate_number || 'N/A'}</td>
                                          <td className="p-2 text-slate-600 dark:text-slate-300">{estimate.project_name || 'N/A'}</td>
                                          <td className="p-2 text-slate-600 dark:text-slate-300">
                                            {estimate.estimate_date 
                                              ? formatDateString(estimate.estimate_date, 'MMM d, yyyy')
                                              : 'N/A'}
                                          </td>
                                          <td className="p-2 text-slate-600 dark:text-slate-300">
                                            {/* Per Estimates spec R2: Display contract_end (Priority 1) if available */}
                                            {estimate.contract_end 
                                              ? formatDateString(estimate.contract_end, 'MMM d, yyyy')
                                              : (estimate.contract_start
                                                ? formatDateString(estimate.contract_start, 'MMM d, yyyy')
                                                : 'N/A')}
                                          </td>
                                          <td className="p-2 text-right text-slate-600 dark:text-slate-300">
                                            {formatCurrency(parseFloat(estimate.total_price || estimate.total_price_with_tax) || 0)}
                                          </td>
                                          <td className="p-2 text-center">
                                            {getStatusBadge(estimate.status)}
                                          </td>
                                          <td className="p-2 text-slate-600 dark:text-slate-300">{estimate.division || 'N/A'}</td>
                                        </tr>
                                      ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {accountStats.length === 0 && (
                  <tr>
                    <td colSpan="13" className="p-8 text-center text-slate-500 dark:text-slate-400">
                      No account data available for {selectedYear}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

