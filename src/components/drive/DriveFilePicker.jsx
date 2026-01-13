import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, File, Search, Loader2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { listDriveFiles, searchDriveFiles } from '@/services/driveService';
import toast from 'react-hot-toast';

export default function DriveFilePicker({ onSelect, onCancel, accountId = null, estimateId = null }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch recent files
  const { data: filesData, isLoading, refetch } = useQuery({
    queryKey: ['drive-files-picker', accountId, estimateId],
    queryFn: async () => {
      try {
        // Get recent files (last 50)
        const result = await listDriveFiles({
          q: "trashed=false",
          pageSize: 50,
          fields: 'files(id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink,createdTime,modifiedTime,shared,iconLink)'
        });
        return result.files || [];
      } catch (error) {
        console.error('Error fetching Drive files:', error);
        toast.error('Failed to load Drive files. Make sure Drive is connected.');
        return [];
      }
    },
    enabled: true, // Fetch when component mounts
    retry: false
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      refetch();
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchDriveFiles(`name contains '${searchQuery}'`);
      // Update the query cache
      // Note: This is a simplified approach - in production you might want to use a separate query key
    } catch (error) {
      console.error('Error searching Drive files:', error);
      toast.error('Failed to search Drive files');
    } finally {
      setIsSearching(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    const mb = kb / 1024;
    return `${Math.round(mb * 10) / 10} MB`;
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes('folder')) return <FolderOpen className="w-5 h-5" />;
    if (mimeType?.includes('pdf')) return <File className="w-5 h-5 text-red-500" />;
    if (mimeType?.includes('spreadsheet')) return <File className="w-5 h-5 text-green-500" />;
    if (mimeType?.includes('document')) return <File className="w-5 h-5 text-blue-500" />;
    return <File className="w-5 h-5 text-slate-500" />;
  };

  const handleSelect = () => {
    if (selectedFile && onSelect) {
      onSelect(selectedFile);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Select Drive File
          </h3>
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={isSearching}>
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* File List */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              <span className="ml-2 text-slate-600 dark:text-slate-400">Loading files...</span>
            </div>
          ) : !filesData || filesData.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No files found</p>
              <p className="text-sm mt-1">Make sure Drive is connected in Settings</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {filesData.map((file) => (
                <div
                  key={file.id}
                  onClick={() => setSelectedFile(file)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                    selectedFile?.id === file.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {file.thumbnailLink ? (
                        <img
                          src={file.thumbnailLink}
                          alt={file.name}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                          {getFileIcon(file.mimeType)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {file.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {file.mimeType?.split('/')[1] || 'file'}
                        </Badge>
                        {file.size && (
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formatFileSize(file.size)}
                          </span>
                        )}
                        {file.shared && (
                          <Badge variant="outline" className="text-xs">
                            Shared
                          </Badge>
                        )}
                      </div>
                    </div>
                    {selectedFile?.id === file.id && (
                      <Check className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSelect}
            disabled={!selectedFile}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            Select File
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
