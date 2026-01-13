import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, CheckCircle2, XCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  isGmailConnected, 
  disconnectGmail, 
  getLastSyncTimestamp,
  storeGmailToken
} from '../services/gmailService';
import { syncGmailToCRM } from '../services/gmailSyncService';
import { base44 } from '@/api/base44Client';
import { useUser } from '@/contexts/UserContext';
import { getSupabaseAuth } from '@/services/supabaseClient';
import toast from 'react-hot-toast';

export default function GmailConnection({ onSyncComplete }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const { user } = useUser();

  // Check connection status - following Calendar/Drive pattern
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    const checkConnection = async (forceRetry = false) => {
      try {
        console.log('🔍 Checking Gmail connection status...', { retryCount, forceRetry });
        
        // First check if already connected (checks database)
        let connected = await isGmailConnected();
        console.log('📊 Database connection check result:', connected);
        
        // If not connected, check if we have Gmail token in Supabase session
        // This handles cases where user logged in with Google and granted Gmail permissions
        if (!connected && user?.id) {
          const supabase = getSupabaseAuth();
          if (supabase) {
            try {
              const { data: { session } } = await supabase.auth.getSession();
              
              // Check if provider_token exists (Gmail token from Google OAuth with Gmail scopes)
              if (session?.provider_token && session?.provider_refresh_token) {
                console.log('📧 Found Gmail token in session, storing integration...');
                try {
                  await storeGmailToken({
                    access_token: session.provider_token,
                    refresh_token: session.provider_refresh_token,
                    expires_in: session.expires_in || 3600
                  });
                  
                  // Wait a moment for database to update
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  // Check again after storing
                  connected = await isGmailConnected();
                  console.log('📊 Connection check after storing token:', connected);
                  
                  if (connected) {
                    console.log('✅ Gmail integration stored and verified');
                  }
                } catch (error) {
                  console.error('Error storing Gmail token from session:', error);
                  // Don't set connected to true here - wait for database check
                }
              } else {
                // No provider_token means no Gmail permissions granted yet
                console.log('ℹ️ No Gmail token found in session - checking database again...');
                // Re-check database in case token was stored by callback but session doesn't have it
                connected = await isGmailConnected();
                console.log('📊 Re-check database result:', connected);
                
                // If still not connected and we haven't retried too many times, retry after a delay
                // This handles the case where the callback just stored the token but we're checking too quickly
                if (!connected && retryCount < maxRetries && !forceRetry) {
                  retryCount++;
                  console.log(`🔄 Retrying connection check (${retryCount}/${maxRetries}) in 2 seconds...`);
                  setTimeout(() => {
                    if (isMounted) {
                      checkConnection(true);
                    }
                  }, 2000);
                  return; // Don't update state yet, wait for retry
                }
              }
            } catch (error) {
              console.error('Error getting Supabase session:', error);
            }
          }
        }
        
        if (isMounted) {
          console.log('✅ Setting connected state to:', connected);
          setConnected(connected);
          const syncTime = getLastSyncTimestamp();
          setLastSync(syncTime);
        }
      } catch (error) {
        console.error('Error checking Gmail connection:', error);
        if (isMounted) {
          setConnected(false);
        }
      }
    };
    
    // Initial check with a slight delay to allow OAuth callback to complete
    timeoutId = setTimeout(() => {
      checkConnection();
    }, 500);
    
    // Also check when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        console.log('👁️ Page became visible, re-checking Gmail connection...');
        retryCount = 0; // Reset retry count on visibility change
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => checkConnection(), 100);
      }
    };
    
    // Also check on focus (user switches back to tab)
    const handleFocus = () => {
      if (user?.id) {
        console.log('👁️ Window focused, re-checking Gmail connection...');
        retryCount = 0;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => checkConnection(), 100);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user?.id]);

  // Get current user email
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const user = await base44.auth.me();
      return user;
    }
  });

  // Get contacts and accounts for matching
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => base44.entities.Contact.list()
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list()
  });

  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      const supabase = getSupabaseAuth();
      if (!supabase) {
        toast.error('Authentication not available. Please refresh the page.');
        setIsConnecting(false);
        return;
      }
      
      // First, quickly check if we already have a Gmail token in the session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.provider_token && session?.provider_refresh_token) {
        console.log('📧 Found Gmail token in Supabase session, storing...');
        try {
          await storeGmailToken({
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token,
            expires_in: session.expires_in || 3600
          });
          
          // Wait a moment for database to update, then verify connection
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Retry connection check a few times to ensure persistence
          let isConnected = false;
          for (let i = 0; i < 3; i++) {
            isConnected = await isGmailConnected();
            if (isConnected) break;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          
          setConnected(isConnected);
          
          if (isConnected) {
            toast.success('Gmail connected successfully!');
            setIsConnecting(false);
            return;
          } else {
            console.warn('⚠️ Gmail token stored but connection check failed');
            // Continue to OAuth flow to ensure proper connection
          }
        } catch (error) {
          console.error('Error storing Gmail token from session:', error);
          toast.error('Failed to store Gmail token. Please try connecting again.');
        }
      }
      
      // Store the current page path so we can redirect back to it after OAuth
      const currentPath = window.location.pathname + window.location.search;
      localStorage.setItem('gmail_oauth_return_path', currentPath);
      
      // Open Google OAuth consent screen to request Gmail permissions
      const redirectUrl = window.location.origin + '/google-auth-callback';
      
      console.log('📧 Opening Google OAuth to request Gmail access...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          scopes: 'https://www.googleapis.com/auth/gmail.readonly',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      
      if (error) {
        console.error('Error initiating Gmail OAuth:', error);
        toast.error('Failed to open Gmail authorization. Please try again.');
        setIsConnecting(false);
        return;
      }
      
      // Redirect to Google OAuth consent screen
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      
      toast.error('Unable to connect Gmail. Please ensure you are logged in.');
      setIsConnecting(false);
    } catch (error) {
      console.error('Error connecting Gmail:', error);
      toast.error('Failed to connect Gmail. Please try again.');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect Gmail? This will stop automatic email syncing.')) {
      try {
        await disconnectGmail();
        setConnected(false);
        setLastSync(null);
        toast.success('Gmail disconnected');
      } catch (error) {
        console.error('Error disconnecting Gmail:', error);
        toast.error('Failed to disconnect Gmail');
      }
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncGmailToCRM(
        contacts,
        accounts,
        currentUser?.email || ''
      );

      if (result.success) {
        toast.success(result.message);
        setLastSync(new Date());
        
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['interactions'] });
        queryClient.invalidateQueries({ queryKey: ['accounts'] });
        
        if (onSyncComplete) {
          onSyncComplete(result);
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(`Sync failed: ${error.message}`);
      console.error('Gmail sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Gmail</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Sync emails with your CRM contacts and accounts
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {connected ? (
              <>
                <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
                {lastSync && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Last synced: {new Date(lastSync).toLocaleString()}
                  </span>
                )}
                <Button
                  onClick={handleSync}
                  disabled={isSyncing}
                  variant="outline"
                  size="sm"
                  className="border-slate-300"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing...' : 'Sync'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={isConnecting}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                size="sm"
              >
                {isConnecting ? 'Connecting...' : 'Connect Gmail'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}




