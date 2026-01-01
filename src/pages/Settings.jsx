import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import { base44 } from '@/api/base44Client';
import { getSupabaseAuth } from '@/services/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ThemeSwitch } from '@/components/ui/theme-switch';
import { 
  User, 
  Bell, 
  Monitor, 
  FileText,
  Save,
  Link as LinkIcon,
  Download,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import toast from 'react-hot-toast';
import { exportAllDataToGoogleSheet } from '@/services/googleSheetsService';

export default function Settings() {
  const { profile, user, isAdmin } = useUser();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const supabase = getSupabaseAuth();

  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [taskReminders, setTaskReminders] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null);

  // Update state when profile/user data loads
  useEffect(() => {
    setFullName(profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || '');
    setPhoneNumber(profile?.phone_number || '');
    
    // Load notification preferences from profile
    const prefs = profile?.notification_preferences || {};
    setEmailNotifications(prefs.email_notifications !== false); // Default to true
    setTaskReminders(prefs.task_reminders !== false); // Default to true
    // System announcements are always enabled (no toggle)
  }, [profile, user]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      if (!supabase || !user?.id) {
        throw new Error('Not authenticated');
      }
      
      // Update profile directly using Supabase client (RLS will handle permissions)
      const updateData = {
        id: user.id,
        updated_at: new Date().toISOString()
      };

      if (data.full_name !== undefined) {
        updateData.full_name = data.full_name || null;
      }
      if (data.phone_number !== undefined) {
        updateData.phone_number = data.phone_number || null;
      }
      if (data.notification_preferences !== undefined) {
        updateData.notification_preferences = data.notification_preferences;
      }

      console.log('Attempting to update profile directly via Supabase...', { updateData, userId: user.id });
      
      // Try direct Supabase update first
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .upsert(updateData, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Direct Supabase update failed:', {
          error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          userId: user.id,
          updateData
        });
        
        // Always use API endpoint as fallback (more reliable)
        console.log('🔄 Trying API endpoint as fallback...');
        
        // Get session token for API fallback
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.access_token) {
          console.error('❌ Session error:', sessionError);
          throw new Error('No session token available. Please log out and log back in.');
        }

        console.log('📡 Calling API endpoint with token...', { 
          tokenLength: session.access_token.length,
          tokenPreview: session.access_token.substring(0, 20) + '...'
        });
        
        const response = await fetch('/api/data/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify(data)
        });

        const result = await response.json();
        console.log('📥 API response:', { 
          status: response.status, 
          statusText: response.statusText,
          result,
          error: result.error
        });

        if (!response.ok || !result.success) {
          const errorMsg = result.error || 'Failed to update profile';
          console.error('❌ API update failed:', errorMsg);
          throw new Error(errorMsg);
        }

        console.log('✅ Profile updated successfully via API endpoint');
        return result.data;
      }
      
      console.log('✅ Profile updated successfully via direct Supabase update');
      return updatedProfile;
    },
    onSuccess: () => {
      // Invalidate all user-related queries
      queryClient.invalidateQueries({ queryKey: ['auth-session'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      // Force UserContext to refetch
      window.dispatchEvent(new Event('authStateChange'));
      toast.success('✓ Profile updated successfully');
    },
    onError: (error) => {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile. Please try again.');
    }
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      full_name: fullName,
      phone_number: phoneNumber,
      notification_preferences: {
        email_notifications: emailNotifications,
        task_reminders: taskReminders,
        system_announcements: true // Always true - announcements are required
      }
    });
  };

  const handleExportAllData = async () => {
    setIsExporting(true);
    setExportProgress({ message: 'Preparing export...', accounts: 0, contacts: 0 });
    
    try {
      toast.loading('Exporting data to Google Sheets...', { id: 'export-toast' });
      
      const result = await exportAllDataToGoogleSheet();
      
      if (result.success) {
        const { accountsExported, contactsExported, totalRecords } = result.summary;
        toast.success(
          `✓ Export complete! ${accountsExported} accounts and ${contactsExported} contacts exported.`,
          { id: 'export-toast', duration: 5000 }
        );
        setExportProgress({
          message: 'Export complete!',
          accounts: accountsExported,
          contacts: contactsExported,
          total: totalRecords
        });
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error(
        `Export failed: ${error.message || 'Unknown error'}`,
        { id: 'export-toast', duration: 5000 }
      );
      setExportProgress(null);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Profile Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="dark:text-[#ffffff]">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumber" className="dark:text-[#ffffff]">Phone Number</Label>
            <Input
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter your phone number"
              type="tel"
            />
          </div>
          <div className="space-y-2">
            <Label className="dark:text-[#ffffff]">Email</Label>
            <Input
              value={profile?.email || user?.email || ''}
              disabled
              className="bg-slate-50 dark:bg-slate-800 dark:text-[#ffffff]"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">Email cannot be changed</p>
          </div>
          <Button 
            onClick={handleSaveProfile}
            disabled={updateProfileMutation.isPending}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-slate-500">Receive email notifications for important updates</p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Task Reminders</Label>
              <p className="text-sm text-slate-500">Get reminders for upcoming and overdue tasks</p>
            </div>
            <Switch
              checked={taskReminders}
              onCheckedChange={setTaskReminders}
            />
          </div>
          <Button 
            onClick={handleSaveProfile}
            disabled={updateProfileMutation.isPending}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 mt-4"
          >
            <Save className="w-4 h-4 mr-2" />
            {updateProfileMutation.isPending ? 'Saving...' : 'Save Notification Preferences'}
          </Button>
        </CardContent>
      </Card>

      {/* Display Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Display Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Dark Mode</Label>
              <p className="text-sm text-slate-500 dark:text-slate-400">Switch to dark theme for better viewing in low light</p>
            </div>
            <ThemeSwitch
              checked={isDarkMode}
              onCheckedChange={toggleDarkMode}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Export - Admin Only */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5" />
              Data Export
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Export all accounts and contacts data to Google Sheets. The data will be organized into separate tabs:
              </p>
              <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1 ml-2">
                <li><strong>Imported Accounts</strong> - All account information</li>
                <li><strong>Imported Contacts</strong> - All contact information</li>
                <li><strong>All Data</strong> - Combined view with account and contact data together</li>
              </ul>
            </div>
            
            {exportProgress && (
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">{exportProgress.message}</p>
                {exportProgress.total > 0 && (
                  <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <p>✓ Accounts exported: {exportProgress.accounts}</p>
                    <p>✓ Contacts exported: {exportProgress.contacts}</p>
                    <p className="font-medium mt-2">Total records: {exportProgress.total}</p>
                  </div>
                )}
              </div>
            )}
            
            <Button
              onClick={handleExportAllData}
              disabled={isExporting}
              variant="outline"
              className="border-slate-300 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export All Data to Google Sheets
                </>
              )}
            </Button>
            
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Note: This may take a few minutes for large datasets. The export will update existing data in your Google Sheet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* End of Year Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            End of Year Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            Access comprehensive end of year reports with win/loss analysis, department breakdowns, and account performance metrics.
          </p>
          <Button
            onClick={() => navigate(createPageUrl('Reports'))}
            variant="outline"
            className="border-slate-300"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Go to Reports
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

