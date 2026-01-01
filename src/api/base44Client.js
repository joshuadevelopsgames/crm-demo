/**
 * base44 API Client
 * This should be configured with your base44 instance
 * Example setup:
 * 
 * import { Base44 } from '@base44/sdk';
 * 
 * export const base44 = new Base44({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'https://your-instance.base44.io'
 * });
 */


// Helper to get data from API
async function getData(entityType, forceRefresh = false) {
  try {
    const response = await fetch(`/api/data/${entityType}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${entityType}: ${response.statusText}`);
    }
    const result = await response.json();
    if (result.success) {
      console.log(`📡 Loaded ${result.data.length} ${entityType} from API`);
      return result.data || [];
    }
    return [];
  } catch (error) {
    console.warn(`Error loading ${entityType} from API:`, error);
    return [];
  }
}

// Helper to get current user (extracted to avoid circular dependency)
async function getCurrentUser() {
  // Try to get real user from Supabase
  try {
    const { getSupabaseAuth } = await import('@/services/supabaseClient');
    const supabase = getSupabaseAuth();
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        return {
          id: session.user.id,
          email: session.user.email,
          ...session.user
        };
      }
    }
  } catch (error) {
    console.warn('Error getting Supabase user, using fallback:', error);
  }
  // Fallback to mock user
  return { email: 'user@example.com', id: '1' };
}

// Mock arrays for SalesInsights and ResearchNotes (used as fallback for create/update)
// These are only used if API endpoints are not available
const mockSalesInsights = [];
const mockResearchNotes = [];

// Placeholder - replace with actual base44 SDK initialization
// Currently using Google Sheets data (with mock fallback)
// BUILD_VERSION: 2025-12-29-12:00 - Fixed Sequence.create to use API
// Using lazy initialization to avoid circular dependency issues
let _base44Instance = null;

