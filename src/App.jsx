import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TutorialProvider } from './contexts/TutorialContext';
import Layout from './components/Layout';
import TutorialBar from './components/TutorialBar';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import AccountDetail from './pages/AccountDetail';
import Contacts from './pages/Contacts';
import Tasks from './pages/Tasks';
import Sequences from './pages/Sequences';
import Scoring from './pages/Scoring';
import TakeScorecard from './pages/TakeScorecard';
import BuildScorecard from './pages/BuildScorecard';
import Tutorial from './pages/Tutorial';
import Login from './pages/Login';
import GmailCallback from './pages/GmailCallback';
import GoogleAuthCallback from './pages/GoogleAuthCallback';
import WinLossTest from './pages/WinLossTest';
import ErrorBoundary from './components/ErrorBoundary';
import InstallPrompt from './components/InstallPrompt';
import { createPageUrl } from './utils';

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Component to get current page name for Layout
function AppContent() {
  const location = useLocation();
  
  // Extract page name from path
  const getPageName = () => {
    const path = location.pathname;
    if (path === '/dashboard' || path === '/') return 'Dashboard';
    if (path === '/accounts') return 'Accounts';
    if (path === '/account-detail') return 'AccountDetail';
    if (path === '/contacts') return 'Contacts';
    if (path === '/tasks') return 'Tasks';
    if (path === '/sequences') return 'Sequences';
    if (path === '/scoring') return 'Scoring';
    if (path === '/take-scorecard') return 'TakeScorecard';
    if (path === '/build-scorecard') return 'BuildScorecard';
    if (path === '/tutorial') return null; // Tutorial doesn't use Layout
    if (path === '/login') return null; // Login doesn't use Layout
    if (path === '/gmail-callback') return null; // Gmail callback doesn't use Layout
    if (path === '/google-auth-callback') return null; // Google auth callback doesn't use Layout
    return 'Dashboard';
  };

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
              <Route path={createPageUrl('Accounts')} element={<Accounts />} />
              <Route path={createPageUrl('AccountDetail')} element={<AccountDetail />} />
              <Route path={createPageUrl('Contacts')} element={<Contacts />} />
              <Route path={createPageUrl('Tasks')} element={<Tasks />} />
              <Route path={createPageUrl('Sequences')} element={<Sequences />} />
              <Route path={createPageUrl('Scoring')} element={<Scoring />} />
              <Route path={createPageUrl('TakeScorecard')} element={<TakeScorecard />} />
              <Route path={createPageUrl('BuildScorecard')} element={<BuildScorecard />} />
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
        <TutorialProvider>
          <TutorialBar />
          <AppContent />
          <InstallPrompt />
        </TutorialProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;

