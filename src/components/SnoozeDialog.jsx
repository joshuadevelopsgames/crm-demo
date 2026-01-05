import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BellOff } from 'lucide-react';
import { format, addDays, addWeeks, addMonths, addYears } from 'date-fns';

export default function SnoozeDialog({ account, notificationType, open, onOpenChange, onSnooze }) {
  const [duration, setDuration] = useState(1);
  const [unit, setUnit] = useState('weeks');

  const calculateSnoozeDate = () => {
    const now = new Date();
    switch (unit) {
      case 'days':
        return addDays(now, duration);
      case 'weeks':
        return addWeeks(now, duration);
      case 'months':
        return addMonths(now, duration);
      case 'years':
        return addYears(now, duration);
      case 'forever':
        // Use a far future date (100 years from now)
        return addYears(now, 100);
      default:
        return now;
    }
  };

  const handleSnooze = () => {
    onSnooze(account, notificationType, duration, unit);
  };

  const getNotificationTypeLabel = () => {
    switch (notificationType) {
      case 'renewal_reminder':
        return 'renewal reminder';
      case 'neglected_account':
        return 'neglected account';
      default:
        return 'notification';
    }
  };

  const snoozeDate = calculateSnoozeDate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellOff className="w-5 h-5 text-amber-600" />
            Snooze Account
          </DialogTitle>
          <DialogDescription>
            Temporarily hide the {getNotificationTypeLabel()} notification for "{account?.name}". It will reappear after the snooze period ends.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex gap-2">
              {unit !== 'forever' && (
                <Input
                  type="number"
                  min="1"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                  className="w-24"
                />
              )}
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Day(s)</SelectItem>
                  <SelectItem value="weeks">Week(s)</SelectItem>
                  <SelectItem value="months">Month(s)</SelectItem>
                  <SelectItem value="years">Year(s)</SelectItem>
                  <SelectItem value="forever">Forever</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600">
              {unit === 'forever' ? (
                <span>
                  Account will be <span className="font-semibold text-slate-900">permanently hidden</span>
                </span>
              ) : (
                <span>
                  Account will reappear on{' '}
                  <span className="font-semibold text-slate-900">
                    {format(snoozeDate, 'MMM d, yyyy')}
                  </span>
                </span>
              )}
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSnooze} className="bg-amber-600 hover:bg-amber-700">
              <BellOff className="w-4 h-4 mr-2" />
              Snooze
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

