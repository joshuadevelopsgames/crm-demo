import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, BellOff } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { createPageUrl } from '@/utils';
import SnoozeDialog from '@/components/SnoozeDialog';

export default function NeglectedAccounts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [snoozeAccount, setSnoozeAccount] = useState(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list()
  });

  // Neglected accounts (no interaction in 30+ days, not snoozed)
  const neglectedAccounts = accounts.filter(account => {
    // Skip archived accounts
    if (account.archived) return false;
    
    // Skip if snoozed
    if (account.snoozed_until) {
      const snoozeDate = new Date(account.snoozed_until);
      if (snoozeDate > new Date()) {
        return false; // Still snoozed
      }
    }
    
    // Check if no interaction in 30+ days
    if (!account.last_interaction_date) return true;
    const daysSince = differenceInDays(new Date(), new Date(account.last_interaction_date));
    return daysSince > 30;
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
            <h1 className="text-3xl font-bold text-slate-900">Neglected Accounts</h1>
            <p className="text-slate-600 mt-1">Accounts with no contact in 30+ days</p>
          </div>
        </div>
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-lg px-4 py-2">
          {neglectedAccounts.length} accounts
        </Badge>
      </div>

      {/* Accounts List */}
      {neglectedAccounts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {neglectedAccounts.map(account => {
            const daysSince = account.last_interaction_date
              ? differenceInDays(new Date(), new Date(account.last_interaction_date))
              : null;
            
            return (
              <Card
                key={account.id}
                className="border-amber-200 bg-amber-50/50 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(createPageUrl(`AccountDetail?id=${account.id}`))}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg text-slate-900">{account.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSnoozeAccount(account);
                      }}
                      className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
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
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="text-slate-600">
                          Last contact: {format(new Date(account.last_interaction_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="text-slate-600">No interactions logged</span>
                      </div>
                    )}
                    {daysSince !== null && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                        {daysSince} days ago
                      </Badge>
                    )}
                    {account.annual_revenue && (
                      <div className="pt-2 border-t border-amber-200">
                        <p className="text-xs text-slate-500">Annual Revenue</p>
                        <p className="text-sm font-semibold text-slate-900">
                          ${account.annual_revenue.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Clock className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No neglected accounts</h3>
          <p className="text-slate-600">All accounts have been contacted recently or are snoozed 🎉</p>
        </Card>
      )}

      {/* Snooze Dialog */}
      {snoozeAccount && (
        <SnoozeDialog
          account={snoozeAccount}
          open={!!snoozeAccount}
          onOpenChange={(open) => !open && setSnoozeAccount(null)}
          onSnooze={handleSnooze}
        />
      )}
    </div>
  );
}

