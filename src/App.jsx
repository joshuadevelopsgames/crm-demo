import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { TutorialProvider } from './contexts/TutorialContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { TestModeProvider } from './contexts/TestModeContext';
import { useUserPermissions } from './hooks/useUserPermissions';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import TutorialBar from './components/TutorialBar';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import AccountDetail from './pages/AccountDetail';
import ContactDetail from './pages/ContactDetail';
import Contacts from './pages/Contacts';
import NeglectedAccounts from './pages/NeglectedAccounts';
import Tasks from './pages/Tasks';
import Sequences from './pages/Sequences';
import Scoring from './pages/Scoring';
import TakeScorecard from './pages/TakeScorecard';
import BuildScorecard from './pages/BuildScorecard';
import Permissions from './pages/Permissions';
import Announcements from './pages/Announcements';
import Tutorial from './pages/Tutorial';
import Login from './pages/Login';
import GmailCallback from './pages/GmailCallback';
import GoogleAuthCallback from './pages/GoogleAuthCallback';
import WinLossTest from './pages/WinLossTest';
import ListDivisions from './pages/ListDivisions';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import TestRenewalNotifications from './pages/TestRenewalNotifications';
import ErrorBoundary from './components/ErrorBoundary';
import InstallPrompt from './components/InstallPrompt';
import BugReportButton from './components/BugReportButton';
import { createPageUrl } from './utils';
import { getSupabaseAuth } from './services/supabaseClient';

// Create a query client with better defaults to prevent data disappearing
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent refetch on focus that can cause data to disappear
      retry: 1,
      staleTime: 5 * 60 * 1000, // Default: cache for 5 minutes
      gcTime: 10 * 60 * 1000, // Default: keep in cache for 10 minutes (formerly cacheTime)
      placeholderData: (previousData) => previousData, // Keep previous data while refetching
    },
  },
});

