import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getSupabaseAuth } from '@/services/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Shield, 
  Users, 
  Settings, 
  Award, 
  Building2, 
  FileText,
  Search,
  Save,
  RefreshCw,
  UserPlus,
  Trash2
} from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import toast from 'react-hot-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Define all permissions in the system
const PERMISSIONS = [
  {
    id: 'access_scoring',
    name: 'Access Scoring Page',
    description: 'Can view and manage ICP scorecard templates',
    category: 'Scoring',
    icon: Award,
    checkedByDefault: false
  },
  {
    id: 'manage_icp_template',
    name: 'Manage ICP Template',
    description: 'Can create, edit, and delete ICP scorecard templates',
    category: 'Scoring',
    icon: Award,
    checkedByDefault: false
  },
  {
    id: 'view_all_accounts',
    name: 'View All Accounts',
    description: 'Can view all accounts in the system',
    category: 'Accounts',
    icon: Building2,
    checkedByDefault: true
  },
  {
    id: 'edit_accounts',
    name: 'Edit Accounts',
    description: 'Can create, edit, and delete accounts',
    category: 'Accounts',
    icon: Building2,
    checkedByDefault: true
  },
  {
    id: 'view_all_contacts',
    name: 'View All Contacts',
    description: 'Can view all contacts in the system',
    category: 'Contacts',
    icon: Users,
    checkedByDefault: true
  },
  {
    id: 'edit_contacts',
    name: 'Edit Contacts',
    description: 'Can create, edit, and delete contacts',
    category: 'Contacts',
    icon: Users,
    checkedByDefault: true
  },
  {
    id: 'manage_interactions',
    name: 'Manage Interactions',
    description: 'Can create, edit, and delete interactions',
    category: 'Interactions',
    icon: FileText,
    checkedByDefault: true
  },
  {
    id: 'manage_permissions',
    name: 'Manage Permissions',
    description: 'Can access this permissions page and manage user permissions',
    category: 'System',
    icon: Shield,
    checkedByDefault: false
  }
];

// Group permissions by category
const PERMISSIONS_BY_CATEGORY = PERMISSIONS.reduce((acc, perm) => {
  if (!acc[perm.category]) {
    acc[perm.category] = [];
  }
  acc[perm.category].push(perm);
  return acc;
}, {});