function createBase44Instance() {
  if (_base44Instance) return _base44Instance;
  
  _base44Instance = {
  entities: {
    Account: {
      list: async (forceRefresh = false) => {
        const data = await getData('accounts', forceRefresh);
        return Array.isArray(data) ? data : [];
      },
      filter: async (filters, sort, forceRefresh = false) => {
        const data = await getData('accounts', forceRefresh);
        let results = Array.isArray(data) ? [...data] : [];
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(account => {
            return Object.entries(filters).every(([key, value]) => {
              return account[key] === value;
            });
          });
        }
        return results;
      },
      create: async (data) => {
        const response = await fetch('/api/data/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to create account');
      },
      update: async (id, data) => {
        const response = await fetch('/api/data/accounts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        
        // Include more error details for debugging
        const error = new Error(result.error || 'Failed to update account');
        error.status = response.status;
        error.response = result;
        error.accountId = id;
        error.updateData = data;
        throw error;
      },
      // Upsert: Create if doesn't exist, update if it does
      upsert: async (data, lookupField = 'lmn_crm_id') => {
        const response = await fetch('/api/data/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upsert', data: { account: data, lookupField } })
        });
        const result = await response.json();
        if (result.success) return { ...result.data, _action: result.action };
        throw new Error(result.error || 'Failed to upsert account');
      },
    },
    Contact: {
      list: async (forceRefresh = false) => {
        const data = await getData('contacts', forceRefresh);
        return Array.isArray(data) ? data : [];
      },
      create: async (data) => {
        const response = await fetch('/api/data/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to create contact');
      },
      update: async (id, data) => {
        const response = await fetch('/api/data/contacts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to update contact');
      },
      upsert: async (data, lookupField = 'lmn_contact_id') => {
        const response = await fetch('/api/data/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upsert', data: { contact: data, lookupField } })
        });
        const result = await response.json();
        if (result.success) return { ...result.data, _action: result.action };
        throw new Error(result.error || 'Failed to upsert contact');
      },
      filter: async (filters, sort, forceRefresh = false) => {
        const data = await getData('contacts', forceRefresh);
        let results = Array.isArray(data) ? [...data] : [];
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(contact => {
            return Object.entries(filters).every(([key, value]) => {
              return contact[key] === value;
            });
          });
        }
        return results;
      },
    },
    Interaction: {
      list: async () => {
        const response = await fetch('/api/data/interactions');
        if (!response.ok) return [];
        const result = await response.json();
        return result.success ? (result.data || []) : [];
      },
      filter: async (filters, sort) => {
        const response = await fetch('/api/data/interactions');
        if (!response.ok) return [];
        const result = await response.json();
        let results = result.success ? (result.data || []) : [];
        
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(interaction => {
            return Object.entries(filters).every(([key, value]) => {
              return interaction[key] === value;
            });
          });
        }
        if (sort) {
          // Simple sort implementation
          const desc = sort.startsWith('-');
          const sortField = desc ? sort.substring(1) : sort;
          results.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            if (aVal < bVal) return desc ? 1 : -1;
            if (aVal > bVal) return desc ? -1 : 1;
            return 0;
          });
        }
        return results;
      },
      create: async (data) => {
        const response = await fetch('/api/data/interactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to create interaction');
      },
      update: async (id, data) => {
        const response = await fetch('/api/data/interactions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to update interaction');
      },
      delete: async (id) => {
        const response = await fetch(`/api/data/interactions?id=${id}`, {
          method: 'DELETE'
        });
        const result = await response.json();
        if (result.success) return true;
        throw new Error(result.error || 'Failed to delete interaction');
      },
    },
    Task: {
      list: async (sort) => {
        const data = await getData('tasks');
        let results = Array.isArray(data) ? [...data] : [];
        if (sort) {
          const desc = sort.startsWith('-');
          const sortField = desc ? sort.substring(1) : sort;
          results.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            if (aVal < bVal) return desc ? 1 : -1;
            if (aVal > bVal) return desc ? -1 : 1;
            return 0;
          });
        }
        return results;
      },
      filter: async (filters) => {
        const data = await getData('tasks');
        let results = Array.isArray(data) ? [...data] : [];
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(task => {
            return Object.entries(filters).every(([key, value]) => {
              return task[key] === value;
            });
          });
        }
        return results;
      },
      create: async (data) => {
        const response = await fetch('/api/data/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to create task');
      },
      update: async (id, data) => {
        const response = await fetch('/api/data/tasks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to update task');
      },
      delete: async (id) => {
        const response = await fetch(`/api/data/tasks?id=${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to delete task');
      },
    },
    Sequence: {
      list: async () => {
        const data = await getData('sequences');
        return Array.isArray(data) ? data : [];
      },
      filter: async (filters, sort) => {
        const data = await getData('sequences');
        let results = Array.isArray(data) ? [...data] : [];
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(seq => {
            return Object.entries(filters).every(([key, value]) => {
              return seq[key] === value;
            });
          });
        }
        return results;
      },
      create: async (data) => {
        // Fixed: Use API endpoint instead of mockSequences
        const response = await fetch('/api/data/sequences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to create sequence');
      },
      update: async (id, data) => {
        const response = await fetch('/api/data/sequences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to update sequence');
      },
      delete: async (id) => {
        const response = await fetch(`/api/data/sequences?id=${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.success) return true;
        throw new Error(result.error || 'Failed to delete sequence');
      },
    },
    SequenceEnrollment: {
      list: async () => {
        const data = await getData('sequenceEnrollments');
        return Array.isArray(data) ? data : [];
      },
      filter: async (filters, sort) => {
        const data = await getData('sequenceEnrollments');
        let results = Array.isArray(data) ? [...data] : [];
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(enroll => {
            return Object.entries(filters).every(([key, value]) => {
              return enroll[key] === value;
            });
          });
        }
        return results;
      },
      create: async (data) => {
        const response = await fetch('/api/data/sequenceEnrollments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to create sequence enrollment');
      },
      update: async (id, data) => {
        const response = await fetch('/api/data/sequenceEnrollments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to update sequence enrollment');
      },
    },
    ScorecardTemplate: {
      list: async (includeVersions = false) => {
        const url = includeVersions 
          ? '/api/data/templates?include_versions=true'
          : '/api/data/templates';
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch templates: ${response.statusText}`);
        }
        const result = await response.json();
        return result.success ? (result.data || []) : [];
      },
      getCurrentICP: async () => {
        const response = await fetch('/api/data/templates?is_default=true&is_current=true');
        if (!response.ok) {
          throw new Error(`Failed to fetch ICP template: ${response.statusText}`);
        }
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          return result.data[0];
        }
        return null;
      },
      getVersionHistory: async (templateId) => {
        // Get all versions of a template by parent_template_id
        const response = await fetch(`/api/data/templates?include_versions=true`);
        if (!response.ok) {
          throw new Error(`Failed to fetch template versions: ${response.statusText}`);
        }
        const result = await response.json();
        if (result.success) {
          // Find the current template to get parent_template_id
          const current = result.data.find(t => t.id === templateId && t.is_current_version);
          if (current) {
            const parentId = current.parent_template_id || current.id;
            return result.data.filter(t => 
              (t.parent_template_id === parentId || t.id === parentId)
            ).sort((a, b) => (b.version_number || 0) - (a.version_number || 0));
          }
        }
        return [];
      },
      create: async (data) => {
        const response = await fetch('/api/data/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to create template');
      },
      update: async (id, data) => {
        const response = await fetch('/api/data/templates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to update template');
      },
      updateWithVersion: async (templateId, templateData) => {
        const response = await fetch('/api/data/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'update_with_version', 
            data: { templateId, templateData } 
          })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to update template version');
      },
    },
    ScorecardResponse: {
      list: async (forceRefresh = false) => {
        const data = await getData('scorecards', forceRefresh);
        return Array.isArray(data) ? data : [];
      },
      filter: async (filters, sort, forceRefresh = false) => {
        // Build query string for filtering
        let url = '/api/data/scorecards';
        const params = new URLSearchParams();
        
        if (filters && filters.account_id) {
          params.append('account_id', filters.account_id);
        }
        
        if (params.toString()) {
          url += '?' + params.toString();
        }
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch scorecards: ${response.statusText}`);
        }
        const result = await response.json();
        let results = result.success ? (result.data || []) : [];
        
        // Apply additional filters client-side if needed
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(response => {
            return Object.entries(filters).every(([key, value]) => {
              return response[key] === value;
            });
          });
        }
        
        // Apply sorting
        if (sort) {
          const desc = sort.startsWith('-');
          const sortField = desc ? sort.substring(1) : sort;
          results.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            if (aVal < bVal) return desc ? 1 : -1;
            if (aVal > bVal) return desc ? -1 : 1;
            return 0;
          });
        }
        
        return results;
      },
      create: async (data) => {
        const response = await fetch('/api/data/scorecards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to create scorecard response');
      },
      update: async (id, data) => {
        const response = await fetch('/api/data/scorecards', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to update scorecard response');
      },
      delete: async (id) => {
        const response = await fetch(`/api/data/scorecards?id=${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.success) return result.message;
        throw new Error(result.error || 'Failed to delete scorecard response');
      },
    },
    SalesInsight: {
      list: async () => {
        const data = await getData('insights');
        return Array.isArray(data) ? data : [];
      },
      filter: async (filters, sort) => {
        const data = await getData('insights');
        let results = Array.isArray(data) ? [...data] : [];
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(insight => {
            return Object.entries(filters).every(([key, value]) => {
              return insight[key] === value;
            });
          });
        }
        if (sort) {
          const desc = sort.startsWith('-');
          const sortField = desc ? sort.substring(1) : sort;
          results.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            if (aVal < bVal) return desc ? 1 : -1;
            if (aVal > bVal) return desc ? -1 : 1;
            return 0;
          });
        }
        return results;
      },
      create: async (data) => {
        const newInsight = { ...data, id: Date.now().toString() };
        mockSalesInsights.push(newInsight);
        return newInsight;
      },
      update: async (id, data) => {
        const index = mockSalesInsights.findIndex(i => i.id === id);
        if (index !== -1) {
          mockSalesInsights[index] = { ...mockSalesInsights[index], ...data };
          return mockSalesInsights[index];
        }
        return data;
      },
    },
    ResearchNote: {
      list: async () => {
        const data = await getData('notes');
        return Array.isArray(data) ? data : [];
      },
      filter: async (filters, sort) => {
        const data = await getData('notes');
        let results = Array.isArray(data) ? [...data] : [];
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(note => {
            return Object.entries(filters).every(([key, value]) => {
              return note[key] === value;
            });
          });
        }
        if (sort) {
          const desc = sort.startsWith('-');
          const sortField = desc ? sort.substring(1) : sort;
          results.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            if (aVal < bVal) return desc ? 1 : -1;
            if (aVal > bVal) return desc ? -1 : 1;
            return 0;
          });
        }
        return results;
      },
      create: async (data) => {
        const newNote = { ...data, id: Date.now().toString() };
        mockResearchNotes.push(newNote);
        return newNote;
      },
      update: async (id, data) => {
        const index = mockResearchNotes.findIndex(n => n.id === id);
        if (index !== -1) {
          mockResearchNotes[index] = { ...mockResearchNotes[index], ...data };
          return mockResearchNotes[index];
        }
        return data;
      },
    },
    User: {
      list: async () => {
        // Try to get users from profiles table via API
        try {
          const data = await getData('profiles');
          // Transform profiles to user format
          return data.map(profile => ({
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            role: profile.role,
            ...profile
          }));
        } catch (error) {
          console.warn('Error loading users from API:', error);
          // Fallback: try to get current user
          try {
            const currentUser = await getCurrentUser();
            return currentUser ? [currentUser] : [];
          } catch (e) {
            return [];
          }
        }
      },
      filter: async (filters) => {
        // Avoid circular dependency by calling the list method directly
        try {
          const data = await getData('profiles');
          const users = data.map(profile => ({
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            role: profile.role,
            ...profile
          }));
          let results = [...users];
          if (filters && Object.keys(filters).length > 0) {
            results = results.filter(user => {
              return Object.entries(filters).every(([key, value]) => {
                return user[key] === value;
              });
            });
          }
          return results;
        } catch (error) {
          console.warn('Error loading users from API:', error);
          // Fallback: try to get current user
          try {
            const currentUser = await getCurrentUser();
            const results = currentUser ? [currentUser] : [];
            if (filters && Object.keys(filters).length > 0) {
              return results.filter(user => {
                return Object.entries(filters).every(([key, value]) => {
                  return user[key] === value;
                });
              });
            }
            return results;
          } catch (e) {
            return [];
          }
        }
      },
      get: async (id) => {
        // Avoid circular dependency by calling getData directly
        try {
          const data = await getData('profiles');
          const users = data.map(profile => ({
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            role: profile.role,
            ...profile
          }));
          return users.find(u => u.id === id);
        } catch (error) {
          console.warn('Error loading users from API:', error);
          // Fallback: try to get current user
          try {
            const currentUser = await getCurrentUser();
            return currentUser?.id === id ? currentUser : null;
          } catch (e) {
            return null;
          }
        }
      },
      create: async (data) => {
        // Not implemented - users are created via auth
        throw new Error('User creation not supported via this API');
      },
      update: async (id, data) => {
        // Not implemented - use profile API instead
        throw new Error('User update not supported via this API');
      },
    },
    Notification: {
      list: async (userId) => {
        // Require userId to ensure users only see their own notifications
        if (!userId) {
          throw new Error('Notification.list() requires userId parameter for security');
        }
        const response = await fetch(`/api/data/notifications?user_id=${encodeURIComponent(userId)}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch notifications: ${response.statusText}`);
        }
        const result = await response.json();
        return result.success ? (result.data || []) : [];
      },
      filter: async (filters, sort) => {
        // If filtering by user_id, fetch from API with user_id query param for server-side filtering
        // This ensures users only see their own notifications
        // Limit to 100 notifications to reduce Supabase egress
        if (filters && filters.user_id) {
          try {
            const response = await fetch(`/api/data/notifications?user_id=${encodeURIComponent(filters.user_id)}&limit=100`);
            if (!response.ok) {
              throw new Error(`Failed to fetch notifications: ${response.statusText}`);
            }
            const result = await response.json();
            let results = result.success ? (result.data || []) : [];
            
            // Apply any additional filters (besides user_id) client-side
            const otherFilters = { ...filters };
            delete otherFilters.user_id;
            if (Object.keys(otherFilters).length > 0) {
              results = results.filter(notification => {
                return Object.entries(otherFilters).every(([key, value]) => {
                  return String(notification[key]) === String(value);
                });
              });
            }
            
            // Apply sorting
            if (sort) {
              const desc = sort.startsWith('-');
              const sortField = desc ? sort.substring(1) : sort;
              results.sort((a, b) => {
                const aVal = a[sortField];
                const bVal = b[sortField];
                if (aVal < bVal) return desc ? 1 : -1;
                if (aVal > bVal) return desc ? -1 : 1;
                return 0;
              });
            }
            
            return results;
          } catch (error) {
            console.warn('Error fetching filtered notifications from API, falling back to client-side filter:', error);
            // Fall back to client-side filtering if API call fails
          }
        }
        
        // Fallback: client-side filtering (for non-user_id filters or if API call fails)
        // NOTE: This fallback should rarely be used. If filtering by user_id, the API call above should succeed.
        // For non-user_id filters, we still need to get current user for security
        const currentUser = await getCurrentUser();
        if (!currentUser?.id) {
          console.warn('No current user for notification filter, returning empty array');
          return [];
        }
        const response = await fetch(`/api/data/notifications?user_id=${encodeURIComponent(currentUser.id)}`);
        if (!response.ok) {
          console.warn('Failed to fetch notifications for fallback filter');
          return [];
        }
        const result = await response.json();
        const data = result.success ? (result.data || []) : [];
        let results = Array.isArray(data) ? [...data] : [];
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(notification => {
            return Object.entries(filters).every(([key, value]) => {
              // Use loose equality to handle string vs UUID type mismatches
              return String(notification[key]) === String(value);
            });
          });
        }
        if (sort) {
          const desc = sort.startsWith('-');
          const sortField = desc ? sort.substring(1) : sort;
          results.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            if (aVal < bVal) return desc ? 1 : -1;
            if (aVal > bVal) return desc ? -1 : 1;
            return 0;
          });
        }
        return results;
      },
      create: async (data) => {
        const response = await fetch('/api/data/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to create notification');
      },
      update: async (id, data) => {
        const response = await fetch('/api/data/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to update notification');
      },
      markAsRead: async (id) => {
        const response = await fetch('/api/data/notifications', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, is_read: true })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to mark notification as read');
      },
      markAllAsRead: async (userId) => {
        if (!userId) {
          throw new Error('markAllAsRead requires userId parameter');
        }
        // Fetch notifications for this user only (server-side filtering)
        const response = await fetch(`/api/data/notifications?user_id=${encodeURIComponent(userId)}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch notifications: ${response.statusText}`);
        }
        const result = await response.json();
        const userNotifications = result.success ? (result.data || []) : [];
        await Promise.all(
          userNotifications.map(n => 
            fetch('/api/data/notifications', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: n.id, is_read: true })
            })
          )
        );
        return userNotifications;
      },
      delete: async (id) => {
        const response = await fetch(`/api/data/notifications?id=${encodeURIComponent(id)}`, {
          method: 'DELETE'
        });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || 'Failed to delete notification');
        }
        const result = await response.json();
        if (result.success) return result;
        throw new Error(result.error || 'Failed to delete notification');
      },
    },
    Estimate: {
      list: async (forceRefresh = false) => {
        const data = await getData('estimates', forceRefresh);
        return Array.isArray(data) ? data : [];
      },
      // Get yearly official LMN data (from detailed exports)
      getYearlyOfficial: async (year) => {
        try {
          const url = `/api/data/yearlyOfficialData?year=${year}`;
          console.log(`📡 Fetching yearly official data from: ${url}`);
          
          const response = await fetch(url);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`📡 API Error (${response.status}):`, errorText);
            throw new Error(`Failed to fetch yearly official data: ${response.status} ${response.statusText}`);
          }
          
          const result = await response.json();
          console.log(`📡 API Response for year ${year}:`, {
            success: result.success,
            count: result.count,
            source: result.source,
            availableYears: result.availableYears
          });
          
          if (result.success) {
            console.log(`📡 ✅ Loaded ${result.count} official estimates for year ${year} from ${result.source}`);
            return result.data || [];
          }
          
          console.warn(`📡 ⚠️ API returned success=false for year ${year}`);
          return [];
        } catch (error) {
          console.error(`📡 ❌ Error loading yearly official data for ${year}:`, {
            message: error.message,
            stack: error.stack
          });
          return [];
        }
      },
      // Get all available years with official data
      getAvailableOfficialYears: async () => {
        try {
          const url = '/api/data/yearlyOfficialData';
          console.log(`📡 Fetching available official years from: ${url}`);
          
          const response = await fetch(url);
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`📡 API Error (${response.status}):`, errorText);
            throw new Error(`Failed to fetch available years: ${response.status} ${response.statusText}`);
          }
          
          const result = await response.json();
          console.log(`📡 API Response for available years:`, {
            success: result.success,
            availableYears: result.availableYears,
            source: result.source
          });
          
          if (result.success) {
            console.log(`📡 ✅ Available official years:`, result.availableYears);
            return result.availableYears || [];
          }
          
          console.warn(`📡 ⚠️ API returned success=false for available years`);
          return [];
        } catch (error) {
          console.error(`📡 ❌ Error loading available official years:`, {
            message: error.message,
            stack: error.stack
          });
          return [];
        }
      },
      create: async (data) => {
        const response = await fetch('/api/data/estimates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to create estimate');
      },
      update: async (id, data) => {
        const response = await fetch('/api/data/estimates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to update estimate');
      },
      upsert: async (data, lookupField = 'lmn_estimate_id') => {
        const response = await fetch('/api/data/estimates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upsert', data: { estimate: data, lookupField } })
        });
        const result = await response.json();
        if (result.success) return { ...result.data, _action: result.action };
        throw new Error(result.error || 'Failed to upsert estimate');
      },
      filter: async (filters, sort) => {
        const data = await getData('estimates');
        let results = Array.isArray(data) ? [...data] : [];
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(estimate => {
            return Object.entries(filters).every(([key, value]) => {
              return estimate[key] === value;
            });
          });
        }
        if (sort) {
          const desc = sort.startsWith('-');
          const sortField = desc ? sort.substring(1) : sort;
          results.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            if (aVal < bVal) return desc ? 1 : -1;
            if (aVal > bVal) return desc ? -1 : 1;
            return 0;
          });
        }
        return results;
      },
    },
    Jobsite: {
      list: async (forceRefresh = false) => {
        const data = await getData('jobsites', forceRefresh);
        return Array.isArray(data) ? data : [];
      },
      create: async (data) => {
        const response = await fetch('/api/data/jobsites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to create jobsite');
      },
      update: async (id, data) => {
        const response = await fetch('/api/data/jobsites', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to update jobsite');
      },
      upsert: async (data, lookupField = 'lmn_jobsite_id') => {
        const response = await fetch('/api/data/jobsites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upsert', data: { jobsite: data, lookupField } })
        });
        const result = await response.json();
        if (result.success) return { ...result.data, _action: result.action };
        throw new Error(result.error || 'Failed to upsert jobsite');
      },
      filter: async (filters, sort) => {
        const data = await getData('jobsites');
        let results = Array.isArray(data) ? [...data] : [];
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(jobsite => {
            return Object.entries(filters).every(([key, value]) => {
              return jobsite[key] === value;
            });
          });
        }
        if (sort) {
          const desc = sort.startsWith('-');
          const sortField = desc ? sort.substring(1) : sort;
          results.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];
            if (aVal < bVal) return desc ? 1 : -1;
            if (aVal > bVal) return desc ? -1 : 1;
            return 0;
          });
        }
        return results;
      },
    },
    TaskComment: {
      list: async (taskId) => {
        const response = await fetch(`/api/data/taskComments?task_id=${taskId}`);
        const result = await response.json();
        if (result.success) return result.data || [];
        throw new Error(result.error || 'Failed to fetch task comments');
      },
      create: async (data) => {
        const response = await fetch('/api/data/taskComments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to create comment');
      },
      update: async (id, data) => {
        const response = await fetch('/api/data/taskComments', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to update comment');
      },
      delete: async (id) => {
        const response = await fetch(`/api/data/taskComments?id=${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.success) return true;
        throw new Error(result.error || 'Failed to delete comment');
      },
    },
    TaskAttachment: {
      list: async (taskId) => {
        const response = await fetch(`/api/data/taskAttachments?task_id=${taskId}`);
        const result = await response.json();
        if (result.success) return result.data || [];
        throw new Error(result.error || 'Failed to fetch task attachments');
      },
      upload: async (file, fileName, taskId, userId, userEmail, fileType) => {
        // Convert file to base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const response = await fetch('/api/upload/taskAttachment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: base64,
            fileName,
            taskId,
            userId,
            userEmail,
            fileType: fileType || file.type
          })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to upload attachment');
      },
      delete: async (id) => {
        const response = await fetch(`/api/data/taskAttachments?id=${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.success) return true;
        throw new Error(result.error || 'Failed to delete attachment');
      },
    },
    AccountAttachment: {
      list: async (accountId) => {
        const response = await fetch(`/api/data/accountAttachments?account_id=${accountId}`);
        const result = await response.json();
        if (result.success) return result.data || [];
        throw new Error(result.error || 'Failed to fetch account attachments');
      },
      upload: async (file, fileName, accountId, userId, userEmail, fileType) => {
        // Convert file to base64
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const response = await fetch('/api/upload/accountAttachment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: base64,
            fileName,
            accountId,
            userId,
            userEmail,
            fileType: fileType || file.type
          })
        });
        const result = await response.json();
        if (result.success) return result.data;
        throw new Error(result.error || 'Failed to upload attachment');
      },
      delete: async (id) => {
        const response = await fetch(`/api/data/accountAttachments?id=${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.success) return true;
        throw new Error(result.error || 'Failed to delete attachment');
      },
    },
  },
  auth: {
    me: async () => {
      // Use the helper function to avoid circular dependency
      return await getCurrentUser();
    },
    logout: () => {},
  },
  };
  
  return _base44Instance;
}

// Export a getter function to ensure lazy initialization
export const base44 = new Proxy({}, {
  get(target, prop) {
    const instance = createBase44Instance();
    return instance[prop];
  },
  set(target, prop, value) {
    const instance = createBase44Instance();
    instance[prop] = value;
    return true;
  },
  has(target, prop) {
    const instance = createBase44Instance();
    return prop in instance;
  },
  ownKeys(target) {
    const instance = createBase44Instance();
    return Object.keys(instance);
  },
  getOwnPropertyDescriptor(target, prop) {
    const instance = createBase44Instance();
    return Object.getOwnPropertyDescriptor(instance, prop);
  }
});

