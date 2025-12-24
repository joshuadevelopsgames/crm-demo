import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { 
  User, 
  Settings, 
  FileText, 
  LogOut, 
  ChevronDown,
  Phone,
  Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SimpleDropdown, SimpleDropdownItem } from '@/components/ui/simple-dropdown';
import { useUser } from '@/contexts/UserContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { base44 } from '@/api/base44Client';
import { getSupabaseAuth } from '@/services/supabaseClient';
import { clearGoogleAuthSession } from '@/services/googleAuthService';
import { disconnectGmail } from '@/services/gmailService';
import { createPageUrl } from '@/utils';

export default function ProfileDropdown() {
  try {
    const { profile, user, isLoading } = useUser();
    const { isTutorialMode, exitTutorial } = useTutorial();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    // Debug logging
    useEffect(() => {
      console.log('✅ ProfileDropdown rendered', { hasProfile: !!profile, hasUser: !!user, isLoading, profileEmail: profile?.email, userEmail: user?.email });
    }, [profile, user, isLoading]);

  const handleLogout = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      if (isTutorialMode) {
        exitTutorial();
      }
      
      queryClient.clear();
      
      try {
        const supabase = getSupabaseAuth();
        if (supabase) {
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.error('Error signing out from Supabase:', error);
      }
      
      try {
        clearGoogleAuthSession();
      } catch (error) {
        console.error('Error clearing Google auth:', error);
      }
      
      try {
        disconnectGmail();
      } catch (error) {
        console.error('Error disconnecting Gmail:', error);
      }
      
      try {
        if (base44.auth && base44.auth.logout) {
          base44.auth.logout();
        }
      } catch (error) {
        console.error('Error calling base44 logout:', error);
      }
      
      localStorage.clear();
      sessionStorage.clear();
      
      window.dispatchEvent(new Event('authStateChange'));
      
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error during logout:', error);
      localStorage.clear();
      sessionStorage.clear();
      navigate('/login', { replace: true });
    }
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || profile?.email || user?.email || 'User';
  const displayEmail = profile?.email || user?.email || '';
  const displayPhone = profile?.phone_number || '';
  const displayRole = profile?.role === 'system_admin' || profile?.role === 'admin' ? 'Admin' : 'User';

  // Always render the dropdown, even if user/profile is not available yet
  return (
    <SimpleDropdown
      trigger={
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
              <User className="w-4 h-4 text-slate-600" />
            </div>
            <span className="hidden lg:inline">{displayName}</span>
          </div>
          <ChevronDown className="w-3 h-3" />
        </button>
      }
      align="end"
    >
      <div className="py-2 min-w-[240px]">
        {/* Profile Info Section */}
        <div className="px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
              <User className="w-5 h-5 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 truncate">{displayName}</p>
              <p className="text-xs text-slate-500 truncate">{displayRole}</p>
            </div>
          </div>
          <div className="space-y-1.5 mt-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail className="w-3.5 h-3.5" />
              <span className="truncate">{displayEmail}</span>
            </div>
            {displayPhone && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="w-3.5 h-3.5" />
                <span>{displayPhone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Menu Items */}
        <div className="py-1">
          <SimpleDropdownItem
            onClick={() => {
              navigate(createPageUrl('Settings'));
            }}
            className="flex items-center gap-2 px-4 py-2"
          >
            <Settings className="w-4 h-4" />
            Settings
          </SimpleDropdownItem>
          <SimpleDropdownItem
            onClick={() => {
              navigate(createPageUrl('Reports'));
            }}
            className="flex items-center gap-2 px-4 py-2"
          >
            <FileText className="w-4 h-4" />
            Reports
          </SimpleDropdownItem>
          <div className="border-t border-slate-200 my-1" />
          <SimpleDropdownItem
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </SimpleDropdownItem>
        </div>
      </div>
    </SimpleDropdown>
  );
  } catch (error) {
    console.error('❌ ProfileDropdown error:', error);
    // Fallback: show a simple button that at least works
    return (
      <button
        onClick={async () => {
          try {
            const supabase = getSupabaseAuth();
            if (supabase) await supabase.auth.signOut();
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/login';
          } catch (e) {
            console.error('Logout error:', e);
            window.location.href = '/login';
          }
        }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        <User className="w-4 h-4" />
        <span className="hidden lg:inline">User</span>
        <ChevronDown className="w-3 h-3" />
      </button>
    );
  }
}

