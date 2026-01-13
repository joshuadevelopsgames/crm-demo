import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  isDriveConnected, 
  disconnectDrive,
  storeDriveToken
} from '../services/driveService';
import { useUser } from '@/contexts/UserContext';
import { getSupabaseAuth } from '@/services/supabaseClient';
import toast from 'react-hot-toast';

export default function DriveConnection() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const { user } = useUser();

  // Check connection status
  useEffect(() => {
    let isMounted = true;
    
    const checkConnection = async () => {
      try {
        const connected = await isDriveConnected();
        if (isMounted) {
          setConnected(connected);
        }
      } catch (error) {
        console.error('Error checking Drive connection:', error);
        if (isMounted) {
          setConnected(false);
        }
      }
    };
    
    // Initial check with a slight delay to allow OAuth callback to complete
    const timeoutId = setTimeout(() => {
      checkConnection();
    }, 500);
    
    // Also check when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        checkConnection();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(timeoutId);
    };
  }, [user?.id]);

  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      const supabase = getSupabaseAuth();
      if (!supabase) {
        toast.error('Authentication not available. Please refresh the page.');
        setIsConnecting(false);
        return;
      }
      
      // First, check if we already have a Drive token in the session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.provider_token && session?.provider_refresh_token) {
        console.log('📁 Found Drive token in Supabase session, storing...');
        try {
          await storeDriveToken({
            access_token: session.provider_token,
            refresh_token: session.provider_refresh_token,
            expires_in: session.expires_in || 3600
          });
          
          const isConnected = await isDriveConnected();
          setConnected(isConnected);
          
          if (isConnected) {
            toast.success('Drive connected successfully!');
            setIsConnecting(false);
            return;
          }
        } catch (error) {
          console.error('Error storing Drive token from session:', error);
        }
      }
      
      // Store the current page path so we can redirect back to it after OAuth
      const currentPath = window.location.pathname + window.location.search;
      localStorage.setItem('drive_oauth_return_path', currentPath);
      
      // Open Google OAuth consent screen to request Drive permissions
      const redirectUrl = window.location.origin + '/google-auth-callback';
      
      console.log('📁 Opening Google OAuth to request Drive access...');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          scopes: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      
      if (error) {
        console.error('Error initiating Drive OAuth:', error);
        toast.error('Failed to open Drive authorization. Please try again.');
        setIsConnecting(false);
        return;
      }
      
      // Redirect to Google OAuth consent screen
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      
      toast.error('Unable to connect Drive. Please ensure you are logged in.');
      setIsConnecting(false);
    } catch (error) {
      console.error('Error connecting Drive:', error);
      toast.error('Failed to connect Drive. Please try again.');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect Google Drive? This will stop file syncing.')) {
      try {
        await disconnectDrive();
        setConnected(false);
        toast.success('Drive disconnected');
      } catch (error) {
        console.error('Error disconnecting Drive:', error);
        toast.error('Failed to disconnect Drive');
      }
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <FolderOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Google Drive</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Link documents and files to accounts and estimates
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
                {isConnecting ? 'Connecting...' : 'Connect Drive'}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
