import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useUser } from './UserContext';

const TestModeContext = createContext(null);

// Global function to get current year (can be used outside React components)
let globalGetCurrentYear = () => new Date().getFullYear();

export function getCurrentYear() {
  return globalGetCurrentYear();
}

export function TestModeProvider({ children }) {
  const { user } = useUser();
  
  // Test mode is enabled for jrsschroeder@gmail.com
  const isTestMode = useMemo(() => {
    return user?.email === 'jrsschroeder@gmail.com';
  }, [user?.email]);
  
  // Test year is 2025
  const testYear = 2025;
  
  // Get the effective current year (test year if in test mode, otherwise actual year)
  const getCurrentYear = useMemo(() => {
    return () => {
      if (isTestMode) {
        return testYear;
      }
      return new Date().getFullYear();
    };
  }, [isTestMode]);
  
  // Update global function so it can be used in utility functions
  useEffect(() => {
    globalGetCurrentYear = getCurrentYear;
    // Also expose on window for easier access in non-React code
    if (typeof window !== 'undefined') {
      window.__testModeGetCurrentYear = getCurrentYear;
    }
    
    // Add padding to body when test mode is active to account for banner
    if (isTestMode) {
      document.body.style.paddingTop = '40px';
    } else {
      document.body.style.paddingTop = '';
    }
    
    return () => {
      // Cleanup: remove padding when component unmounts or test mode changes
      if (!isTestMode) {
        document.body.style.paddingTop = '';
      }
    };
  }, [getCurrentYear, isTestMode]);
  
  const value = useMemo(() => ({
    isTestMode,
    testYear,
    getCurrentYear
  }), [isTestMode, getCurrentYear]);
  
  return (
    <TestModeContext.Provider value={value}>
      {children}
      {isTestMode && (
        <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-center py-2 px-4 z-[99999] font-semibold text-sm">
          🧪 TEST MODE: Viewing site as if it's 2025
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
      getCurrentYear: () => new Date().getFullYear()
    };
  }
  return context;
}

