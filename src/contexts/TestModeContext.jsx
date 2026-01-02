import React, { createContext, useContext, useMemo, useEffect, useState, useRef } from 'react';
import { useUser } from './UserContext';
import { getSupabaseAuth } from '@/services/supabaseClient';

const TestModeContext = createContext(null);

// Initialize global function synchronously based on localStorage
// This ensures it works even before React renders
function initializeGlobalGetCurrentYear() {
  try {
    const stored = localStorage.getItem('testMode2025');
    if (stored === 'true') {
      // Check if user is eligible (jrsschroeder@gmail.com, jon@lecm.ca, blake@lecm.ca)
      // Note: We can't check user email here since UserContext isn't available yet
      // So we'll check it in the provider and update accordingly
      return () => 2025; // Test mode year
    }
  } catch (error) {
    // localStorage not available or error
  }
  return () => new Date().getFullYear();
}

// Global function to get current year (can be used outside React components)
let globalGetCurrentYear = initializeGlobalGetCurrentYear();

// Initialize global function to get current date (respects test mode)
function initializeGlobalGetCurrentDate() {
  try {
    const stored = localStorage.getItem('testMode2025');
    if (stored === 'true') {
      // Return a date in 2025 (use current month/day but in 2025 for realistic testing)
      return () => {
        const now = new Date();
        return new Date(2025, now.getMonth(), now.getDate());
      };
    }
  } catch (error) {
    // localStorage not available or error
  }
  return () => new Date();
}

// Global function to get current date (can be used outside React components)
let globalGetCurrentDate = initializeGlobalGetCurrentDate();

export function getCurrentYear() {
  const year = globalGetCurrentYear();
  // Debug: Log when test mode is active
  if (typeof window !== 'undefined' && window.__testModeGetCurrentYear) {
    console.log('[getCurrentYear] Called, returning:', year, 'globalGetCurrentYear === window.__testModeGetCurrentYear:', globalGetCurrentYear === window.__testModeGetCurrentYear);
  }
  return year;
}

export function getCurrentDate() {
  const date = globalGetCurrentDate();
  return date;
}

