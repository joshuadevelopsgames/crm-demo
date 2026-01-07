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
    staleTime: 0, // Always consider stale to ensure fresh data
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
        console.log('📋 Fetching profile for user:', session.user.id, session.user.email);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          console.log('📋 Profile fetch result:', { data, error: error?.message, errorCode: error?.code });

          if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error fetching profile:', error);
          }

          // If profile doesn't exist or role is missing, check if it's the System Admin email
          const isSystemAdmin = session.user.email === 'jrsschroeder@gmail.com';
          const defaultRole = isSystemAdmin ? 'system_admin' : 'user';
          
          console.log('👤 User check:', { 
            email: session.user.email, 
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
              const avatarUrl = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
              
              const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: session.user.id,
                  email: session.user.email,
                  full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
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
                  id: session.user.id,
                  email: session.user.email,
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
              const avatarUrl = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
              setProfile({
                id: session.user.id,
                email: session.user.email,
                avatar_url: avatarUrl,
                role: defaultRole
              });
            }
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
          // Fallback: check if it's System Admin email
          const defaultRole = session.user.email === 'jrsschroeder@gmail.com' ? 'system_admin' : 'user';
          
          // Try to create profile in database
          if (supabase) {
            try {
              // Get avatar from Google OAuth metadata (avatar_url or picture)
              const avatarUrl = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
              
              const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: session.user.id,
                  email: session.user.email,
                  full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
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
          const avatarUrl = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null;
          setProfile({
            id: session.user.id,
            email: session.user.email,
            avatar_url: avatarUrl,
            role: defaultRole
          });
        }
      } else {
        // Fallback for demo mode
        const email = session.user.email || localStorage.getItem('userEmail');
        setProfile({
          id: session.user.id,
          email: email,
          role: email === 'jrsschroeder@gmail.com' ? 'system_admin' : 'user'
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
