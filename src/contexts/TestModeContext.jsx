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

export function getCurrentYear() {
  return globalGetCurrentYear();
}

export function TestModeProvider({ children }) {
  const { user } = useUser();
  
  // Check if user is eligible for test mode (jrsschroeder@gmail.com)
  const isEligibleForTestMode = useMemo(() => {
    return user?.email === 'jrsschroeder@gmail.com';
  }, [user?.email]);
  
  // Load test mode preference from localStorage (only if eligible)
  const [isTestModeEnabled, setIsTestModeEnabled] = useState(() => {
    if (!isEligibleForTestMode) return false;
    try {
      const stored = localStorage.getItem('testMode2025');
      return stored === 'true';
    } catch {
      return false;
    }
  });
  
  // Test year is 2025
  const testYear = 2025;
  
  // Test mode is active if user is eligible AND has it enabled
  const isTestMode = isEligibleForTestMode && isTestModeEnabled;
  
  // Toggle test mode
  const toggleTestMode = () => {
    if (!isEligibleForTestMode) return;
    const newValue = !isTestModeEnabled;
    setIsTestModeEnabled(newValue);
    try {
      localStorage.setItem('testMode2025', newValue.toString());
    } catch (error) {
      console.error('Error saving test mode preference:', error);
    }
  };
  
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
  }, [getCurrentYear]);
  
  const value = useMemo(() => ({
    isTestMode,
    isEligibleForTestMode,
    testYear,
    getCurrentYear,
    toggleTestMode
  }), [isTestMode, isEligibleForTestMode, getCurrentYear]);
  
  return (
    <TestModeContext.Provider value={value}>
      {children}
      {isTestMode && (
        <div 
          className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-center font-semibold text-sm shadow-md flex items-center justify-center"
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
              className="ml-4 underline hover:no-underline opacity-90 hover:opacity-100"
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
      getCurrentYear: () => new Date().getFullYear()
    };
  }
  return context;
}

