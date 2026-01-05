import React, { createContext, useContext, useMemo, useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  
  // Fetch estimates to determine year range
  const { data: estimates = [] } = useQuery({
    queryKey: ['estimates', 'year-range'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/data/estimates');
        if (!response.ok) return [];
        const result = await response.json();
        return result.success ? (result.data || []) : [];
      } catch (error) {
        console.error('Error fetching estimates for year range:', error);
        return [];
      }
    },
    enabled: !!user, // Only fetch when user is logged in
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
  
  // Calculate year range from estimates (earliest to latest)
  const yearRange = useMemo(() => {
    if (!estimates || estimates.length === 0) {
      // Default range if no estimates
      const currentYear = new Date().getFullYear();
      return { min: currentYear, max: currentYear };
    }
    
    const years = new Set();
    
    estimates.forEach(est => {
      // Per spec R2: Year determination priority
      let year = null;
      
      // Priority 1: estimate_close_date
      if (est.estimate_close_date) {
        const date = new Date(est.estimate_close_date);
        if (!isNaN(date.getTime())) {
          year = date.getFullYear();
        }
      }
      
      // Priority 2: contract_start
      if (!year && est.contract_start) {
        const date = new Date(est.contract_start);
        if (!isNaN(date.getTime())) {
          year = date.getFullYear();
        }
      }
      
      // Priority 3: estimate_date
      if (!year && est.estimate_date) {
        const date = new Date(est.estimate_date);
        if (!isNaN(date.getTime())) {
          year = date.getFullYear();
        }
      }
      
      // Priority 4: created_date
      if (!year && est.created_date) {
        const date = new Date(est.created_date);
        if (!isNaN(date.getTime())) {
          year = date.getFullYear();
        }
      }
      
      if (year) {
        years.add(year);
      }
      
      // Also include contract_end for projected dates (latest date)
      if (est.contract_end) {
        const date = new Date(est.contract_end);
        if (!isNaN(date.getTime())) {
          years.add(date.getFullYear());
        }
      }
    });
    
    if (years.size === 0) {
      // Fallback if no valid dates found
      const currentYear = new Date().getFullYear();
      return { min: currentYear, max: currentYear };
    }
    
    const yearArray = Array.from(years).sort((a, b) => a - b);
    return {
      min: yearArray[0],
      max: yearArray[yearArray.length - 1]
    };
  }, [estimates]);
  
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
  
  // Ensure selected year is within valid range
  useEffect(() => {
    if (yearRange.min && yearRange.max && selectedYear) {
      if (selectedYear < yearRange.min || selectedYear > yearRange.max) {
        // Selected year is outside range, adjust to closest valid year
        const adjustedYear = selectedYear < yearRange.min ? yearRange.min : yearRange.max;
        setSelectedYear(adjustedYear);
      }
    }
  }, [yearRange, selectedYear]);

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
  
  // Generate year options from dataset range
  const yearOptions = useMemo(() => {
    const options = [];
    if (yearRange.min && yearRange.max) {
      for (let year = yearRange.min; year <= yearRange.max; year++) {
        options.push(year);
      }
    } else {
      // Fallback if range not calculated yet
      const currentYear = new Date().getFullYear();
      options.push(currentYear);
    }
    return options;
  }, [yearRange]);
  
  const value = useMemo(() => ({
    selectedYear,
    setYear,
    getCurrentYear,
    getCurrentDate,
    yearRange,
    yearOptions
  }), [selectedYear, getCurrentYear, getCurrentDate, yearRange, yearOptions]);
  
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
    const currentYear = new Date().getFullYear();
    return {
      selectedYear: currentYear,
      setYear: () => {},
      getCurrentYear: () => currentYear,
      getCurrentDate: () => new Date(),
      yearRange: { min: currentYear, max: currentYear },
      yearOptions: [currentYear]
    };
  }
  return context;
}

