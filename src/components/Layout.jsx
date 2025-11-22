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
  Menu,
  X,
  LogOut,
  HelpCircle
} from 'lucide-react';

import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useTutorial } from '../contexts/TutorialContext';
import NotificationBell from './NotificationBell';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isPWA, isMobile, isDesktop, isNativeApp } = useDeviceDetection();
  const { isTutorialMode, exitTutorial } = useTutorial();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const navigation = [
    { name: 'Dashboard', path: 'Dashboard', icon: LayoutDashboard },
    { name: 'Accounts', path: 'Accounts', icon: Building2 },
    { name: 'Contacts', path: 'Contacts', icon: Users },
    { name: 'Tasks', path: 'Tasks', icon: CheckSquare },
    { name: 'Sequences', path: 'Sequences', icon: GitBranch },
    { name: 'Scoring', path: 'Scoring', icon: Award },
  ];

  const handleLogout = () => {
    // Exit tutorial mode if active
    if (isTutorialMode) {
      exitTutorial();
    }
    
    // Clear React Query cache
    queryClient.clear();
    
    // Clear any stored auth data
    localStorage.clear();
    sessionStorage.clear();
    
    // Call base44 logout
    base44.auth.logout();
    
    // Redirect to login page
    navigate('/login');
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
              {navigation.map((item) => {
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
              <Link
                to="/tutorial"
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                title="Interactive Tutorial"
              >
                <HelpCircle className="w-4 h-4" />
                <span className="hidden lg:inline">Tutorial</span>
              </Link>
              <NotificationBell />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="ml-2 text-slate-600 hover:text-slate-900"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
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
          <div className="md:hidden border-t border-slate-200 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navigation.map((item) => {
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
              <Link
                to="/tutorial"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                <HelpCircle className="w-5 h-5" />
                Tutorial
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 w-full"
                style={(isPWA || isNativeApp) ? {
                  minHeight: '48px',
                  WebkitTapHighlightColor: 'transparent',
                  touchAction: 'manipulation',
                  textAlign: 'left'
                } : {}}
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content - Responsive padding: different for PWA/mobile vs desktop */}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8`} style={(isPWA || isNativeApp) ? { 
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

