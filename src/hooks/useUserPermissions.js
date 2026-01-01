import { useQuery } from '@tanstack/react-query';
import { useUser } from '@/contexts/UserContext';
import { getSupabaseAuth } from '@/services/supabaseClient';

// Define all permissions in the system (must match Permissions.jsx)
const PERMISSIONS = [
  { id: 'access_scoring', checkedByDefault: false },
  { id: 'manage_icp_template', checkedByDefault: false },
  { id: 'view_all_accounts', checkedByDefault: true },
  { id: 'edit_accounts', checkedByDefault: true },
  { id: 'view_all_contacts', checkedByDefault: true },
  { id: 'edit_contacts', checkedByDefault: true },
  { id: 'manage_interactions', checkedByDefault: true },
  { id: 'manage_permissions', checkedByDefault: false },
];

/**
 * Hook to get current user's permissions
 * Returns an object with permission IDs as keys and boolean values
 */
export function useUserPermissions() {
  const { profile, isSystemAdmin, isAdmin } = useUser();

  const { data: permissions = {}, isLoading } = useQuery({
    queryKey: ['user-permissions', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return {};

      // System admin has all permissions
      if (isSystemAdmin) {
        const allPerms = {};
        PERMISSIONS.forEach(perm => {
          allPerms[perm.id] = true;
        });
        return allPerms;
      }

      // For regular admins and users, get their actual permissions
      const isUserAdmin = profile.role === 'admin' || profile.role === 'system_admin';
      const roleBasedPerms = {};
      PERMISSIONS.forEach(perm => {
        if (perm.id === 'manage_permissions') {
          roleBasedPerms[perm.id] = isUserAdmin;
        } else if (perm.id === 'access_scoring' || perm.id === 'manage_icp_template') {
          roleBasedPerms[perm.id] = isUserAdmin;
        } else {
          roleBasedPerms[perm.id] = perm.checkedByDefault !== false;
        }
      });

      // Fetch custom permissions from database
      try {
        const response = await fetch(`/api/admin/userPermissions?userId=${profile.id}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            // Merge: database permissions override role-based defaults
            return {
              ...roleBasedPerms,
              ...result.data
            };
          }
        }
      } catch (error) {
        console.error('Error fetching user permissions:', error);
      }

      return roleBasedPerms;
    },
    enabled: !!profile?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return { permissions, isLoading };
}

/**
 * Helper function to check if user has a specific permission
 */
export function useHasPermission(permissionId) {
  const { permissions } = useUserPermissions();
  return permissions[permissionId] === true;
}

