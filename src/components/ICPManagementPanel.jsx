import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Search, Building2, RefreshCw, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import toast from 'react-hot-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ICPManagementPanel() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'required', 'na'
  const [bulkConfirmDialog, setBulkConfirmDialog] = useState(null); // { status: 'required' | 'na', count: number }

  // Fetch all accounts
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Update ICP status mutation
  const updateICPMutation = useMutation({
    mutationFn: async ({ accountId, icpStatus }) => {
      const account = await base44.entities.Account.update(accountId, {
        icp_status: icpStatus,
        icp_required: icpStatus === 'required',
        // Clear last_interaction_date if setting to N/A
        ...(icpStatus === 'na' ? { last_interaction_date: null } : {})
      });
      return account;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(`ICP status updated for ${variables.accountName || 'account'}`);
    },
    onError: (error, variables) => {
      console.error('Error updating ICP status:', error);
      toast.error(`Failed to update ICP status for ${variables.accountName || 'account'}`);
    }
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ accountIds, icpStatus }) => {
      const updates = accountIds.map(id => 
        base44.entities.Account.update(id, {
          icp_status: icpStatus,
          icp_required: icpStatus === 'required',
          ...(icpStatus === 'na' ? { last_interaction_date: null } : {})
        })
      );
      await Promise.all(updates);
      return { count: accountIds.length, status: icpStatus };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success(`Updated ${data.count} account${data.count !== 1 ? 's' : ''} to ${data.status === 'required' ? 'Required' : 'N/A'}`);
    },
    onError: (error) => {
      console.error('Error bulk updating ICP status:', error);
      toast.error('Failed to bulk update ICP status');
    }
  });

  // Filter and search accounts
  const filteredAccounts = useMemo(() => {
    let filtered = accounts;

    // Filter by ICP status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(account => account.icp_status === filterStatus);
    }

    // Search by name
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(account => 
        account.name?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [accounts, filterStatus, searchTerm]);

  // Counts for stats
  const stats = useMemo(() => {
    const total = accounts.length;
    const required = accounts.filter(a => a.icp_status === 'required').length;
    const na = accounts.filter(a => a.icp_status === 'na').length;
    const notSet = accounts.filter(a => !a.icp_status || (a.icp_status !== 'required' && a.icp_status !== 'na')).length;
    return { total, required, na, notSet };
  }, [accounts]);

  const handleToggle = (account, newStatus) => {
    updateICPMutation.mutate({
      accountId: account.id,
      accountName: account.name,
      icpStatus: newStatus
    });
  };

  const handleBulkUpdate = (status) => {
    const selectedAccounts = filteredAccounts;
    if (selectedAccounts.length === 0) {
      toast.error('No accounts to update');
      return;
    }
    
    // Show confirmation dialog
    setBulkConfirmDialog({
      status,
      count: selectedAccounts.length
    });
  };

  const confirmBulkUpdate = () => {
    if (!bulkConfirmDialog) return;
    
    const selectedAccounts = filteredAccounts;
    bulkUpdateMutation.mutate({
      accountIds: selectedAccounts.map(a => a.id),
      icpStatus: bulkConfirmDialog.status
    });
    
    setBulkConfirmDialog(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-600 dark:text-slate-400">Loading accounts...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          ICP Status Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Total</div>
          </div>
          <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{stats.required}</div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Required</div>
          </div>
          <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{stats.na}</div>
            <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">N/A</div>
          </div>
          <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div className="text-2xl font-bold text-slate-600 dark:text-slate-400">{stats.notSet}</div>
            <div className="text-xs text-slate-500 dark:text-slate-500 mt-1">Not Set</div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search accounts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          >
            <option value="all">All Statuses</option>
            <option value="required">Required</option>
            <option value="na">N/A</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {filteredAccounts.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkUpdate('required')}
              disabled={bulkUpdateMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Set All to Required ({filteredAccounts.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkUpdate('na')}
              disabled={bulkUpdateMutation.isPending}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Set All to N/A ({filteredAccounts.length})
            </Button>
          </div>
        )}

        {/* Accounts List */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {filteredAccounts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                {searchTerm || filterStatus !== 'all' 
                  ? 'No accounts match your filters' 
                  : 'No accounts found'}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Account Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Current Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      ICP Required
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredAccounts.map((account) => {
                    const isRequired = account.icp_status === 'required';
                    const isUpdating = updateICPMutation.isPending && 
                      updateICPMutation.variables?.accountId === account.id;

                    return (
                      <tr 
                        key={account.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link
                            to={createPageUrl(`AccountDetail?id=${account.id}`)}
                            className="font-medium text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400"
                          >
                            {account.name || 'Unnamed Account'}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={
                              isRequired
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                            }
                          >
                            {isRequired ? 'Required' : account.icp_status === 'na' ? 'N/A' : 'Not Set'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Switch
                            checked={isRequired}
                            onCheckedChange={(checked) => {
                              handleToggle(account, checked ? 'required' : 'na');
                            }}
                            disabled={isUpdating}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
          Showing {filteredAccounts.length} of {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          {stats.notSet > 0 && (
            <span className="ml-2">
              • {stats.notSet} account{stats.notSet !== 1 ? 's' : ''} need status set
            </span>
          )}
        </div>
      </CardContent>

      {/* Bulk Update Confirmation Dialog */}
      <AlertDialog open={!!bulkConfirmDialog} onOpenChange={(open) => {
        if (!open) setBulkConfirmDialog(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Confirm Bulk Update
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              Are you sure you want to update <strong>{bulkConfirmDialog?.count || 0} account{bulkConfirmDialog?.count !== 1 ? 's' : ''}</strong> to{' '}
              <strong>{bulkConfirmDialog?.status === 'required' ? 'Required' : 'N/A'}</strong>?
              <br /><br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>Set ICP status to <strong>{bulkConfirmDialog?.status === 'required' ? 'Required' : 'N/A'}</strong> for all filtered accounts</li>
                {bulkConfirmDialog?.status === 'na' && (
                  <li>Clear last interaction dates for accounts set to N/A</li>
                )}
                <li>Exclude N/A accounts from neglected accounts tracking</li>
                <li className="text-amber-600 dark:text-amber-400 font-medium">This action cannot be easily undone</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkUpdate}
              className={bulkConfirmDialog?.status === 'na' 
                ? 'bg-amber-600 hover:bg-amber-700' 
                : 'bg-emerald-600 hover:bg-emerald-700'
              }
              disabled={bulkUpdateMutation.isPending}
            >
              {bulkUpdateMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  {bulkConfirmDialog?.status === 'required' ? (
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Update {bulkConfirmDialog?.count || 0} Account{bulkConfirmDialog?.count !== 1 ? 's' : ''}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

