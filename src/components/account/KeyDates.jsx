import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Calendar } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function KeyDates({ account }) {
  const lastContactDays = account.last_interaction_date
    ? differenceInDays(new Date(), new Date(account.last_interaction_date))
    : null;

  const createdDate = account.created_date || account.created_at;
  const createdBy = account.created_by || 'System';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Key Dates
          </CardTitle>
          <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Last Contact</p>
            <p className="font-semibold text-slate-900 dark:text-[#ffffff] mt-1">
              {lastContactDays !== null ? (
                <>
                  {lastContactDays === 0 ? 'Today' : 
                   lastContactDays === 1 ? '1 day ago' : 
                   `${lastContactDays} days ago`}
                </>
              ) : (
                <span className="text-slate-400 dark:text-slate-500">No contact records</span>
              )}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Date Created</p>
            <p className="font-medium text-slate-900 dark:text-[#ffffff] mt-1">
              {createdDate ? format(new Date(createdDate), 'MMM dd yyyy') : '—'}
            </p>
          </div>

          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Created By</p>
            <p className="font-medium text-slate-900 dark:text-[#ffffff] mt-1">{createdBy}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}



