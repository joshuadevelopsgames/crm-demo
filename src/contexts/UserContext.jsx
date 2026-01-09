import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseAuth } from '@/services/supabaseClient';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = getSupabaseAuth();
  const queryClient = useQueryClient();

  // Get current user session
  const { data: session, refetch: refetchSession } = useQuery({
    queryKey: ['auth-session'],
    queryFn: async () => {
      if (!supabase) return null;
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
    staleTime: 0, // Always consider stale to ensure fresh data
  });

  // Fetch profile function (extracted for reuse) - MUST be defined before useEffects that use it
  const fetchProfileForSession = React.useCallback(async (sessionToUse) => {
    const currentSupabase = getSupabaseAuth();
    if (!sessionToUse?.user) {
      setUser(null);
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setUser(sessionToUse.user);

    // Fetch profile from profiles table
    if (currentSupabase) {
      console.log('📋 Fetching profile for user:', sessionToUse.user.id, sessionToUse.user.email);
      try {
        const { data, error } = await currentSupabase
          .from('profiles')
          .select('*')
          .eq('id', sessionToUse.user.id)
          .single();

        console.log('📋 Profile fetch result:', { data, error: error?.message, errorCode: error?.code });

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
          console.error('Error fetching profile:', error);
        }

        // If profile doesn't exist or role is missing, check if it's the System Admin email
        const isSystemAdmin = sessionToUse.user.email === 'jrsschroeder@gmail.com';
        const defaultRole = isSystemAdmin ? 'system_admin' : 'user';
        
        console.log('👤 User check:', { 
          email: sessionToUse.user.email, 
          isSystemAdmin, 
          defaultRole,
          profileExists: !!data,
          profileRole: data?.role
        });
        
        // If profile exists but role is missing/null, ensure System Admin gets system_admin role
        if (data) {
          const finalRole = data.role || (isSystemAdmin ? 'system_admin' : 'user');
          console.log('✅ Setting profile with role:', finalRole);
          setProfile({
            ...data,
            role: finalRole
          });
        } else {
          // Profile doesn't exist in database - create it
          console.log('🆕 Profile not found, creating new profile with role:', defaultRole);
          try {
            // Get avatar from Google OAuth metadata (avatar_url or picture)
            const avatarUrl = sessionToUse.user.user_metadata?.avatar_url || sessionToUse.user.user_metadata?.picture || null;
            
            const { data: newProfile, error: insertError } = await currentSupabase
              .from('profiles')
              .insert({
                id: sessionToUse.user.id,
                email: sessionToUse.user.email,
                full_name: sessionToUse.user.user_metadata?.full_name || sessionToUse.user.user_metadata?.name || '',
                avatar_url: avatarUrl,
                role: defaultRole
              })
              .select()
              .single();
            
            console.log('🆕 Profile creation result:', { newProfile, insertError: insertError?.message });
            
            if (insertError) {
              console.error('❌ Error creating profile:', insertError);
              // Fallback: use in-memory profile
              console.log('⚠️ Using in-memory profile fallback');
              setProfile({
                id: sessionToUse.user.id,
                email: sessionToUse.user.email,
                avatar_url: avatarUrl,
                role: defaultRole
              });
            } else {
              console.log('✅ Profile created successfully:', newProfile);
              setProfile(newProfile);
            }
          } catch (err) {
            console.error('Error creating profile:', err);
            // Fallback: use in-memory profile
            const avatarUrl = sessionToUse.user.user_metadata?.avatar_url || sessionToUse.user.user_metadata?.picture || null;
            setProfile({
              id: sessionToUse.user.id,
              email: sessionToUse.user.email,
              avatar_url: avatarUrl,
              role: defaultRole
            });
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        // Fallback: check if it's System Admin email
        const defaultRole = sessionToUse.user.email === 'jrsschroeder@gmail.com' ? 'system_admin' : 'user';
        
        // Try to create profile in database
        if (currentSupabase) {
          try {
            // Get avatar from Google OAuth metadata (avatar_url or picture)
            const avatarUrl = sessionToUse.user.user_metadata?.avatar_url || sessionToUse.user.user_metadata?.picture || null;
            
            const { data: newProfile, error: insertError } = await currentSupabase
              .from('profiles')
              .insert({
                id: sessionToUse.user.id,
                email: sessionToUse.user.email,
                full_name: sessionToUse.user.user_metadata?.full_name || sessionToUse.user.user_metadata?.name || '',
                avatar_url: avatarUrl,
                role: defaultRole
              })
              .select()
              .single();
            
            if (!insertError && newProfile) {
              setProfile(newProfile);
              return;
            }
          } catch (insertErr) {
            console.error('Error creating profile in catch block:', insertErr);
          }
        }
        
        // Final fallback: use in-memory profile
        const avatarUrl = sessionToUse.user.user_metadata?.avatar_url || sessionToUse.user.user_metadata?.picture || null;
        setProfile({
          id: sessionToUse.user.id,
          email: sessionToUse.user.email,
          avatar_url: avatarUrl,
          role: defaultRole
        });
      }
    } else {
      // Fallback for demo mode
      const email = sessionToUse.user.email || localStorage.getItem('userEmail');
      setProfile({
        id: sessionToUse.user.id,
        email: email,
        role: email === 'jrsschroeder@gmail.com' ? 'system_admin' : 'user'
      });
    }

    setIsLoading(false);
  }, []); // No dependencies - we get supabase fresh each time

  // Fetch user profile when session changes
  useEffect(() => {
    fetchProfileForSession(session);
  }, [session, fetchProfileForSession]);

  // Listen for auth state changes and refetch session/profile immediately
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('🔄 Auth state changed:', event, newSession?.user?.email);
      
      // Invalidate and refetch session query to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['auth-session'] });
      refetchSession();
      
      // Immediately fetch profile with the new session to avoid waiting for query update
      if (newSession) {
        fetchProfileForSession(newSession);
      } else {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, refetchSession, queryClient, fetchProfileForSession]);

  // Determine admin status - check role or email fallback
  // System Admin email always has admin access, regardless of database role
  // Admin access: both system_admin and admin roles have admin privileges
  const isAdmin = profile?.role === 'system_admin' || 
                  profile?.role === 'admin' || 
                  profile?.email === 'jrsschroeder@gmail.com';
  
  // Check if user is specifically the system admin (cannot be deleted, has special privileges)
  const isSystemAdmin = profile?.role === 'system_admin' || 
                        profile?.email === 'jrsschroeder@gmail.com';

  // Debug logging for all users (can be removed later)
  console.log('🔍 UserContext Debug:', {
    hasSession: !!session,
    userEmail: session?.user?.email,
    hasProfile: !!profile,
    profileEmail: profile?.email,
    profileRole: profile?.role,
    isAdmin,
    isSystemAdmin,
    supabaseConfigured: !!supabase
    });

  // Use useMemo to ensure value object reference stability, but still update when dependencies change
  const value = React.useMemo(() => ({
    user,
    profile,
    isLoading,
    isAdmin,
    canManageICP: isAdmin,
    isSystemAdmin,
  }), [user, profile, isLoading, isAdmin, isSystemAdmin]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
