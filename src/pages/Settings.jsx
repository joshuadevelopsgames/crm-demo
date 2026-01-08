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
  Loader2,
  Lock,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import toast from 'react-hot-toast';
import { exportAllDataToGoogleSheet } from '@/services/googleSheetsService';
import { autoAssignRevenueSegments } from '@/utils/revenueSegmentCalculator';

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
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [isRecalculatingSegments, setIsRecalculatingSegments] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      // Only include notification_preferences if it's being updated
      // Skip if column doesn't exist (will be handled by API fallback)
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
      // Invalidate all user-related queries to refresh profile data
      queryClient.invalidateQueries({ queryKey: ['auth-session'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
      // Don't dispatch authStateChange event - that's for actual auth changes, not profile updates
      // The query invalidation will trigger UserContext to refetch the profile
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

  const changePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }) => {
      if (!supabase || !user?.id) {
        throw new Error('Not authenticated');
      }

      // Validate passwords
      if (!currentPassword || !newPassword) {
        throw new Error('Current password and new password are required');
      }

      if (newPassword.length < 6) {
        throw new Error('New password must be at least 6 characters long');
      }

      // Supabase requires re-authentication before password change
      // First, verify the current password by signing in
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // Now update the password
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw new Error(updateError.message || 'Failed to update password');
      }

      return updateData;
    },
    onSuccess: () => {
      // Clear password fields
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('✓ Password changed successfully');
    },
    onError: (error) => {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Failed to change password. Please try again.');
    }
  });

  const handleChangePassword = () => {
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    changePasswordMutation.mutate({
      currentPassword,
      newPassword
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

  const handleRecalculateSegments = async () => {
    if (!window.confirm('Recalculate revenue segments for all accounts based on selected year revenue percentages (year-based, not rolling 12 months)? This will update all accounts.')) {
      return;
    }

    setIsRecalculatingSegments(true);
    
    try {
      toast.loading('Recalculating revenue segments...', { id: 'recalculate-segments-toast' });
      
      // Fetch all accounts and estimates
      const accounts = await base44.entities.Account.list();
      const estimatesResponse = await fetch('/api/data/estimates');
      if (!estimatesResponse.ok) throw new Error('Failed to fetch estimates');
      const estimatesResult = await estimatesResponse.json();
      const allEstimates = estimatesResult.success ? (estimatesResult.data || []) : [];
      
      // Group estimates by account_id
      const estimatesByAccountId = {};
      allEstimates.forEach(est => {
        if (est.account_id) {
          if (!estimatesByAccountId[est.account_id]) {
            estimatesByAccountId[est.account_id] = [];
          }
          estimatesByAccountId[est.account_id].push(est);
        }
      });
      
      // Calculate segments for all accounts
      const updatedAccounts = autoAssignRevenueSegments(accounts, estimatesByAccountId);
      
      // Count segments for logging (use selected year's segment)
      const currentYearForLogging = typeof window !== 'undefined' && window.__getCurrentYear ? window.__getCurrentYear() : (() => { throw new Error('Settings: YearSelectorContext not initialized. Selected year is required.'); })();
      const segmentCounts = updatedAccounts.reduce((acc, account) => {
        const segment = account.segment_by_year?.[currentYearForLogging.toString()] || account.revenue_segment || 'null';
        acc[segment] = (acc[segment] || 0) + 1;
        return acc;
      }, {});
      
      const currentYear = typeof window !== 'undefined' && window.__getCurrentYear ? window.__getCurrentYear() : 'unknown';
      
      console.log('📊 Segment recalculation results:', {
        totalAccounts: updatedAccounts.length,
        segmentCounts,
        year: currentYear
      });
      
      // Update ALL accounts with their calculated segments
      // Ensure we update accounts even if they don't have a segment yet (will get 'C' as default)
      // Update both segment_by_year and revenue_segment (for backward compatibility)
      const updates = updatedAccounts.map(account => {
        const selectedYearSegment = account.segment_by_year?.[currentYear.toString()] || account.revenue_segment || 'C';
        return base44.entities.Account.update(account.id, { 
          segment_by_year: account.segment_by_year,
          revenue_segment: selectedYearSegment // Keep for backward compatibility
        })
          .then(() => {
            if (selectedYearSegment === 'D') {
              console.log(`✅ Updated ${account.name || account.id} to Segment D`);
            }
            return { success: true, accountId: account.id, segment: selectedYearSegment };
          })
          .catch(error => {
            console.error(`❌ Failed to update revenue segment for account ${account.id || account.name}:`, error);
            return { success: false, accountId: account.id, error: error.message };
          });
      });
      
      const results = await Promise.all(updates);
      const successCount = results.filter(r => r.success).length;
      const dSegmentCount = results.filter(r => r.success && r.segment === 'D').length;
      const failedCount = results.filter(r => !r.success).length;
      
      if (failedCount > 0) {
        console.warn(`⚠️ ${failedCount} accounts failed to update. Check console for details.`);
        toast.error(`${failedCount} accounts failed to update. Check console for details.`, { id: 'recalculate-segments-toast' });
      }
      
      console.log(`✅ Segment updates: ${successCount} successful, ${failedCount} failed, ${dSegmentCount} Segment D accounts`);
      
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      
      const segmentSummary = Object.entries(segmentCounts)
        .map(([seg, count]) => `${seg}: ${count}`)
        .join(', ');
      
      if (failedCount === 0) {
        toast.success(`✓ Revenue segments recalculated for ${currentYear}: ${segmentSummary}`, { id: 'recalculate-segments-toast' });
      } else {
        toast.success(`✓ Revenue segments recalculated: ${successCount} updated, ${failedCount} failed. ${segmentSummary}`, { id: 'recalculate-segments-toast' });
      }
    } catch (error) {
      console.error('Error recalculating segments:', error);
      toast.error(error.message || 'Failed to recalculate segments', { id: 'recalculate-segments-toast' });
    } finally {
      setIsRecalculatingSegments(false);
    }
  };

  const handleRefreshCache = async () => {
    if (!supabase || !user) {
      toast.error('Not authenticated');
      return;
    }

    setIsRefreshingCache(true);
    
    try {
      toast.loading('Refreshing notification cache...', { id: 'refresh-cache-toast' });
      
      // Get session token for API call
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('No session token available. Please log out and log back in.');
      }

      const response = await fetch('/api/admin/refresh-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      let result;
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // If not JSON, get text and try to parse error
        const text = await response.text();
        throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to refresh cache');
      }

      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['at-risk-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      
      toast.success(
        `✓ Cache refreshed! ${result.data.atRiskCount} at-risk accounts, ${result.data.neglectedCount} neglected accounts.`,
        { id: 'refresh-cache-toast', duration: 5000 }
      );
    } catch (error) {
      console.error('Cache refresh error:', error);
      toast.error(
        `Cache refresh failed: ${error.message || 'Unknown error'}`,
        { id: 'refresh-cache-toast', duration: 5000 }
      );
    } finally {
      setIsRefreshingCache(false);
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

      {/* Security Settings - Password Change */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Security Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="dark:text-[#ffffff]">Current Password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="dark:text-[#ffffff]">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Password must be at least 6 characters long</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="dark:text-[#ffffff]">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button 
            onClick={handleChangePassword}
            disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            <Lock className="w-4 h-4 mr-2" />
            {changePasswordMutation.isPending ? 'Changing Password...' : 'Change Password'}
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

      {/* Admin Tools */}
      {isAdmin && (
        <>
          {/* Cache Refresh - Admin Only */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                System Cache
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Manually refresh the notification cache for at-risk accounts and neglected accounts. 
                  The cache is normally refreshed automatically every 5 minutes by a background job.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use this if you need to see updated at-risk accounts immediately after data changes.
                </p>
              </div>
              
              <Button
                onClick={handleRefreshCache}
                disabled={isRefreshingCache}
                variant="outline"
                className="border-slate-300 disabled:opacity-50"
              >
                {isRefreshingCache ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh Notification Cache
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Revenue Segment Recalculation - Admin Only */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Revenue Segments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Recalculate revenue segments for all accounts based on selected year revenue percentages (year-based, not rolling 12 months).
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Segments are automatically recalculated on import. Use this to manually trigger recalculation if needed.
                </p>
              </div>
              
              <Button
                onClick={handleRecalculateSegments}
                disabled={isRecalculatingSegments}
                variant="outline"
                className="border-slate-300 disabled:opacity-50"
              >
                {isRecalculatingSegments ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Recalculating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Recalculate Segments
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Data Export - Admin Only */}
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
        </>
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

