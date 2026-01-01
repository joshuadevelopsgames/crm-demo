import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseAuth } from '@/services/supabaseClient';
import { useUser } from '@/contexts/UserContext';
import { X, AlertCircle, AlertTriangle, Info, CheckCircle, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const PRIORITY_COLORS = {
  low: 'bg-slate-50 border-slate-200 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200',
  normal: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200',
  high: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-200',
  urgent: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200'
};

const PRIORITY_ICONS = {
  low: Info,
  normal: CheckCircle,
  high: AlertTriangle,
  urgent: AlertCircle
};

export default function AnnouncementBanner() {
  const { user, profile, isLoading: userLoading } = useUser();
  const supabase = getSupabaseAuth();
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState(() => {
    // Load dismissed announcements from localStorage
    try {
      const stored = localStorage.getItem('dismissedAnnouncements');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  // Fetch active announcements (always enabled - announcements are required)
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      if (!supabase || !user?.id) return [];
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return [];

      const response = await fetch('/api/data/announcements', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        return [];
      }

      // Filter to only active, non-expired announcements
      const now = new Date();
      return (result.data || []).filter(announcement => {
        if (!announcement.is_active) return false;
        if (announcement.expires_at && new Date(announcement.expires_at) <= now) return false;
        return true;
      });
    },
    enabled: !!user && !userLoading, // Always enabled - announcements are required
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  const handleDismiss = (announcementId) => {
    const newDismissed = [...dismissedAnnouncements, announcementId];
    setDismissedAnnouncements(newDismissed);
    try {
      localStorage.setItem('dismissedAnnouncements', JSON.stringify(newDismissed));
    } catch (error) {
      console.error('Error saving dismissed announcements:', error);
    }
  };

  // Filter out dismissed announcements
  const visibleAnnouncements = announcements.filter(
    a => !dismissedAnnouncements.includes(a.id)
  );

  // Don't show banner if no announcements (announcements are always required)
  if (userLoading || isLoading || visibleAnnouncements.length === 0) {
    return null;
  }

  // Show the most recent announcement (or first one if multiple)
  const announcement = visibleAnnouncements[0];
  const PriorityIcon = PRIORITY_ICONS[announcement.priority] || Info;

  return (
    <>
      <div className={`border-b ${PRIORITY_COLORS[announcement.priority] || PRIORITY_COLORS.normal}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-2">
            <button
              onClick={() => setSelectedAnnouncement(announcement)}
              className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
            >
              <Megaphone className="w-5 h-5 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Badge 
                  variant="outline" 
                  className="flex-shrink-0 text-xs"
                >
                  <PriorityIcon className="w-3 h-3 mr-1" />
                  {announcement.priority}
                </Badge>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate">{announcement.title}</h4>
                  {announcement.content && (
                    <p className="text-xs opacity-90 line-clamp-1">{announcement.content}</p>
                  )}
                </div>
              </div>
            </button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss(announcement.id);
              }}
              className="flex-shrink-0 h-6 w-6 p-0 hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Full Announcement Dialog */}
      {selectedAnnouncement && (() => {
        const DialogPriorityIcon = PRIORITY_ICONS[selectedAnnouncement.priority] || Info;
        return (
          <Dialog open={!!selectedAnnouncement} onOpenChange={(open) => !open && setSelectedAnnouncement(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <DialogTitle>{selectedAnnouncement.title}</DialogTitle>
                  <Badge className={PRIORITY_COLORS[selectedAnnouncement.priority] || PRIORITY_COLORS.normal}>
                    <DialogPriorityIcon className="w-3 h-3 mr-1" />
                    {selectedAnnouncement.priority}
                  </Badge>
                </div>
                <DialogDescription>
                  {selectedAnnouncement.created_at && (
                    <span className="text-xs text-slate-500">
                      Posted {format(new Date(selectedAnnouncement.created_at), 'MMM d, yyyy')}
                      {selectedAnnouncement.expires_at && (
                        <> • Expires {format(new Date(selectedAnnouncement.expires_at), 'MMM d, yyyy')}</>
                      )}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {selectedAnnouncement.content}
                </p>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </>
  );
}