export default function Permissions() {
  const { isAdmin, isSystemAdmin, profile } = useUser();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user'
  });
  const [isCreating, setIsCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Fetch all users/profiles
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const supabase = getSupabaseAuth();
      if (!supabase) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('email');
      
      if (error) {
        console.error('❌ Error fetching profiles:', error);
        console.error('   - Error code:', error.code);
        console.error('   - Error message:', error.message);
        console.error('   - Error details:', error);
        toast.error(`Failed to load users: ${error.message}`);
        return [];
      }
      
      console.log(`✅ Loaded ${data?.length || 0} profiles from database`);
      return data || [];
    },
    enabled: isAdmin // Only fetch if user is admin
  });

  // Fetch permissions for selected user from database
  const { data: userPerms, isLoading: permsLoading } = useQuery({
    queryKey: ['user-permissions', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser) return {};
      
      // First, get role-based defaults
      const isUserAdmin = selectedUser.role === 'admin' || selectedUser.role === 'system_admin';
      const roleBasedPerms = {};
      PERMISSIONS.forEach(perm => {
        if (perm.id === 'manage_permissions') {
          roleBasedPerms[perm.id] = isUserAdmin;
        } else if (perm.id === 'access_scoring' || perm.id === 'manage_icp_template') {
          roleBasedPerms[perm.id] = isUserAdmin;
        } else {
          roleBasedPerms[perm.id] = perm.checkedByDefault !== false; // Use checkedByDefault or default to true
        }
      });
      
      // Then, fetch custom permissions from database
      try {
        const response = await fetch(`/api/admin/userPermissions?userId=${selectedUser.id}`);
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
      
      // Fallback to role-based permissions
      return roleBasedPerms;
    },
    enabled: !!selectedUser
  });

  // Update permissions when userPerms changes
  React.useEffect(() => {
    if (userPerms) {
      setUserPermissions(userPerms);
    }
  }, [userPerms]);

  const updateUserRoleMutation = useMutation({
    mutationFn: async ({ userId, role }) => {
      const supabase = getSupabaseAuth();
      if (!supabase) throw new Error('Supabase not configured');
      
      const { data, error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['user-permissions', selectedUser?.id] });
      toast.success('User role updated successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update user role');
    }
  });

  const handleRoleChange = (userId, newRole) => {
    updateUserRoleMutation.mutate({ userId, role: newRole });
  };

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ userId, permissionId, enabled }) => {
      const response = await fetch('/api/admin/userPermissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, permissionId, enabled })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to update permission');
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions', selectedUser?.id] });
      toast.success('✅ Permission updated');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to update permission');
      console.error('❌ Error updating permission:', error);
    }
  });

  const handlePermissionToggle = (permissionId, enabled) => {
    if (!selectedUser) return;
    
    // Optimistically update UI
    setUserPermissions(prev => ({
      ...prev,
      [permissionId]: enabled
    }));
    
    // Save to database
    updatePermissionMutation.mutate({
      userId: selectedUser.id,
      permissionId,
      enabled
    });
  };

  const createUserMutation = useMutation({
    mutationFn: async (userData) => {
      const requestId = Math.random().toString(36).substring(7);
      const timestamp = new Date().toISOString();
      
      console.log(`\n🔐 [CLIENT ${requestId}] ========== CREATE USER REQUEST START ==========`);
      console.log(`🔐 [CLIENT ${requestId}] Timestamp:`, timestamp);
      console.log(`🔐 [CLIENT ${requestId}] User data:`, {
        email: userData.email,
        hasPassword: !!userData.password,
        passwordLength: userData.password?.length,
        full_name: userData.full_name,
        role: userData.role
      });
      
      try {
        const requestBody = JSON.stringify(userData);
        console.log(`🔐 [CLIENT ${requestId}] Sending POST request to /api/admin/createUser...`);
        console.log(`🔐 [CLIENT ${requestId}] Request body (JSON):`, requestBody);
        console.log(`🔐 [CLIENT ${requestId}] Request body (parsed):`, JSON.parse(requestBody));
        const response = await fetch('/api/admin/createUser', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: requestBody
        });

        console.log(`🔐 [CLIENT ${requestId}] Response received:`);
        console.log(`   - Status:`, response.status, response.statusText);
        console.log(`   - OK:`, response.ok);
        console.log(`   - Headers:`, Object.fromEntries(response.headers.entries()));

        let result;
        const contentType = response.headers.get('content-type');
        console.log(`🔐 [CLIENT ${requestId}] Content-Type:`, contentType);
        
        try {
          if (contentType && contentType.includes('application/json')) {
            result = await response.json();
            console.log(`✅ [CLIENT ${requestId}] Successfully parsed JSON response:`, result);
          } else {
            const text = await response.text();
            console.error(`❌ [CLIENT ${requestId}] Response is not JSON, got:`, text);
            throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}. Body: ${text.substring(0, 200)}`);
          }
        } catch (jsonError) {
          console.error(`❌ [CLIENT ${requestId}] Failed to parse response:`, jsonError);
          const text = await response.text().catch(() => 'Could not read response body');
          console.error(`❌ [CLIENT ${requestId}] Response text:`, text);
          throw new Error(`Server error: ${response.status} ${response.statusText}. ${text.substring(0, 200)}`);
        }

        if (!response.ok) {
          const errorMsg = result?.error || result?.message || `HTTP ${response.status}: Failed to create user`;
          const requestIdFromServer = result?.requestId || 'unknown';
          console.error(`❌ [CLIENT ${requestId}] API returned error:`);
          console.error(`   - Status:`, response.status);
          console.error(`   - Error message:`, errorMsg);
          console.error(`   - Server request ID:`, requestIdFromServer);
          console.error(`   - Full response:`, result);
          throw new Error(errorMsg);
        }

        if (!result.success) {
          console.error(`❌ [CLIENT ${requestId}] Response indicates failure:`);
          console.error(`   - Success flag:`, result.success);
          console.error(`   - Error:`, result.error);
          throw new Error(result.error || 'Failed to create user');
        }
        
        console.log(`✅ [CLIENT ${requestId}] User created successfully!`);
        console.log(`   - User ID:`, result.data?.user?.id);
        console.log(`   - Email:`, result.data?.user?.email);
        console.log(`✅ [CLIENT ${requestId}] ========== CREATE USER REQUEST SUCCESS ==========\n`);
        return result.data;
      } catch (error) {
        console.error(`❌ [CLIENT ${requestId}] Error in createUserMutation:`);
        console.error(`   - Error name:`, error.name);
        console.error(`   - Error message:`, error.message);
        console.error(`   - Error stack:`, error.stack);
        console.error(`❌ [CLIENT ${requestId}] ========== CREATE USER REQUEST FAILED ==========\n`);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('✅ User created successfully');
      setIsCreateDialogOpen(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'user' });
    },
    onError: (error) => {
      console.error('❌ Error creating user:', error);
      const errorMessage = error.message || error.toString() || 'Failed to create user';
      console.error('❌ Full error object:', error);
      toast.error(errorMessage, { duration: 5000 });
    }
  });

  const handleCreateUser = () => {
    if (!newUser.email || !newUser.password) {
      toast.error('Email and password are required');
      return;
    }
    setIsCreating(true);
    createUserMutation.mutate(newUser, {
      onSettled: () => {
        setIsCreating(false);
      }
    });
  };

  const deleteUserMutation = useMutation({
    mutationFn: async (userId) => {
      const response = await fetch(`/api/admin/deleteUser?userId=${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to delete user');
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('✅ User deleted successfully');
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      // Clear selected user if it was the deleted user
      if (selectedUser?.id === userToDelete?.id) {
        setSelectedUser(null);
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete user');
      console.error('❌ Error deleting user:', error);
    }
  });

  const handleDeleteClick = (user, e) => {
    e.stopPropagation(); // Prevent selecting the user when clicking delete
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  // Filter users by search term
  const filteredUsers = users.filter(user => 
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Redirect if not system admin
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Access Denied</h3>
              <p className="text-slate-600">You must be a System Admin to access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Permissions Management</h1>
        <p className="text-slate-600 mt-1">Manage user roles and permissions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Users
              </CardTitle>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                size="sm"
                className="gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Create User
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Users List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {usersLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="w-6 h-6 text-slate-400 mx-auto mb-2 animate-spin" />
                  <p className="text-sm text-slate-600">Loading users...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-slate-600">No users found</p>
                </div>
              ) : (
                filteredUsers.map(user => (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedUser?.id === user.id
                        ? 'bg-slate-100 border-slate-300'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {user.full_name || user.email}
                        </p>
                        {user.full_name && (
                          <p className="text-sm text-slate-500 truncate">{user.email}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={user.role === 'admin' || user.role === 'system_admin' ? 'default' : 'outline'}
                          className={user.role === 'system_admin' ? 'bg-purple-600' : user.role === 'admin' ? 'bg-blue-600' : ''}
                        >
                          {user.role === 'system_admin' ? 'System Admin' : user.role === 'admin' ? 'Admin' : 'User'}
                        </Badge>
                        {user.id !== profile?.id && user.role !== 'system_admin' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleDeleteClick(user, e)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Permissions Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {selectedUser ? `Permissions: ${selectedUser.full_name || selectedUser.email}` : 'Select a User'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedUser ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600">Select a user to manage their permissions</p>
              </div>
            ) : permsLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="w-6 h-6 text-slate-400 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-slate-600">Loading permissions...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Role Selection */}
                <div>
                  <Label className="text-base font-semibold mb-3 block">User Role</Label>
                  <Select
                    value={selectedUser.role || 'user'}
                    onValueChange={(value) => handleRoleChange(selectedUser.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      {selectedUser.role === 'system_admin' && (
                        <SelectItem value="system_admin" disabled>System Admin (Reserved)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-2">
                    {selectedUser.role === 'system_admin'
                      ? 'System Admin has full access and cannot be modified'
                      : selectedUser.role === 'admin'
                      ? 'Admin users have full access to all features including Scoring and Permissions management'
                      : 'Regular users have access to most features except Scoring and Permissions management'}
                  </p>
                </div>

                {/* Permissions by Category */}
                <div className="space-y-6">
                  {Object.entries(PERMISSIONS_BY_CATEGORY).map(([category, perms]) => (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wide">
                        {category}
                      </h3>
                      <div className="space-y-3">
                        {perms.map(perm => {
                          const Icon = perm.icon;
                          const isEnabled = userPermissions[perm.id] || false;
                          
                          return (
                            <div
                              key={perm.id}
                              className={`p-3 rounded-lg border ${
                                isEnabled ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Icon className="w-4 h-4 text-slate-600" />
                                    <Label className="font-medium text-slate-900">
                                      {perm.name}
                                    </Label>
                                  </div>
                                  <p className="text-xs text-slate-600">{perm.description}</p>
                                </div>
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => {
                                    handlePermissionToggle(perm.id, checked);
                                  }}
                                  disabled={false}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Info Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> As System Admin, you can enable or disable any permission for any user. 
                    Permissions are stored individually and override role-based defaults. Changes are saved immediately.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Create a new user account. The user will be able to log in with the email and password you provide.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-user-email">Email *</Label>
              <Input
                id="new-user-email"
                type="email"
                placeholder="user@example.com"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-password">Password *</Label>
              <Input
                id="new-user-password"
                type="password"
                placeholder="Minimum 6 characters"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                disabled={isCreating}
              />
              <p className="text-xs text-slate-500">Password must be at least 6 characters long</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-name">Full Name</Label>
              <Input
                id="new-user-name"
                type="text"
                placeholder="John Doe"
                value={newUser.full_name}
                onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                disabled={isCreating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-user-role">Role</Label>
              <Select
                value={newUser.role}
                onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                disabled={isCreating}
              >
                <SelectTrigger id="new-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {newUser.role === 'admin' 
                  ? 'Admin users have full access including Scoring and Permissions management'
                  : 'Regular users have access to most features except admin functions'}
              </p>
              <p className="text-xs text-slate-400 italic">
                Note: System Admin role is reserved for jrsschroeder@gmail.com and cannot be assigned to other users.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewUser({ email: '', password: '', full_name: '', role: 'user' });
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={isCreating || !newUser.email || !newUser.password}
            >
              {isCreating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.email}</strong>? 
              This action cannot be undone. The user will be permanently removed from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteDialogOpen(false);
              setUserToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteUserMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteUserMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete User
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