export function TestModeProvider({ children }) {
  const { user, profile } = useUser();
  const supabase = getSupabaseAuth();
  
  // Check if user is eligible for test mode
  const isEligibleForTestMode = useMemo(() => {
    const eligibleEmails = [
      'jrsschroeder@gmail.com',
      'jon@lecm.ca',
      'blake@lecm.ca'
    ];
    return eligibleEmails.includes(user?.email);
  }, [user?.email]);
  
  // Load test mode preference from localStorage first (for initial load before profile is fetched)
  // Then sync with server preference when profile loads
  const [isTestModeEnabled, setIsTestModeEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('testMode2025');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Load preference from profile when it becomes available
  useEffect(() => {
    if (profile?.id && supabase) {
      // Profile has test_mode_enabled preference
      if (profile.test_mode_enabled !== null && profile.test_mode_enabled !== undefined) {
        const serverPreference = profile.test_mode_enabled;
        isLoadingFromServer.current = true;
        setIsTestModeEnabled(serverPreference);
        // Sync localStorage as fallback
        localStorage.setItem('testMode2025', serverPreference.toString());
        // Reset flag after a short delay
        setTimeout(() => {
          isLoadingFromServer.current = false;
        }, 100);
      }
    }
  }, [profile?.id, profile?.test_mode_enabled, supabase]); // Only run when profile or test_mode_enabled changes
  
  // If user loads and is not eligible, turn off test mode
  useEffect(() => {
    if (user && !isEligibleForTestMode && isTestModeEnabled) {
      console.log('[TestModeContext] User is not eligible, turning off test mode');
      setIsTestModeEnabled(false);
      // Save to server if profile exists
      if (profile?.id && supabase) {
        supabase
          .from('profiles')
          .update({ test_mode_enabled: false })
          .eq('id', profile.id)
          .then(({ error }) => {
            if (error) {
              console.error('Error saving test mode preference to server:', error);
            }
          });
      }
      // Also save to localStorage as fallback
      try {
        localStorage.setItem('testMode2025', 'false');
      } catch (error) {
        console.error('Error saving test mode preference:', error);
      }
    }
  }, [user, isEligibleForTestMode, isTestModeEnabled, profile?.id, supabase]);
  
  // Test year is 2025
  const testYear = 2025;
  
  // Test mode is active if user is eligible AND has it enabled
  const isTestMode = isEligibleForTestMode && isTestModeEnabled;
  
  // Get the effective current year (test year if in test mode, otherwise actual year)
  const getCurrentYear = useMemo(() => {
    return () => {
      if (isTestMode) {
        return testYear;
      }
      return new Date().getFullYear();
    };
  }, [isTestMode]);
  
  // Get the effective current date (test date if in test mode, otherwise actual date)
  const getCurrentDate = useMemo(() => {
    return () => {
      if (isTestMode) {
        // Use current month/day but in test year (2025) for realistic testing
        const now = new Date();
        return new Date(testYear, now.getMonth(), now.getDate());
      }
      return new Date();
    };
  }, [isTestMode, testYear]);
  
  // Update global function immediately when getCurrentYear changes or user loads
  useEffect(() => {
    // Update global function whenever test mode state changes
    globalGetCurrentYear = getCurrentYear;
    globalGetCurrentDate = getCurrentDate;
    // Also expose on window for easier access in non-React code
    if (typeof window !== 'undefined') {
      window.__testModeGetCurrentYear = getCurrentYear;
      window.__testModeGetCurrentDate = getCurrentDate;
      // Debug: Log when test mode state changes
      console.log('[TestModeContext] Updated global function:', {
        isTestMode,
        isEligibleForTestMode,
        isTestModeEnabled,
        testYear,
        currentYear: getCurrentYear(),
        currentDate: getCurrentDate().toISOString(),
        userEmail: user?.email
      });
    }
    // Force a re-render of components that depend on this
    // This ensures revenue calculations update when test mode changes
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('testModeChanged', { detail: { isTestMode } }));
    }
  }, [getCurrentYear, getCurrentDate, isTestMode, isEligibleForTestMode, isTestModeEnabled, user?.email]);
  
  // Save test mode preference to server (but not when loading from server)
  useEffect(() => {
    if (isLoadingFromServer.current) return; // Don't save if we're loading from server
    
    if (profile?.id && supabase && isEligibleForTestMode) {
      // Save to server
      supabase
        .from('profiles')
        .update({ test_mode_enabled: isTestModeEnabled })
        .eq('id', profile.id)
        .then(({ error }) => {
          if (error) {
            console.error('Error saving test mode preference to server:', error);
          }
        });
    }
    
    // Also save to localStorage as fallback
    try {
      localStorage.setItem('testMode2025', isTestModeEnabled.toString());
    } catch (error) {
      console.error('Error saving test mode preference to localStorage:', error);
    }
  }, [isTestModeEnabled, profile?.id, supabase, isEligibleForTestMode]);

  // Toggle test mode
  const toggleTestMode = () => {
    if (!isEligibleForTestMode) return;
    const newValue = !isTestModeEnabled;
    setIsTestModeEnabled(newValue);
    
    // Update global function immediately when toggling
    const updatedIsTestMode = isEligibleForTestMode && newValue;
    const updatedGetCurrentYear = () => {
      if (updatedIsTestMode) {
        return testYear;
      }
      return new Date().getFullYear();
    };
    const updatedGetCurrentDate = () => {
      if (updatedIsTestMode) {
        const now = new Date();
        return new Date(testYear, now.getMonth(), now.getDate());
      }
      return new Date();
    };
    globalGetCurrentYear = updatedGetCurrentYear;
    globalGetCurrentDate = updatedGetCurrentDate;
    if (typeof window !== 'undefined') {
      window.__testModeGetCurrentYear = updatedGetCurrentYear;
      window.__testModeGetCurrentDate = updatedGetCurrentDate;
    }
  };
  
  const value = useMemo(() =>({
    isTestMode,
    isEligibleForTestMode,
    testYear,
    getCurrentYear,
    getCurrentDate,
    toggleTestMode
  }), [isTestMode, isEligibleForTestMode, getCurrentYear, getCurrentDate]);
  
  return (
    <TestModeContext.Provider value={value}>
      {children}
      {isTestMode && (
        <div 
          className="fixed top-0 left-0 right-0 bg-white dark:bg-amber-600 border-b border-slate-200 dark:border-amber-700 text-slate-900 dark:text-white text-center font-semibold text-sm shadow-md flex items-center justify-center"
          style={{ 
            height: '40px',
            minHeight: '40px',
            maxHeight: '40px',
            zIndex: 100,
            padding: '8px 16px',
            pointerEvents: 'auto'
          }}
        >
          <span>🧪 TEST MODE: Viewing site as if it's 2025</span>
          {isEligibleForTestMode && (
            <button
              onClick={toggleTestMode}
              className="ml-4 underline hover:no-underline opacity-90 hover:opacity-100 text-slate-900 dark:text-white"
              type="button"
            >
              Disable
            </button>
          )}
        </div>
      )}
    </TestModeContext.Provider>
  );
}

export function useTestMode() {
  const context = useContext(TestModeContext);
  if (!context) {
    // Return default values if context is not available
    return {
      isTestMode: false,
      testYear: new Date().getFullYear(),
      getCurrentYear: () => new Date().getFullYear(),
      getCurrentDate: () => new Date()
    };
  }
  return context;
}

