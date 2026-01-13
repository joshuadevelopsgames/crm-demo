import React, { useState } from 'react';
import { Calendar, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseAuth } from '@/services/supabaseClient';
import toast from 'react-hot-toast';

export default function CalendarSyncButton() {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const supabase = getSupabaseAuth();
      if (!supabase) {
        throw new Error('Supabase not configured');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

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

      toast.success(`✓ Synced ${result.data?.updated || 0} events from calendar`);
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast.error(error.message || 'Failed to sync calendar');
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
