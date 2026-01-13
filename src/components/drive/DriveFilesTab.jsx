import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, Plus, ExternalLink, Trash2, File, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSupabaseClient } from '@/services/supabaseClient';
import { isDriveConnected } from '@/services/driveService';
import DriveFilePicker from './DriveFilePicker';
import toast from 'react-hot-toast';

export default function DriveFilesTab({ accountId, estimateId, taskId, ticketId }) {
  const [showPicker, setShowPicker] = useState(false);
  const [isDriveConnectedState, setIsDriveConnectedState] = useState(false);
  const queryClient = useQueryClient();

  // Check Drive connection
  React.useEffect(() => {
    const checkConnection = async () => {
      const connected = await isDriveConnected();
      setIsDriveConnectedState(connected);
    };
    checkConnection();
  }, []);

  // Fetch linked files
  const { data: linkedFiles = [], isLoading } = useQuery({
    queryKey: ['drive-files-linked', accountId, estimateId, taskId, ticketId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('drive_files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (accountId) query = query.eq('account_id', accountId);
      if (estimateId) query = query.eq('estimate_id', estimateId);
      if (taskId) query = query.eq('task_id', taskId);
      if (ticketId) query = query.eq('ticket_id', ticketId);

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching linked files:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!accountId || !!estimateId || !!taskId || !!ticketId
  });

  // Link file mutation
  const linkFileMutation = useMutation({
    mutationFn: async (file) => {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase not configured');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const linkData = {
        google_file_id: file.id,
        user_id: user.id,
        file_name: file.name,
        file_type: file.mimeType?.split('/')[0] || 'file',
        mime_type: file.mimeType,
        file_size: file.size || null,
        web_view_link: file.webViewLink,
        web_content_link: file.webContentLink,
        thumbnail_link: file.thumbnailLink || null,
        account_id: accountId || null,
        estimate_id: estimateId || null,
        task_id: taskId || null,
        ticket_id: ticketId || null
      };

      const { data, error } = await supabase
        .from('drive_files')
        .insert(linkData)
        .select()
        .single();

      if (error) {
        // If duplicate, that's okay
        if (error.code === '23505') {
          return { success: true, message: 'File already linked' };
        }
        throw error;
      }

      return { success: true, data };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files-linked'] });
      setShowPicker(false);
      toast.success('File linked successfully');
    },
    onError: (error) => {
      console.error('Error linking file:', error);
      toast.error(error.message || 'Failed to link file');
    }
  });

  // Unlink file mutation
  const unlinkFileMutation = useMutation({
    mutationFn: async (fileId) => {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase not configured');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('drive_files')
        .delete()
        .eq('id', fileId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drive-files-linked'] });
      toast.success('File unlinked successfully');
    },
    onError: (error) => {
      console.error('Error unlinking file:', error);
      toast.error('Failed to unlink file');
    }
  });

  const handleFileSelect = (file) => {
    linkFileMutation.mutate(file);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    const mb = kb / 1024;
    return `${Math.round(mb * 10) / 10} MB`;
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes('pdf')) return <File className="w-5 h-5 text-red-500" />;
    if (mimeType?.includes('spreadsheet')) return <File className="w-5 h-5 text-green-500" />;
    if (mimeType?.includes('document')) return <File className="w-5 h-5 text-blue-500" />;
    return <File className="w-5 h-5 text-slate-500" />;
  };

  if (!isDriveConnectedState) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 text-slate-400" />
          <p className="text-slate-600 dark:text-slate-400 mb-2">
            Connect Google Drive to link files
          </p>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/settings'}
          >
            Go to Settings
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Linked Drive Files
        </h3>
        <Button
          onClick={() => setShowPicker(true)}
          size="sm"
          className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Link File
        </Button>
      </div>

      {showPicker && (
        <DriveFilePicker
          onSelect={handleFileSelect}
          onCancel={() => setShowPicker(false)}
          accountId={accountId}
          estimateId={estimateId}
        />
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" />
          </CardContent>
        </Card>
      ) : linkedFiles.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-slate-500 dark:text-slate-400">
            <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No files linked yet</p>
            <p className="text-sm mt-1">Click "Link File" to add files from Google Drive</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {linkedFiles.map((file) => (
            <Card key={file.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {file.thumbnail_link ? (
                      <img
                        src={file.thumbnail_link}
                        alt={file.file_name}
                        className="w-12 h-12 rounded object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        {getFileIcon(file.mime_type)}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-slate-900 dark:text-white truncate">
                      {file.file_name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {file.file_type || 'file'}
                      </Badge>
                      {file.file_size && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatFileSize(file.file_size)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      {file.web_view_link && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(file.web_view_link, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Open
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unlinkFileMutation.mutate(file.id)}
                        disabled={unlinkFileMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Unlink
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
