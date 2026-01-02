import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useUser } from './UserContext';
import { getSupabaseAuth } from '@/services/supabaseClient';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const { profile, isLoading: userLoading } = useUser();
  const supabase = getSupabaseAuth();
  const isLoadingFromServer = useRef(false);
  const hasInitializedFromServer = useRef(false);
  
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // For initial load, use localStorage if available, otherwise default to light mode
    // This is just for immediate UI rendering - will be overridden by server value
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    // Default to light mode (false) instead of system preference
    return false;
  });

  // Load preference from profile when it becomes available (only once per profile load)
  useEffect(() => {
    // Wait for user to finish loading before checking profile
    if (userLoading) return;
    
    if (profile?.id && supabase && !hasInitializedFromServer.current) {
      hasInitializedFromServer.current = true;
      
      // Profile has dark_mode preference
      if (profile.dark_mode !== null && profile.dark_mode !== undefined) {
        // Server has explicit preference - use it (this is the source of truth)
        const serverPreference = profile.dark_mode;
        isLoadingFromServer.current = true;
        setIsDarkMode(serverPreference);
        // Sync localStorage as fallback
        localStorage.setItem('darkMode', serverPreference.toString());
        setTimeout(() => {
          isLoadingFromServer.current = false;
        }, 100);
      } else {
        // Server preference is null - check if we have a localStorage value to sync
        // This handles the case where user set preference on another device before server sync was implemented
        const localPreference = localStorage.getItem('darkMode');
        if (localPreference !== null) {
          // We have a local preference but server doesn't - sync it to server
          const localValue = localPreference === 'true';
          isLoadingFromServer.current = true;
          setIsDarkMode(localValue);
          // Save to server so it syncs across devices
          supabase
            .from('profiles')
            .update({ dark_mode: localValue })
            .eq('id', profile.id)
            .then(({ error }) => {
              if (error) {
                console.error('Error syncing dark mode preference to server:', error);
              } else {
                console.log('✅ Synced dark mode preference to server');
              }
            });
          setTimeout(() => {
            isLoadingFromServer.current = false;
          }, 100);
        } else {
          // No server preference and no local preference - default to light mode and save to server
          const defaultLightMode = false;
          isLoadingFromServer.current = true;
          setIsDarkMode(defaultLightMode);
          localStorage.setItem('darkMode', defaultLightMode.toString());
          // Save default to server so it's consistent across devices
          supabase
            .from('profiles')
            .update({ dark_mode: defaultLightMode })
            .eq('id', profile.id)
            .then(({ error }) => {
              if (error) {
                console.error('Error saving default dark mode preference to server:', error);
              } else {
                console.log('✅ Saved default light mode preference to server');
              }
            });
          setTimeout(() => {
            isLoadingFromServer.current = false;
          }, 100);
        }
      }
    } else if (!profile?.id && !userLoading) {
      // User logged out - reset initialization flag
      hasInitializedFromServer.current = false;
    }
  }, [profile?.id, profile?.dark_mode, supabase, userLoading]); // Include userLoading in dependencies

  // Apply dark mode to DOM
  useEffect(() => {
    // Apply dark mode via data-theme attribute (preferred) and class (legacy support)
    const root = document.documentElement;
    if (isDarkMode) {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
    } else {
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Save to server when preference changes (but not when loading from server)
  useEffect(() => {
    if (isLoadingFromServer.current) return; // Don't save if we're loading from server
    
    if (profile?.id && supabase) {
      // Save to server
      supabase
        .from('profiles')
        .update({ dark_mode: isDarkMode })
        .eq('id', profile.id)
        .then(({ error }) => {
          if (error) {
            console.error('Error saving dark mode preference to server:', error);
          }
        });
    }
    
    // Also save to localStorage as fallback
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode, profile?.id, supabase]);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => !prev);
  };

  const setDarkMode = (value) => {
    setIsDarkMode(value);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
