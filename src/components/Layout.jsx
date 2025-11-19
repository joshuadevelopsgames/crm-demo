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

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <style>{`
        :root {
          --primary-navy: #0f172a;
          --primary-slate: #334155;
          --accent-emerald: #10b981;
          --accent-amber: #f59e0b;
          --accent-red: #ef4444;
        }
      `}</style>

      {/* Top Navigation */}
      <nav className={`bg-white/80 backdrop-blur-lg border-b border-slate-200/50 sticky z-50 shadow-sm ${isTutorialMode ? 'top-12' : 'top-0'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 md:h-20">
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

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center gap-2">
              <Link
                to="/tutorial"
                className="text-slate-600 hover:text-slate-900 p-2"
                title="Tutorial"
              >
                <HelpCircle className="w-6 h-6" />
              </Link>
              <NotificationBell />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-slate-600 hover:text-slate-900 p-2"
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
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8`}>
        <div className="animate-in fade-in duration-300">
          {children}
        </div>
      </main>
    </div>
  );
}

