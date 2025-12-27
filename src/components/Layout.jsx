import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '../utils';

import { 
  LayoutDashboard, 
  Users, 
  Building2,
  CheckSquare, 
  GitBranch, 
  Award,
  Shield,
  Menu,
  X,
  LogOut,
  HelpCircle,
  ChevronDown,
  Settings
} from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useTutorial } from '../contexts/TutorialContext';
import { useUser } from '../contexts/UserContext';
import NotificationBell from './NotificationBell';
import ProfileDropdown from './ProfileDropdown';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';
import { getSupabaseAuth } from '@/services/supabaseClient';
import { clearGoogleAuthSession } from '@/services/googleAuthService';
import { disconnectGmail } from '@/services/gmailService';
import { SimpleDropdown, SimpleDropdownItem } from '@/components/ui/simple-dropdown';

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isPWA, isMobile, isDesktop, isNativeApp } = useDeviceDetection();
  const { isTutorialMode, exitTutorial } = useTutorial();
  const { isAdmin } = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const regularNavigation = [
    { name: 'Dashboard', path: 'Dashboard', icon: LayoutDashboard },
    { name: 'Accounts', path: 'Accounts', icon: Building2 },
    { name: 'Contacts', path: 'Contacts', icon: Users },
    { name: 'Tasks', path: 'Tasks', icon: CheckSquare },
    { name: 'Sequences', path: 'Sequences', icon: GitBranch },
  ];

  const adminNavigation = [
    { name: 'Scoring', path: 'Scoring', icon: Award },
    { name: 'Permissions', path: 'Permissions', icon: Shield },
  ];

  // Combine regular navigation with admin items if user is admin
  const navigation = isAdmin 
    ? [...regularNavigation, ...adminNavigation]
    : regularNavigation;

  const handleLogout = async (e) => {
    // Prevent any default behavior
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      // Exit tutorial mode if active
      if (isTutorialMode) {
        exitTutorial();
      }
      
      // Clear React Query cache
      queryClient.clear();
      
      // Sign out from Supabase
      try {
        const supabase = getSupabaseAuth();
        if (supabase) {
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.error('Error signing out from Supabase:', error);
      }
      
      // Clear Google auth session
      try {
        clearGoogleAuthSession();
      } catch (error) {
        console.error('Error clearing Google auth:', error);
      }
      
      // Disconnect Gmail
      try {
        disconnectGmail();
      } catch (error) {
        console.error('Error disconnecting Gmail:', error);
      }
      
      // Call base44 logout (if it exists)
      try {
        if (base44.auth && base44.auth.logout) {
          base44.auth.logout();
        }
      } catch (error) {
        console.error('Error calling base44 logout:', error);
      }
      
      // Clear any stored auth data (fallback)
      localStorage.clear();
      sessionStorage.clear();
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new Event('authStateChange'));
      
      // Redirect to login page
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if there's an error, try to clear storage and redirect
      localStorage.clear();
      sessionStorage.clear();
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-white" style={{ overscrollBehavior: 'none', WebkitOverflowScrolling: 'touch' }}>
      <style>{`
        :root {
          --primary-navy: #0f172a;
          --primary-slate: #334155;
          --accent-emerald: #10b981;
          --accent-amber: #f59e0b;
          --accent-red: #ef4444;
        }
      `}</style>

      {/* Top Navigation - Apply mobile/PWA styles without affecting desktop */}
      <nav 
        className="bg-white border-b border-slate-200/50 fixed left-0 right-0 z-50 shadow-sm" 
        style={(isPWA || isNativeApp) ? { 
          // PWA and native app specific styles (not desktop)
          top: isTutorialMode ? '3rem' : `max(0px, env(safe-area-inset-top, 0px))`,
          left: '0',
          right: '0',
          paddingTop: '0',
          backgroundColor: '#ffffff',
          position: 'fixed',
          willChange: 'transform',
          transform: 'translate3d(0, 0, 0)',
          WebkitTransform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          marginTop: '0',
          marginBottom: '0',
          zIndex: '9999'
        } : {
          // Desktop web browser styles (unchanged)
          top: isTutorialMode ? '3rem' : '0',
          backgroundColor: '#ffffff'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link 
                to={createPageUrl('Dashboard')}
                className="flex-shrink-0 flex items-center gap-3 hover:opacity-80 transition-all cursor-pointer group"
              >
                <div className="relative">
                  <img 
                    src="/logo.png" 
                    alt="LECRM Logo" 
                    className="h-10 w-auto transition-transform group-hover:scale-105"
                    onError={(e) => {
                      console.error('Logo failed to load');
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
                <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">LECRM</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex md:items-center md:space-x-1">
              {regularNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.path;
                return (
                  <Link
                    key={item.name}
                    to={createPageUrl(item.path)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                      isActive
                        ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
                    {item.name}
                  </Link>
                );
              })}
              
              {/* Admin Dropdown */}
              {isAdmin && (
                <SimpleDropdown
                  trigger={
                    <button
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                        adminNavigation.some(item => currentPageName === item.path)
                          ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      Admin
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  }
                >
                  <div className="py-1 min-w-[160px]">
                    {adminNavigation.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentPageName === item.path;
                      return (
                        <SimpleDropdownItem
                          key={item.name}
                          onClick={() => {
                            navigate(createPageUrl(item.path));
                          }}
                          className={`flex items-center gap-2 px-3 py-2 ${
                            isActive ? 'bg-slate-100 font-medium' : ''
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {item.name}
                        </SimpleDropdownItem>
                      );
                    })}
                  </div>
                </SimpleDropdown>
              )}
              <Link
                to="/tutorial"
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                title="Interactive Tutorial"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden lg:inline">Tutorial</span>
              </Link>
              <NotificationBell />
              <ProfileDropdown />
            </div>

            {/* Mobile menu button - Better touch targets for PWA/mobile */}
            <div className="md:hidden flex items-center gap-1" style={(isPWA || isNativeApp) ? { gap: '4px' } : {}}>
              <Link
                to="/tutorial"
                className="text-slate-600 hover:text-slate-900"
                title="Tutorial"
                style={(isPWA || isNativeApp) ? {
                  padding: '10px',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation'
                } : {
                  padding: '8px'
                }}
              >
                <HelpCircle className="w-6 h-6" />
              </Link>
              <NotificationBell />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-slate-600 hover:text-slate-900"
                style={(isPWA || isNativeApp) ? {
                  padding: '10px',
                  minWidth: '44px',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer'
                } : {
                  padding: '8px'
                }}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="px-4 py-3 space-y-1">
              {regularNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.path;
                return (
                  <Link
                    key={item.name}
                    to={createPageUrl(item.path)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-slate-900 dark:bg-slate-800 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    style={(isPWA || isNativeApp) ? {
                      minHeight: '48px',
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation'
                    } : {}}
                  >
                    <Icon className="w-5 h-5" />
                    {item.name}
                  </Link>
                );
              })}
              
              {/* Admin Section in Mobile */}
              {isAdmin && (
                <>
                  <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Admin
                  </div>
                  {adminNavigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPageName === item.path;
                    return (
                      <Link
                        key={item.name}
                        to={createPageUrl(item.path)}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                        style={(isPWA || isNativeApp) ? {
                          minHeight: '48px',
                          WebkitTapHighlightColor: 'transparent',
                          touchAction: 'manipulation'
                        } : {}}
                      >
                        <Icon className="w-5 h-5" />
                        {item.name}
                      </Link>
                    );
                  })}
                </>
              )}
              <Link
                to="/tutorial"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                <HelpCircle className="w-5 h-5" />
                Tutorial
              </Link>
              <div className="px-4 py-2">
                <ProfileDropdown />
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content - Responsive padding: different for PWA/mobile vs desktop */}
      <main 
        ref={(el) => {
          if (el && isTutorialMode) {
            // #region agent log
            const mainBg = window.getComputedStyle(el).backgroundColor;
            const mainDisplay = window.getComputedStyle(el).display;
            const mainVisibility = window.getComputedStyle(el).visibility;
            const mainZIndex = window.getComputedStyle(el).zIndex;
            const mainRect = el.getBoundingClientRect();
            // Check for backdrop/overlay elements
            const allElements = document.querySelectorAll('*');
            const backdropElements = Array.from(allElements).filter(el => {
              const style = window.getComputedStyle(el);
              const bg = style.backgroundColor;
              const pos = style.position;
              const zIdx = parseInt(style.zIndex) || 0;
              return (bg.includes('rgb(37, 99, 235)') || bg.includes('rgb(79, 70, 229)')) && 
                     (pos === 'fixed' || pos === 'absolute') && zIdx > 50;
            });
            // Check body/html/root backgrounds
            const bodyBg = window.getComputedStyle(document.body).backgroundColor;
            const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
            const rootBg = document.getElementById('root') ? window.getComputedStyle(document.getElementById('root')).backgroundColor : 'no root';
            // Check for any fixed/absolute elements covering the page
            const allFixed = Array.from(document.querySelectorAll('*')).filter(el => {
              const style = window.getComputedStyle(el);
              return (style.position === 'fixed' || style.position === 'absolute') && 
                     parseInt(style.zIndex) > 50;
            }).map(el => ({
              tag: el.tagName,
              className: el.className,
              position: window.getComputedStyle(el).position,
              zIndex: window.getComputedStyle(el).zIndex,
              bg: window.getComputedStyle(el).backgroundColor,
              rect: el.getBoundingClientRect()
            }));
            const logData3 = {location:'Layout.jsx:main-ref',message:'Main content element styles and position',data:{mainBg,mainDisplay,mainVisibility,mainZIndex,mainRect:{top:mainRect.top,left:mainRect.left,width:mainRect.width,height:mainRect.height},backdropCount:backdropElements.length,bodyBg,htmlBg,rootBg,allFixedCount:allFixed.length,allFixed:allFixed.slice(0, 5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:['D','E','B']};
            console.log('🔍 DEBUG Layout main:', JSON.stringify(logData3, null, 2));
            fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData3)}).catch(err=>console.error('Log fetch error:',err));
            // #endregion
          }
        }}
        className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 bg-white dark:bg-slate-950`} style={(isPWA || isNativeApp) ? {
        // PWA and native app specific padding (with safe areas)
        paddingTop: `calc(${isTutorialMode ? '7rem' : '4rem'} + env(safe-area-inset-top, 0px) + 1rem)`,
        paddingBottom: `calc(1.5rem + env(safe-area-inset-bottom, 0px))`,
        backgroundColor: '#ffffff',
        minHeight: `calc(100vh - ${isTutorialMode ? '7rem' : '4rem'} - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`
      } : {
        // Desktop web browser styles - standard padding
        paddingTop: isTutorialMode ? '7rem' : isDesktop ? '6rem' : '5rem',
        backgroundColor: '#ffffff'
      }}>
        <div className="animate-in fade-in duration-300">
          {children}
        </div>
      </main>
    </div>
  );
}

