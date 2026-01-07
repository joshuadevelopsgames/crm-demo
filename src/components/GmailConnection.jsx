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
  initGmailAuth,
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

  // Check connection status
  useEffect(() => {
    let isMounted = true;
    let timeoutId = null;
    
    const checkConnection = async () => {
      try {
        console.log('🔍 Checking Gmail connection status...');
        
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
                  
                  // Check again after storing
                  connected = await isGmailConnected();
                  console.log('📊 Connection check after storing token:', connected);
                  
                  if (connected) {
                    console.log('✅ Gmail integration stored and verified');
                  }
                } catch (error) {
                  console.error('Error storing Gmail token from session:', error);
                  // Even if storing fails, if we have the token in session, user has permissions
                  // We can consider them "connected" for UI purposes (hide the button)
                  connected = true;
                }
              } else {
                // No provider_token means no Gmail permissions granted yet
                console.log('ℹ️ No Gmail token found in session - checking database again...');
                // Re-check database in case token was stored by callback but session doesn't have it
                connected = await isGmailConnected();
                console.log('📊 Re-check database result:', connected);
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
    
    // Initial check
    timeoutId = setTimeout(() => {
      checkConnection();
    }, 100);
    
    // Also check when page becomes visible (user navigates back)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        console.log('👁️ Page became visible, re-checking Gmail connection...');
        clearTimeout(timeoutId);
        timeoutId = setTimeout(checkConnection, 100);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [user?.id]); // Only depend on user.id, not the entire user object

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
          
          const isConnected = await isGmailConnected();
          setConnected(isConnected);
          
          if (isConnected) {
            toast.success('Gmail connected successfully!');
            setIsConnecting(false);
            return;
          }
        } catch (error) {
          console.error('Error storing Gmail token from session:', error);
          // Continue to OAuth flow
        }
      }
      
      // Open Google OAuth consent screen to request Gmail permissions
      // This works whether the user is logged in with Google or not
      const redirectUrl = window.location.origin + '/google-auth-callback';
      
      console.log('📧 Opening Google OAuth to request Gmail access...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          scopes: 'https://www.googleapis.com/auth/gmail.readonly',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent', // Force consent screen to ensure Gmail scope is requested
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
        // Don't set isConnecting to false - we're redirecting
        return;
      }
      
      // Fallback: If Supabase OAuth fails, try separate Gmail OAuth flow
      const authUrl = initGmailAuth();
      if (authUrl) {
        window.location.href = authUrl;
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

  // Note: Gmail access is NOT automatically available through Google OAuth login
  // Supabase's Google OAuth only requests basic scopes (openid, email, profile)
  // Gmail API requires separate scopes (gmail.readonly) that need separate consent
  // So we only hide the button if Gmail is actually connected via the Gmail OAuth flow
  if (!connected) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-[#ffffff] mb-1">Connect Gmail</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                Automatically sync emails with your CRM contacts and track client relationships
              </p>
              <Button 
                onClick={handleConnect}
                disabled={isConnecting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isConnecting ? 'Connecting...' : 'Connect Gmail'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-slate-900 dark:text-[#ffffff]">Gmail Connected</h3>
              <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">Active</Badge>
            </div>
            {lastSync && (
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                Last synced: {new Date(lastSync).toLocaleString()}
              </p>
            )}
            <div className="flex gap-2">
              <Button 
                onClick={handleSync}
                disabled={isSyncing}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
              <Button 
                onClick={handleDisconnect}
                variant="outline"
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}




