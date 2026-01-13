import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseAuth } from '@/services/supabaseClient';
import { isCalendarConnected } from '@/services/calendarService';
import toast from 'react-hot-toast';

export default function CalendarSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Check if calendar is connected first
      const connected = await isCalendarConnected();
      if (!connected) {
        toast.error('Calendar not connected. Please connect Calendar in Settings first.');
        setIsSyncing(false);
        return;
      }

      const supabase = getSupabaseAuth();
      if (!supabase) {
        throw new Error('Supabase not configured');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      toast.loading('Syncing calendar events...', { id: 'calendar-sync' });

      // Sync calendar to CRM (two-way sync)
      const response = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          syncType: 'calendar_to_crm'
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Sync failed');
      }

      const updated = result.data?.updated || 0;
      const created = result.data?.created || 0;
      
      // Invalidate calendar events query to refresh the widget
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      
      if (updated > 0 || created > 0) {
        toast.success(
          `✓ Calendar synced! ${updated} updated, ${created} created`,
          { id: 'calendar-sync', duration: 4000 }
        );
      } else {
        toast.success('✓ Calendar synced! No changes found.', { id: 'calendar-sync' });
      }
    } catch (error) {
      console.error('Error syncing calendar:', error);
      const errorMessage = error.message || 'Failed to sync calendar';
      toast.error(errorMessage, { id: 'calendar-sync', duration: 5000 });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Button
      onClick={handleSync}
      disabled={isSyncing}
      variant="outline"
      size="sm"
      className="border-slate-300"
    >
      {isSyncing ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4 mr-2" />
          Sync Calendar
        </>
      )}
    </Button>
  );
}
