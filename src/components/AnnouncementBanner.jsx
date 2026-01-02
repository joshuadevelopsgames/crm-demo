import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseAuth } from '@/services/supabaseClient';
import { useUser } from '@/contexts/UserContext';
import { useTestMode } from '@/contexts/TestModeContext';
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
  normal: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900 dark:border-blue-800 dark:text-blue-200',
  high: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900 dark:border-orange-800 dark:text-orange-200',
  urgent: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900 dark:border-red-800 dark:text-red-200'
};

const PRIORITY_ICONS = {
  low: Info,
  normal: CheckCircle,
  high: AlertTriangle,
  urgent: AlertCircle
};

export default function AnnouncementBanner() {
  const { user, profile, isLoading: userLoading } = useUser();
  const { isTestMode } = useTestMode();
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
  const { data: announcements = [], isLoading, error: queryError } = useQuery({
    queryKey: ['announcements', user?.id],
    queryFn: async () => {
      if (!supabase || !user?.id) {
        console.log('AnnouncementBanner: No supabase or user, skipping fetch');
        return [];
      }
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('AnnouncementBanner: Session error:', sessionError);
        return [];
      }
      if (!session?.access_token) {
        console.log('AnnouncementBanner: No access token, skipping fetch');
        return [];
      }

      try {
        console.log('AnnouncementBanner: Fetching announcements from API...');
        const response = await fetch('/api/data/announcements', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('AnnouncementBanner: API response not OK:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText
          });
          return [];
        }

        const result = await response.json();
        if (!result.success) {
          console.error('AnnouncementBanner: API error:', result.error || 'Unknown error', {
            status: response.status,
            statusText: response.statusText,
            result
          });
          return [];
        }

        const announcements = result.data || [];
        console.log(`AnnouncementBanner: Received ${announcements.length} announcements from API`, announcements);

        // API already filters for active/non-expired, but double-check client-side
        const now = new Date();
        const filtered = announcements.filter(announcement => {
          if (!announcement.is_active) {
            console.log(`AnnouncementBanner: Filtered out inactive announcement: ${announcement.id} - ${announcement.title}`);
            return false;
          }
          if (announcement.expires_at && new Date(announcement.expires_at) <= now) {
            console.log(`AnnouncementBanner: Filtered out expired announcement: ${announcement.id} - ${announcement.title} (expired: ${announcement.expires_at})`);
            return false;
          }
          return true;
        });

        console.log(`AnnouncementBanner: ${filtered.length} announcements after filtering`, filtered.map(a => ({ id: a.id, title: a.title })));
        return filtered;
      } catch (error) {
        console.error('AnnouncementBanner: Fetch error:', error);
        return [];
      }
    },
    enabled: !!user && !userLoading, // Always enabled - announcements are required
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    retry: 2, // Retry failed requests
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
  // Convert both to strings for comparison (handles UUID vs string mismatches)
  const visibleAnnouncements = announcements.filter(
    a => !dismissedAnnouncements.some(dismissedId => {
      const announcementIdStr = String(a.id);
      const dismissedIdStr = String(dismissedId);
      return announcementIdStr === dismissedIdStr;
    })
  );

  // Debug: Log if announcements are being filtered out
  useEffect(() => {
    if (announcements.length > 0) {
      const dismissed = announcements.filter(a => {
        return dismissedAnnouncements.some(dismissedId => {
          return String(dismissedId) === String(a.id);
        });
      });
      
      if (dismissed.length > 0) {
        console.log(`AnnouncementBanner: ${dismissed.length} announcement(s) dismissed:`, dismissed.map(a => ({ id: a.id, title: a.title })));
        console.log('AnnouncementBanner: Dismissed IDs:', dismissedAnnouncements);
        console.log('AnnouncementBanner: To clear dismissed announcements, run: localStorage.removeItem("dismissedAnnouncements")');
      }
      
      if (visibleAnnouncements.length === 0 && announcements.length > 0) {
        console.warn('AnnouncementBanner: All announcements are dismissed!', {
          total: announcements.length,
          dismissed: dismissedAnnouncements,
          announcementIds: announcements.map(a => ({ id: a.id, idType: typeof a.id, title: a.title }))
        });
        console.warn('AnnouncementBanner: Clear dismissed announcements with: localStorage.removeItem("dismissedAnnouncements")');
      }
      
      console.log(`AnnouncementBanner: ${visibleAnnouncements.length} visible out of ${announcements.length} total announcements`, {
        visible: visibleAnnouncements.map(a => ({ id: a.id, title: a.title })),
        dismissed: dismissed.map(a => ({ id: a.id, title: a.title }))
      });
    } else if (!isLoading && !userLoading) {
      console.log('AnnouncementBanner: No announcements found in database');
    }
  }, [announcements, visibleAnnouncements, dismissedAnnouncements, isLoading, userLoading]);

  // Debug logging
  useEffect(() => {
    if (queryError) {
      console.error('AnnouncementBanner query error:', queryError);
    }
    console.log('AnnouncementBanner state:', {
      userLoading,
      isLoading,
      announcementsCount: announcements.length,
      visibleCount: visibleAnnouncements.length,
      dismissedCount: dismissedAnnouncements.length,
      hasUser: !!user,
      userId: user?.id,
      hasSession: !!supabase,
      queryEnabled: !!user && !userLoading,
      queryError: queryError?.message
    });
  }, [userLoading, isLoading, announcements.length, visibleAnnouncements.length, dismissedAnnouncements.length, user, supabase, queryError]);

  // Don't show banner while loading or if no visible announcements
  if (userLoading || isLoading) {
    return null;
  }

  // NOTE: Announcements always show for all users, including system admins
  // This ensures important system announcements are visible to everyone

  // Log if we have announcements but they're all dismissed
  if (announcements.length > 0 && visibleAnnouncements.length === 0) {
    console.warn('AnnouncementBanner: All announcements are dismissed', {
      total: announcements.length,
      dismissed: dismissedAnnouncements
    });
  }

  // Don't show banner if no visible announcements
  if (visibleAnnouncements.length === 0) {
    return null;
  }

  // Show the most recent announcement (or first one if multiple)
  const announcement = visibleAnnouncements[0];
  const PriorityIcon = PRIORITY_ICONS[announcement.priority] || Info;

  return (
    <>
      <div 
        className={`border-b ${PRIORITY_COLORS[announcement.priority] || PRIORITY_COLORS.normal} fixed left-0 right-0 w-full backdrop-blur-sm`}
        style={{
          // Position below nav (nav is 64px/4rem tall)
          // If test mode: below test mode (40px) + nav (64px) = 104px
          // If no test mode: below nav (64px) = 64px
          top: isTestMode ? '104px' : '64px', // Below nav (64px) + test mode banner (40px) if active
          zIndex: 55, // Above nav (z-50) to ensure content doesn't scroll through it
          backgroundColor: 'inherit', // Ensure background is opaque
        }}
      >
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