// Component to protect admin routes
function AdminRoute({ children, requiredPermission }) {
  const { isAdmin, isLoading, profile } = useUser();
  const { permissions: userPermissions, isLoading: permsLoading } = useUserPermissions();
  
  // Wait for user and profile to load before checking permissions
  // If profile isn't loaded yet, permissions will be empty and cause false redirects
  if (isLoading || permsLoading || !profile?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  // If no specific permission required, just check if admin
  if (!requiredPermission) {
    if (!isAdmin) {
      return <Navigate to="/dashboard" replace />;
    }
    return children;
  }
  
  // Check specific permission
  // Only redirect if permissions object exists and the permission is explicitly false
  // (undefined means still loading or default true, so allow access)
  if (userPermissions && userPermissions[requiredPermission] === false) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

// Component to get current page name for Layout and handle auth
function AppContent() {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = checking, true/false = result
  const [isLoading, setIsLoading] = useState(true);
  
  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/google-auth-callback', '/gmail-callback'];
  const isPublicRoute = publicRoutes.includes(location.pathname);
  
  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = getSupabaseAuth();
      
      if (!supabase) {
        // Fallback: check localStorage for demo mode
        const isAuth = localStorage.getItem('isAuthenticated') === 'true';
        setIsAuthenticated(isAuth);
        setIsLoading(false);
        return;
      }

      try {
        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth check error:', error);
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(!!session);
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }

      // Listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(!!session);
      });

      return () => {
        subscription.unsubscribe();
      };
    };

    checkAuth();

    // Listen for localStorage changes (for demo mode)
    const handleStorageChange = (e) => {
      if (e.key === 'isAuthenticated') {
        const isAuth = localStorage.getItem('isAuthenticated') === 'true';
        setIsAuthenticated(isAuth);
      }
    };

    // Listen for storage events (from other tabs/windows)
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event (from same window)
    const handleCustomStorageChange = () => {
      const isAuth = localStorage.getItem('isAuthenticated') === 'true';
      setIsAuthenticated(isAuth);
    };
    window.addEventListener('authStateChange', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authStateChange', handleCustomStorageChange);
    };
  }, []);
  
  // Extract page name from path
  const getPageName = () => {
    const path = location.pathname;
    if (path === '/dashboard' || path === '/') return 'Dashboard';
    if (path === '/accounts') return 'Accounts';
    if (path === '/account-detail') return 'AccountDetail';
    if (path === '/contact-detail') return 'ContactDetail';
    if (path === '/contacts') return 'Contacts';
    if (path === '/neglected-accounts') return 'NeglectedAccounts';
    if (path === '/tasks') return 'Tasks';
    if (path === '/sequences') return 'Sequences';
    if (path === '/scoring') return 'Scoring';
    if (path === '/take-scorecard') return 'TakeScorecard';
    if (path === '/build-scorecard') return 'BuildScorecard';
    if (path === '/permissions') return 'Permissions';
    if (path === '/announcements') return 'Announcements';
    if (path === '/tutorial') return null; // Tutorial doesn't use Layout
    if (path === '/login') return null; // Login doesn't use Layout
    if (path === '/gmail-callback') return null; // Gmail callback doesn't use Layout
    if (path === '/google-auth-callback') return null; // Google auth callback doesn't use Layout
    if (path === '/list-divisions') return 'ListDivisions';
    if (path === '/test-renewal-notifications') return 'TestRenewalNotifications';
    return 'Dashboard';
  };

  // Show loading state while checking auth
  if (isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated and trying to access protected route
  if (!isAuthenticated && !isPublicRoute) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to dashboard if authenticated and on login page
  if (isAuthenticated && location.pathname === '/login') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/tutorial" element={<Tutorial />} />
        <Route path="/login" element={<Login />} />
        <Route path="/gmail-callback" element={<GmailCallback />} />
        <Route path="/google-auth-callback" element={<GoogleAuthCallback />} />
        <Route path="/win-loss-test" element={<WinLossTest />} />
        <Route path="*" element={
          <Layout currentPageName={getPageName()}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path={createPageUrl('Dashboard')} element={<Dashboard />} />
              <Route path={createPageUrl('Accounts')} element={
                <AdminRoute requiredPermission="view_all_accounts">
                  <Accounts />
                </AdminRoute>
              } />
              <Route path={createPageUrl('AccountDetail')} element={
                <AdminRoute requiredPermission="view_all_accounts">
                  <AccountDetail />
                </AdminRoute>
              } />
              <Route path={createPageUrl('ContactDetail')} element={
                <AdminRoute requiredPermission="view_all_contacts">
                  <ContactDetail />
                </AdminRoute>
              } />
              <Route path={createPageUrl('Contacts')} element={
                <AdminRoute requiredPermission="view_all_contacts">
                  <Contacts />
                </AdminRoute>
              } />
              <Route path={createPageUrl('NeglectedAccounts')} element={<NeglectedAccounts />} />
              <Route path={createPageUrl('Tasks')} element={<Tasks />} />
              <Route path={createPageUrl('Sequences')} element={<Sequences />} />
              <Route path={createPageUrl('Scoring')} element={
                <AdminRoute requiredPermission="access_scoring">
                  <Scoring />
                </AdminRoute>
              } />
              <Route path={createPageUrl('TakeScorecard')} element={<TakeScorecard />} />
              <Route path={createPageUrl('BuildScorecard')} element={<BuildScorecard />} />
              <Route path={createPageUrl('Permissions')} element={
                <AdminRoute requiredPermission="manage_permissions">
                  <Permissions />
                </AdminRoute>
              } />
              <Route path={createPageUrl('Announcements')} element={
                <AdminRoute>
                  <Announcements />
                </AdminRoute>
              } />
              <Route path={createPageUrl('Settings')} element={<Settings />} />
              <Route path={createPageUrl('Reports')} element={<Reports />} />
              <Route path="/test-renewal-notifications" element={<TestRenewalNotifications />} />
              <Route path="/list-divisions" element={<ListDivisions />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </Layout>
        } />
      </Routes>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <UserProvider>
          <ThemeProvider>
            <TestModeProvider>
              <TutorialProvider>
              <div style={{ minHeight: '100vh' }} className="bg-white dark:bg-slate-950">
                <Toaster 
                  position="top-center" 
                  toastOptions={{
                    duration: 3000,
                    success: {
                      duration: 3000,
                    },
                    error: {
                      duration: 4000,
                    },
                  }}
                />
                <TutorialBar />
                <AppContent />
                <InstallPrompt />
                <BugReportButton />
              </div>
              </TutorialProvider>
            </TestModeProvider>
          </ThemeProvider>
        </UserProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;

// Force deployment from main branch
