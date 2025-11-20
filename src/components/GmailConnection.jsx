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
  initGmailAuth 
} from '../services/gmailService';
import { syncGmailToCRM } from '../services/gmailSyncService';
import { base44 } from '@/api/base44Client';
import toast from 'react-hot-toast';

export default function GmailConnection({ onSyncComplete }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Check connection status
  useEffect(() => {
    setConnected(isGmailConnected());
    const syncTime = getLastSyncTimestamp();
    setLastSync(syncTime);
  }, []);

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

  const handleConnect = () => {
    setIsConnecting(true);
    const authUrl = initGmailAuth();
    
    if (!authUrl) {
      toast.error('Gmail integration not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file.');
      setIsConnecting(false);
      return;
    }

    // Redirect to Gmail OAuth
    window.location.href = authUrl;
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect Gmail? This will stop automatic email syncing.')) {
      disconnectGmail();
      setConnected(false);
      setLastSync(null);
      toast.success('Gmail disconnected');
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

  if (!connected) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 mb-1">Connect Gmail</h3>
              <p className="text-sm text-slate-600 mb-4">
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
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-slate-900">Gmail Connected</h3>
              <Badge className="bg-emerald-100 text-emerald-800">Active</Badge>
            </div>
            {lastSync && (
              <p className="text-sm text-slate-600 mb-4">
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
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
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


