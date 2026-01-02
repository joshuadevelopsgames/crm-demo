import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { useUser } from './UserContext';

const TestModeContext = createContext(null);

// Initialize global function synchronously based on localStorage
// This ensures it works even before React renders
function initializeGlobalGetCurrentYear() {
  try {
    const stored = localStorage.getItem('testMode2025');
    if (stored === 'true') {
      // Check if user is eligible (jrsschroeder@gmail.com)
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
  const { user } = useUser();
  
  // Check if user is eligible for test mode (jrsschroeder@gmail.com)
  const isEligibleForTestMode = useMemo(() => {
    return user?.email === 'jrsschroeder@gmail.com';
  }, [user?.email]);
  
  // Load test mode preference from localStorage (preserve setting even if user not loaded yet)
  // This ensures test mode stays on after page refresh
  const [isTestModeEnabled, setIsTestModeEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('testMode2025');
      return stored === 'true';
    } catch {
      return false;
    }
  });
  
  // If user loads and is not eligible, turn off test mode
  useEffect(() => {
    if (user && !isEligibleForTestMode && isTestModeEnabled) {
      console.log('[TestModeContext] User is not eligible, turning off test mode');
      setIsTestModeEnabled(false);
      try {
        localStorage.setItem('testMode2025', 'false');
      } catch (error) {
        console.error('Error saving test mode preference:', error);
      }
    }
  }, [user, isEligibleForTestMode, isTestModeEnabled]);
  
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
  
  // Toggle test mode
  const toggleTestMode = () => {
    if (!isEligibleForTestMode) return;
    const newValue = !isTestModeEnabled;
    setIsTestModeEnabled(newValue);
    try {
      localStorage.setItem('testMode2025', newValue.toString());
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
    } catch (error) {
      console.error('Error saving test mode preference:', error);
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
          className="fixed top-0 left-0 right-0 bg-amber-500 dark:bg-amber-600 text-white text-center font-semibold text-sm shadow-md flex items-center justify-center"
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
              className="ml-4 underline hover:no-underline opacity-90 hover:opacity-100 text-white"
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

