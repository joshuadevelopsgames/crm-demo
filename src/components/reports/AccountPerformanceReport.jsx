import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronDown, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { calculateAccountStats } from '@/utils/reportCalculations';

export default function AccountPerformanceReport({ estimates, accounts, selectedYear }) {
  const navigate = useNavigate();
  const accountStats = calculateAccountStats(estimates, accounts);
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
      'won': { className: 'bg-emerald-100 text-emerald-800', label: 'Won' },
      'lost': { className: 'bg-red-100 text-red-800', label: 'Lost' },
      'pending': { className: 'bg-amber-100 text-amber-800', label: 'Pending' }
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
              <p className="text-sm text-slate-600 font-medium">Total Accounts</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-white mt-2">{accountStats.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-slate-600 font-medium">Avg Win Rate</p>
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
              <p className="text-sm text-slate-600 font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                ${(accountStats.reduce((sum, acc) => sum + acc.totalValue, 0) / 1000).toFixed(1)}K
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-slate-600 font-medium">Won Revenue</p>
              <p className="text-2xl font-bold text-emerald-600 mt-2">
                ${(accountStats.reduce((sum, acc) => sum + acc.wonValue, 0) / 1000).toFixed(1)}K
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
                  <th className="text-left p-3 font-semibold text-slate-900">Account</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Total</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Won</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Lost</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Win Rate</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Total Value</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Won Value</th>
                  <th className="text-right p-3 font-semibold text-slate-900">Est. vs Won</th>
                  <th className="text-center p-3 font-semibold text-slate-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accountStats.map((account) => {
                  const isExpanded = expandedAccounts.has(account.accountId);
                  const accountEstimates = getAccountEstimates(account.accountId);
                  
                  return (
                    <React.Fragment key={account.accountId}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3">
                          {accountEstimates.length > 0 && (
                            <button
                              onClick={() => toggleAccount(account.accountId)}
                              className="text-slate-400 hover:text-slate-900"
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
                        <td className="p-3 text-right text-slate-600">{account.total}</td>
                        <td className="p-3 text-right text-emerald-600 font-medium">{account.won}</td>
                        <td className="p-3 text-right text-red-600 font-medium">{account.lost}</td>
                        <td className="p-3 text-right">
                          <Badge 
                            variant="secondary" 
                            className={account.winRate >= 50 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}
                          >
                            {account.winRate}%
                          </Badge>
                        </td>
                        <td className="p-3 text-right text-slate-600">
                          ${(account.totalValue / 1000).toFixed(1)}K
                        </td>
                        <td className="p-3 text-right text-emerald-600 font-medium">
                          ${(account.wonValue / 1000).toFixed(1)}K
                        </td>
                        <td className="p-3 text-right text-slate-600">{account.estimatesVsWonRatio}%</td>
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
                          <td colSpan="10" className="p-0 bg-slate-50">
                            <div className="p-4">
                              <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                Estimates for {account.accountName}
                              </h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-200">
                                      <th className="text-left p-2 font-semibold text-slate-700">Estimate #</th>
                                      <th className="text-left p-2 font-semibold text-slate-700">Project</th>
                                      <th className="text-left p-2 font-semibold text-slate-700">Date</th>
                                      <th className="text-left p-2 font-semibold text-slate-700">Close Date</th>
                                      <th className="text-right p-2 font-semibold text-slate-700">Value</th>
                                      <th className="text-center p-2 font-semibold text-slate-700">Status</th>
                                      <th className="text-left p-2 font-semibold text-slate-700">Division</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {accountEstimates
                                      .sort((a, b) => {
                                        const dateA = new Date(a.estimate_close_date || a.estimate_date || 0);
                                        const dateB = new Date(b.estimate_close_date || b.estimate_date || 0);
                                        return dateB - dateA;
                                      })
                                      .map((estimate) => (
                                        <tr key={estimate.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800">
                                          <td className="p-2 text-slate-600">{estimate.estimate_number || 'N/A'}</td>
                                          <td className="p-2 text-slate-600">{estimate.project_name || 'N/A'}</td>
                                          <td className="p-2 text-slate-600">
                                            {estimate.estimate_date 
                                              ? format(new Date(estimate.estimate_date), 'MMM d, yyyy')
                                              : 'N/A'}
                                          </td>
                                          <td className="p-2 text-slate-600">
                                            {estimate.estimate_close_date 
                                              ? format(new Date(estimate.estimate_close_date), 'MMM d, yyyy')
                                              : 'N/A'}
                                          </td>
                                          <td className="p-2 text-right text-slate-600">
                                            ${((parseFloat(estimate.total_price_with_tax) || 0) / 1000).toFixed(1)}K
                                          </td>
                                          <td className="p-2 text-center">
                                            {getStatusBadge(estimate.status)}
                                          </td>
                                          <td className="p-2 text-slate-600">{estimate.division || 'N/A'}</td>
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
                    <td colSpan="10" className="p-8 text-center text-slate-500">
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

