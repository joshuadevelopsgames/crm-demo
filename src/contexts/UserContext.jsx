import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseAuth } from '@/services/supabaseClient';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = getSupabaseAuth();

  // Get current user session
  const { data: session } = useQuery({
    queryKey: ['auth-session'],
    queryFn: async () => {
      if (!supabase) return null;
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });

  // Fetch user profile when session changes
  useEffect(() => {
    const fetchProfile = async () => {
      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      setUser(session.user);

      // Fetch profile from profiles table
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error fetching profile:', error);
          }

          // If profile doesn't exist, check if it's the System Admin email
          const defaultRole = session.user.email === 'jrsschroeder@gmail.com' ? 'admin' : 'user';
          setProfile(data || {
            id: session.user.id,
            email: session.user.email,
            role: defaultRole // Default role (admin for System Admin, user for others)
          });
        } catch (error) {
          console.error('Error fetching profile:', error);
          // Fallback: check if it's System Admin email
          const defaultRole = session.user.email === 'jrsschroeder@gmail.com' ? 'admin' : 'user';
          setProfile({
            id: session.user.id,
            email: session.user.email,
            role: defaultRole
          });
        }
      } else {
        // Fallback for demo mode
        const email = session.user.email || localStorage.getItem('userEmail');
        setProfile({
          id: session.user.id,
          email: email,
          role: email === 'jrsschroeder@gmail.com' ? 'admin' : 'user'
        });
      }

      setIsLoading(false);
    };

    fetchProfile();
  }, [session, supabase]);

  // Listen for auth state changes
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(session.user);
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = {
    user,
    profile,
    isLoading,
    isAdmin: profile?.role === 'admin',
    canManageICP: profile?.role === 'admin',
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
