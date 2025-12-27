import React, { useState, useEffect } from 'react';
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

  // Ensure white background when in tutorial mode (but not on tutorial page)
  useEffect(() => {
    // #region agent log
    const logData = {location:'Layout.jsx:useEffect',message:'Layout useEffect - isTutorialMode state',data:{isTutorialMode,currentPageName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'};
    console.log('🔍 DEBUG Layout useEffect:', logData);
    fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData)}).catch(err=>console.error('Log fetch error:',err));
    // #endregion
    
    // Check for Tutorial page fixed div that might still be in DOM
    const tutorialFixedDivs = Array.from(document.querySelectorAll('div')).filter(div => {
      const style = div.getAttribute('style') || '';
      const computedStyle = window.getComputedStyle(div);
      return (style.includes('position: fixed') || computedStyle.position === 'fixed') &&
             (style.includes('top: 0') || computedStyle.top === '0px') &&
             (style.includes('left: 0') || computedStyle.left === '0px') &&
             computedStyle.zIndex !== 'auto' && parseInt(computedStyle.zIndex) <= 10;
    });
    
    if (tutorialFixedDivs.length > 0) {
      console.warn('⚠️ Found Tutorial page fixed divs still in DOM:', tutorialFixedDivs.map(d => ({
        className: d.className,
        style: d.getAttribute('style'),
        zIndex: window.getComputedStyle(d).zIndex,
        bg: window.getComputedStyle(d).backgroundColor
      })));
      // Remove them
      tutorialFixedDivs.forEach(div => {
        console.log('🗑️ Removing Tutorial fixed div');
        div.remove();
      });
    }
    
    // Force white background on body and html
    document.body.style.backgroundColor = '#ffffff';
    document.documentElement.style.backgroundColor = '#ffffff';
    const root = document.getElementById('root');
    if (root) {
      root.style.backgroundColor = '#ffffff';
    }
    
    // #region agent log
    const bodyBg = window.getComputedStyle(document.body).backgroundColor;
    const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
    const rootBg = root ? window.getComputedStyle(root).backgroundColor : 'no root';
    const logData2 = {location:'Layout.jsx:useEffect',message:'Computed background colors after setting white',data:{bodyBg,htmlBg,rootBg,tutorialFixedDivsRemoved:tutorialFixedDivs.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:['B','E']};
    console.log('🔍 DEBUG Layout backgrounds:', JSON.stringify(logData2, null, 2));
    fetch('http://127.0.0.1:7242/ingest/2cc4f12b-6a88-4e9e-a820-e2a749ce68ac',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logData2)}).catch(err=>console.error('Log fetch error:',err));
    // #endregion
  }, [isTutorialMode]);

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
    <div className="min-h-screen bg-white dark:bg-slate-950" style={{ 
      overscrollBehavior: 'none', 
      WebkitOverflowScrolling: 'touch',
    }}>
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
        className="bg-white dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-800 fixed left-0 right-0 z-50 shadow-sm" 
        style={(isPWA || isNativeApp) ? { 
          // PWA and native app specific styles (not desktop)
          top: isTutorialMode ? '3rem' : `max(0px, env(safe-area-inset-top, 0px))`,
          left: '0',
          right: '0',
          paddingTop: '0',
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
                <span className="text-xl md:text-2xl font-bold text-foreground">LECRM</span>
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
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-foreground/70 hover:bg-surface-2 hover:text-foreground hover:shadow-sm'
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
                        adminNavigation.some(item => currentPageName === item.path) || currentPageName === 'Tutorial'
                          ? 'bg-primary text-primary-foreground shadow-md'
                          : 'text-foreground/70 hover:bg-surface-2 hover:text-foreground hover:shadow-sm'
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
                    <SimpleDropdownItem
                      onClick={() => {
                        navigate('/tutorial');
                      }}
                      className={`flex items-center gap-2 px-3 py-2 ${
                        currentPageName === 'Tutorial' ? 'bg-slate-100 font-medium' : ''
                      }`}
                    >
                      <HelpCircle className="w-4 h-4" />
                      Tutorial
                    </SimpleDropdownItem>
                  </div>
                </SimpleDropdown>
              )}
              {!isAdmin && (
                <Link
                  to="/tutorial"
                  className="px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  title="Interactive Tutorial"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span className="hidden lg:inline">Tutorial</span>
                </Link>
              )}
              <NotificationBell />
              <ProfileDropdown />
            </div>

            {/* Mobile menu button - Better touch targets for PWA/mobile */}
            <div className="md:hidden flex items-center gap-1" style={(isPWA || isNativeApp) ? { gap: '4px' } : {}}>
              {!isAdmin && (
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
              )}
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
          <div className="md:hidden border-t border-slate-200 dark:border-border bg-white dark:bg-surface-1">
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
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground/70 hover:bg-surface-2'
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
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground/70 hover:bg-surface-2'
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
                  <Link
                    to="/tutorial"
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      currentPageName === 'Tutorial'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground/70 hover:bg-surface-2'
                    }`}
                    style={(isPWA || isNativeApp) ? {
                      minHeight: '48px',
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation'
                    } : {}}
                  >
                    <HelpCircle className="w-5 h-5" />
                    Tutorial
                  </Link>
                </>
              )}
              {!isAdmin && (
                <Link
                  to="/tutorial"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  <HelpCircle className="w-5 h-5" />
                  Tutorial
                </Link>
              )}
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
        className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 bg-white dark:bg-bg`} style={(isPWA || isNativeApp) ? {
        // PWA and native app specific padding (with safe areas)
        paddingTop: `calc(${isTutorialMode ? '7rem' : '4rem'} + env(safe-area-inset-top, 0px) + 1rem)`,
        paddingBottom: `calc(1.5rem + env(safe-area-inset-bottom, 0px))`,
        backgroundColor: 'hsl(var(--background))',
        minHeight: `calc(100vh - ${isTutorialMode ? '7rem' : '4rem'} - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))`
      } : {
        // Desktop web browser styles - standard padding
        paddingTop: isTutorialMode ? '7rem' : isDesktop ? '6rem' : '5rem',
        backgroundColor: 'hsl(var(--background))'
      }}>
        <div className="animate-in fade-in duration-300">
          {children}
        </div>
      </main>
    </div>
  );
}

