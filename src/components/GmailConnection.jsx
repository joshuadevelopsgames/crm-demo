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
    const checkConnection = async () => {
      // First check if already connected
      let connected = await isGmailConnected();
      
      // If not connected, check if we have Gmail token in Supabase session
      if (!connected && user) {
        const supabase = getSupabaseAuth();
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          
          // If provider_token exists (Gmail token from initial Google login), try to store it
          if (session?.provider_token && session?.provider_refresh_token) {
            try {
              await storeGmailToken({
                access_token: session.provider_token,
                refresh_token: session.provider_refresh_token,
                expires_in: session.expires_in || 3600
              });
              
              // Check again after storing
              connected = await isGmailConnected();
            } catch (error) {
              console.error('Error storing Gmail token from session:', error);
            }
          }
        }
      }
      
      setConnected(connected);
      const syncTime = getLastSyncTimestamp();
      setLastSync(syncTime);
    };
    
    checkConnection();
    
    // Also check when user changes (in case they just logged in with Google)
    if (user) {
      checkConnection();
    }
  }, [user]);

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
      // First, check if user logged in with Google and has Gmail token in Supabase session
      const supabase = getSupabaseAuth();
      if (supabase && user) {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Check if provider_token exists (Gmail token from initial Google login)
        if (session?.provider_token && session?.provider_refresh_token) {
          console.log('📧 Found Gmail token in Supabase session, storing...');
          try {
            await storeGmailToken({
              access_token: session.provider_token,
              refresh_token: session.provider_refresh_token,
              expires_in: session.expires_in || 3600
            });
            
            // Check connection status
            const isConnected = await isGmailConnected();
            setConnected(isConnected);
            
            if (isConnected) {
              toast.success('Gmail connected successfully!');
              setIsConnecting(false);
              return;
            }
          } catch (error) {
            console.error('Error storing Gmail token from session:', error);
            // Fall through to separate Gmail OAuth flow
          }
        }
      }
      
      // If no token in session, use separate Gmail OAuth flow
      const authUrl = initGmailAuth();
      
      if (!authUrl) {
        toast.error('Gmail integration not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file.');
        setIsConnecting(false);
        return;
      }
      
      // Redirect to Gmail OAuth
      window.location.href = authUrl;
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




