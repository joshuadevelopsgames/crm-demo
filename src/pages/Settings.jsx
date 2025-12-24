import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';
import { base44 } from '@/api/base44Client';
import { getSupabaseAuth } from '@/services/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  User, 
  Bell, 
  Monitor, 
  FileText,
  Save,
  Link as LinkIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import toast from 'react-hot-toast';

export default function Settings() {
  const { profile, user } = useUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const supabase = getSupabaseAuth();

  const [fullName, setFullName] = useState(profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [taskReminders, setTaskReminders] = useState(true);
  const [systemAnnouncements, setSystemAnnouncements] = useState(true);

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      if (!supabase || !user?.id) {
        throw new Error('Not authenticated');
      }
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) throw error;
      return updatedProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-session'] });
      toast.success('✓ Profile updated');
    },
    onError: (error) => {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  });

  const handleSaveProfile = () => {
    updateProfileMutation.mutate({
      full_name: fullName,
      phone_number: phoneNumber
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600 mt-1">Manage your account settings and preferences</p>
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
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Enter your phone number"
              type="tel"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              value={profile?.email || user?.email || ''}
              disabled
              className="bg-slate-50"
            />
            <p className="text-xs text-slate-500">Email cannot be changed</p>
          </div>
          <Button 
            onClick={handleSaveProfile}
            disabled={updateProfileMutation.isPending}
            className="bg-slate-900 hover:bg-slate-800"
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
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>System Announcements</Label>
              <p className="text-sm text-slate-500">Receive notifications for system-wide announcements</p>
            </div>
            <Switch
              checked={systemAnnouncements}
              onCheckedChange={setSystemAnnouncements}
            />
          </div>
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
        <CardContent>
          <p className="text-sm text-slate-500">Display preferences coming soon</p>
        </CardContent>
      </Card>

      {/* End of Year Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            End of Year Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 mb-4">
            Access comprehensive end of year reports with win/loss analysis, department breakdowns, and account performance metrics.
          </p>
          <Button
            onClick={() => navigate(createPageUrl('Reports'))}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <LinkIcon className="w-4 h-4 mr-2" />
            Go to Reports
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

