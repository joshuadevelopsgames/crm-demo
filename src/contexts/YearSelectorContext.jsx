import React, { createContext, useContext, useMemo, useEffect, useState, useRef } from 'react';
import { useUser } from './UserContext';
import { getSupabaseAuth } from '@/services/supabaseClient';

const YearSelectorContext = createContext(null);

// Initialize global function synchronously based on localStorage
function initializeGlobalGetCurrentYear() {
  try {
    const stored = localStorage.getItem('selectedYear');
    if (stored) {
      const year = parseInt(stored, 10);
      if (!isNaN(year) && year >= 2020 && year <= 2100) {
        return () => year;
      }
    }
  } catch (error) {
    // localStorage not available or error
  }
  return () => new Date().getFullYear();
}

// Global function to get current year (can be used outside React components)
let globalGetCurrentYear = initializeGlobalGetCurrentYear();

// Initialize global function to get current date (respects year selector)
function initializeGlobalGetCurrentDate() {
  try {
    const stored = localStorage.getItem('selectedYear');
    if (stored) {
      const year = parseInt(stored, 10);
      if (!isNaN(year) && year >= 2020 && year <= 2100) {
        return () => {
          const now = new Date();
          return new Date(year, now.getMonth(), now.getDate());
        };
      }
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
  return year;
}

export function getCurrentDate() {
  const date = globalGetCurrentDate();
  return date;
}

export function YearSelectorProvider({ children }) {
  const { user, profile } = useUser();
  const supabase = getSupabaseAuth();
  const isLoadingFromServer = useRef(false);
  
  // Load selected year from profile first, then localStorage as fallback
  const [selectedYear, setSelectedYear] = useState(() => {
    // Try profile first
    if (profile?.selected_year) {
      return profile.selected_year;
    }
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem('selectedYear');
      if (stored) {
        const year = parseInt(stored, 10);
        if (!isNaN(year) && year >= 2020 && year <= 2100) {
          return year;
        }
      }
    } catch {
      // localStorage not available
    }
    // Default to current year
    return new Date().getFullYear();
  });

  // Load preference from profile when it becomes available
  useEffect(() => {
    if (profile?.id && supabase) {
      // Profile has selected_year preference
      if (profile.selected_year !== null && profile.selected_year !== undefined) {
        const serverPreference = profile.selected_year;
        isLoadingFromServer.current = true;
        setSelectedYear(serverPreference);
        // Sync localStorage as fallback
        localStorage.setItem('selectedYear', serverPreference.toString());
        // Reset flag after a short delay
        setTimeout(() => {
          isLoadingFromServer.current = false;
        }, 100);
      }
    }
  }, [profile?.id, profile?.selected_year, supabase]);
  
  // Get the effective current year (selected year or actual year)
  const getCurrentYear = useMemo(() => {
    return () => {
      return selectedYear;
    };
  }, [selectedYear]);

  // Get the effective current date (selected year date or actual date)
  const getCurrentDate = useMemo(() => {
    return () => {
      const now = new Date();
      return new Date(selectedYear, now.getMonth(), now.getDate());
    };
  }, [selectedYear]);

  // Update global function immediately when selectedYear changes
  useEffect(() => {
    // Update global function whenever year selection changes
    globalGetCurrentYear = getCurrentYear;
    globalGetCurrentDate = getCurrentDate;
    // Also expose on window for easier access in non-React code
    if (typeof window !== 'undefined') {
      window.__getCurrentYear = getCurrentYear;
      window.__getCurrentDate = getCurrentDate;
    }
    // Force a re-render of components that depend on this
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('yearSelectionChanged', { detail: { selectedYear } }));
    }
  }, [getCurrentYear, getCurrentDate, selectedYear]);

  // Save year selection to server (but not when loading from server)
  useEffect(() => {
    if (isLoadingFromServer.current) return; // Don't save if we're loading from server
    
    if (profile?.id && supabase) {
      // Save to server
      supabase
        .from('profiles')
        .update({ selected_year: selectedYear })
        .eq('id', profile.id)
        .then(({ error }) => {
          if (error) {
            console.error('Error saving year selection to server:', error);
          }
        });
    }
    
    // Also save to localStorage as fallback
    try {
      localStorage.setItem('selectedYear', selectedYear.toString());
    } catch (error) {
      console.error('Error saving year selection to localStorage:', error);
    }
  }, [selectedYear, profile?.id, supabase]);

  // Change selected year
  const setYear = (year) => {
    if (year >= 2020 && year <= 2100) {
      setSelectedYear(year);
      
      // Update global function immediately
      const updatedGetCurrentYear = () => year;
      const updatedGetCurrentDate = () => {
        const now = new Date();
        return new Date(year, now.getMonth(), now.getDate());
      };
      globalGetCurrentYear = updatedGetCurrentYear;
      globalGetCurrentDate = updatedGetCurrentDate;
      if (typeof window !== 'undefined') {
        window.__getCurrentYear = updatedGetCurrentYear;
        window.__getCurrentDate = updatedGetCurrentDate;
      }
    }
  };
  
  const value = useMemo(() => ({
    selectedYear,
    setYear,
    getCurrentYear,
    getCurrentDate
  }), [selectedYear, getCurrentYear, getCurrentDate]);
  
  return (
    <YearSelectorContext.Provider value={value}>
      {children}
    </YearSelectorContext.Provider>
  );
}

export function useYearSelector() {
  const context = useContext(YearSelectorContext);
  if (!context) {
    // Return default values if context is not available
    return {
      selectedYear: new Date().getFullYear(),
      setYear: () => {},
      getCurrentYear: () => new Date().getFullYear(),
      getCurrentDate: () => new Date()
    };
  }
  return context;
}

