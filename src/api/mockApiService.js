/**
 * Mock API Service
 * Intercepts fetch calls and returns mock data when demo mode is enabled
 */

import {
  mockAccounts,
  mockContacts,
  mockTasks,
  mockInteractions,
  mockSequences,
  mockSequenceEnrollments,
  mockSalesInsights,
  mockResearchNotes,
  mockUsers,
  mockNotifications,
  mockEstimates,
  mockJobsites,
  mockProfiles,
  mockTemplates,
  mockScorecards,
  mockTaskComments,
  mockTaskAttachments,
  mockAccountAttachments,
  mockAnnouncements,
  mockAtRiskAccounts,
  mockYearlyOfficialData,
  mockUserNotificationStates,
  mockNotificationSnoozes
} from './mockData';

// Check if demo mode is enabled
export const isDemoMode = () => {
  // Check localStorage first (for runtime toggle)
  const localStorageDemo = localStorage.getItem('demoMode');
  if (localStorageDemo !== null) {
    return localStorageDemo === 'true';
  }
  // Check environment variable (for build-time toggle)
  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    return true;
  }
  // Auto-enable demo mode if Supabase is not configured
  const hasSupabaseUrl = !!import.meta.env.VITE_SUPABASE_URL;
  const hasSupabaseKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!hasSupabaseUrl || !hasSupabaseKey) {
    // Auto-enable demo mode and save to localStorage
    localStorage.setItem('demoMode', 'true');
    return true;
  }
  return false;
};

// In-memory storage for mock data (allows mutations)
let mockDataStore = {
  accounts: [...mockAccounts],
  contacts: [...mockContacts],
  tasks: [...mockTasks],
  interactions: [...mockInteractions],
  sequences: [...mockSequences],
  sequenceEnrollments: [...mockSequenceEnrollments],
  insights: [...mockSalesInsights],
  notes: [...mockResearchNotes],
  users: [...mockUsers],
  notifications: [...mockNotifications],
  estimates: [...mockEstimates],
  jobsites: [...mockJobsites],
  profiles: [...mockProfiles],
  templates: [...mockTemplates],
  scorecards: [...mockScorecards],
  taskComments: [...mockTaskComments],
  taskAttachments: [...mockTaskAttachments],
  accountAttachments: [...mockAccountAttachments],
  announcements: [...mockAnnouncements],
  atRiskAccounts: [...mockAtRiskAccounts],
  userNotificationStates: [...mockUserNotificationStates],
  notificationSnoozes: [...mockNotificationSnoozes]
};

// Generate a new ID
const generateId = () => {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
};

// Helper to filter data
const filterData = (data, filters) => {
  if (!filters || Object.keys(filters).length === 0) {
    return data;
  }
  return data.filter(item => {
    return Object.entries(filters).every(([key, value]) => {
      if (value === null || value === undefined) {
        return item[key] === null || item[key] === undefined;
      }
      return String(item[key]) === String(value);
    });
  });
};

// Helper to sort data
const sortData = (data, sort) => {
  if (!sort) return data;
  const desc = sort.startsWith('-');
  const sortField = desc ? sort.substring(1) : sort;
  return [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (aVal < bVal) return desc ? 1 : -1;
    if (aVal > bVal) return desc ? -1 : 1;
    return 0;
  });
};

// Mock API handler
export const mockApiHandler = async (url, options = {}) => {
  const method = options.method || 'GET';
  const urlObj = new URL(url, window.location.origin);
  const pathname = urlObj.pathname;
  const searchParams = urlObj.searchParams;

  // Extract entity type from path
  const match = pathname.match(/\/api\/data\/([^/]+)/);
  if (!match) {
    // Handle other API endpoints
    if (pathname.startsWith('/api/upload/')) {
      return handleUpload(pathname, options);
    }
    return { success: false, error: 'Unknown endpoint' };
  }

  const entityType = match[1];
  const storeKey = getStoreKey(entityType);

  // Handle different HTTP methods
  switch (method) {
    case 'GET':
      return handleGet(entityType, storeKey, searchParams);
    case 'POST':
      return handlePost(entityType, storeKey, options.body, searchParams);
    case 'PUT':
      return handlePut(entityType, storeKey, options.body, searchParams);
    case 'DELETE':
      return handleDelete(entityType, storeKey, searchParams);
    default:
      return { success: false, error: `Method ${method} not supported` };
  }
};

// Map entity types to store keys
const getStoreKey = (entityType) => {
  const mapping = {
    accounts: 'accounts',
    contacts: 'contacts',
    tasks: 'tasks',
    interactions: 'interactions',
    sequences: 'sequences',
    sequenceEnrollments: 'sequenceEnrollments',
    insights: 'insights',
    notes: 'notes',
    profiles: 'profiles',
    notifications: 'notifications',
    estimates: 'estimates',
    jobsites: 'jobsites',
    templates: 'templates',
    scorecards: 'scorecards',
    taskComments: 'taskComments',
    taskAttachments: 'taskAttachments',
    accountAttachments: 'accountAttachments',
    announcements: 'announcements',
    atRiskAccounts: 'atRiskAccounts',
    userNotificationStates: 'userNotificationStates',
    notificationSnoozes: 'notificationSnoozes',
    yearlyOfficialData: 'yearlyOfficialData'
  };
  return mapping[entityType] || entityType;
};

// Handle GET requests
const handleGet = (entityType, storeKey, searchParams) => {
  let data = mockDataStore[storeKey] || [];

  // Special handling for yearlyOfficialData
  if (entityType === 'yearlyOfficialData') {
    const year = searchParams.get('year');
    if (year) {
      const yearData = mockYearlyOfficialData[year] || [];
      return {
        success: true,
        data: yearData,
        count: yearData.length,
        source: 'mock',
        availableYears: Object.keys(mockYearlyOfficialData)
      };
    }
    return {
      success: true,
      availableYears: Object.keys(mockYearlyOfficialData),
      source: 'mock'
    };
  }

  // Special handling for templates
  if (entityType === 'templates') {
    const isDefault = searchParams.get('is_default') === 'true';
    const isCurrent = searchParams.get('is_current') === 'true';
    const includeVersions = searchParams.get('include_versions') === 'true';

    if (isDefault && isCurrent) {
      const defaultTemplate = data.find(t => t.is_default && t.is_current_version);
      return {
        success: true,
        data: defaultTemplate ? [defaultTemplate] : []
      };
    }

    if (includeVersions) {
      return { success: true, data };
    }

    // Return only current versions by default
    data = data.filter(t => t.is_current_version !== false);
  }

  // Filter by query params
  const filters = {};
  searchParams.forEach((value, key) => {
    if (key !== 'include_versions' && key !== 'is_default' && key !== 'is_current' && key !== 'limit') {
      filters[key] = value;
    }
  });

  if (Object.keys(filters).length > 0) {
    data = filterData(data, filters);
  }

  // Special handling for taskComments and attachments
  if (entityType === 'taskComments' || entityType === 'taskAttachments') {
    const taskId = searchParams.get('task_id');
    if (taskId) {
      data = data.filter(item => item.task_id === taskId);
    }
  }

  if (entityType === 'accountAttachments') {
    const accountId = searchParams.get('account_id');
    if (accountId) {
      data = data.filter(item => item.account_id === accountId);
    }
  }

  // Limit results if specified
  const limit = searchParams.get('limit');
  if (limit) {
    data = data.slice(0, parseInt(limit));
  }

  return {
    success: true,
    data: Array.isArray(data) ? data : []
  };
};

// Handle POST requests
const handlePost = (entityType, storeKey, body, searchParams) => {
  if (!body) {
    return { success: false, error: 'No body provided' };
  }

  const data = typeof body === 'string' ? JSON.parse(body) : body;
  const action = data.action;

  if (action === 'create') {
    const newItem = {
      ...data.data,
      id: generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockDataStore[storeKey].push(newItem);
    return { success: true, data: newItem };
  }

  if (action === 'upsert') {
    const { account, contact, estimate, jobsite, lookupField } = data.data || {};
    const item = account || contact || estimate || jobsite;
    const lookupValue = item[lookupField || 'id'];

    const existingIndex = mockDataStore[storeKey].findIndex(
      i => i[lookupField || 'id'] === lookupValue
    );

    if (existingIndex >= 0) {
      mockDataStore[storeKey][existingIndex] = {
        ...mockDataStore[storeKey][existingIndex],
        ...item,
        updated_at: new Date().toISOString()
      };
      return {
        success: true,
        data: mockDataStore[storeKey][existingIndex],
        action: 'update'
      };
    } else {
      const newItem = {
        ...item,
        id: generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      mockDataStore[storeKey].push(newItem);
      return {
        success: true,
        data: newItem,
        action: 'create'
      };
    }
  }

  if (action === 'update_with_version') {
    // Handle template versioning
    const { templateId, templateData } = data.data;
    const existing = mockDataStore.templates.find(t => t.id === templateId);
    if (existing) {
      const newVersion = {
        ...templateData,
        id: generateId(),
        version_number: (existing.version_number || 1) + 1,
        parent_template_id: existing.parent_template_id || existing.id,
        is_current_version: true,
        created_at: new Date().toISOString()
      };
      // Mark old version as not current
      existing.is_current_version = false;
      mockDataStore.templates.push(newVersion);
      return { success: true, data: newVersion };
    }
  }

  if (action === 'mark_all_read') {
    // Mark all notifications as read
    const { user_id } = data.data;
    mockDataStore.notifications.forEach(n => {
      if (n.user_id === user_id) {
        n.is_read = true;
      }
    });
    mockDataStore.userNotificationStates.forEach(n => {
      if (n.user_id === user_id) {
        n.is_read = true;
      }
    });
    return { success: true };
  }

  // Default: create new item
  const newItem = {
    ...data,
    id: generateId(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  mockDataStore[storeKey].push(newItem);
  return { success: true, data: newItem };
};

// Handle PUT requests
const handlePut = (entityType, storeKey, body, searchParams) => {
  if (!body) {
    return { success: false, error: 'No body provided' };
  }

  const data = typeof body === 'string' ? JSON.parse(body) : body;
  const { id, ...updateData } = data;

  if (!id) {
    return { success: false, error: 'No ID provided' };
  }

  const index = mockDataStore[storeKey].findIndex(item => item.id === id);
  if (index === -1) {
    return { success: false, error: 'Item not found' };
  }

  mockDataStore[storeKey][index] = {
    ...mockDataStore[storeKey][index],
    ...updateData,
    updated_at: new Date().toISOString()
  };

  return { success: true, data: mockDataStore[storeKey][index] };
};

// Handle DELETE requests
const handleDelete = (entityType, storeKey, searchParams) => {
  const id = searchParams.get('id');
  if (!id) {
    return { success: false, error: 'No ID provided' };
  }

  const index = mockDataStore[storeKey].findIndex(item => item.id === id);
  if (index === -1) {
    return { success: false, error: 'Item not found' };
  }

  mockDataStore[storeKey].splice(index, 1);
  return { success: true, message: 'Item deleted' };
};

// Handle upload requests
const handleUpload = (pathname, options) => {
  const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
  const { file, fileName, taskId, accountId, userId, userEmail, fileType } = body;

  const attachment = {
    id: generateId(),
    file_name: fileName,
    file_url: `https://example.com/attachments/${fileName}`,
    file_type: fileType || 'application/octet-stream',
    file_size: file ? file.length : 0,
    uploaded_by: userEmail || userId,
    uploaded_at: new Date().toISOString()
  };

  if (taskId) {
    attachment.task_id = taskId;
    mockDataStore.taskAttachments.push(attachment);
  } else if (accountId) {
    attachment.account_id = accountId;
    mockDataStore.accountAttachments.push(attachment);
  }

  return { success: true, data: attachment };
};

// Intercept fetch calls
const originalFetch = window.fetch;
window.fetch = async function(url, options = {}) {
  // Only intercept if demo mode is enabled and URL matches API pattern
  if (isDemoMode() && typeof url === 'string' && url.includes('/api/')) {
    console.log(`[Mock API] ${options.method || 'GET'} ${url}`);
    try {
      const result = await mockApiHandler(url, options);
      return new Response(JSON.stringify(result), {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('[Mock API] Error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }), {
        status: 500,
        statusText: 'Internal Server Error',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }

  // Use original fetch for non-API calls or when demo mode is disabled
  return originalFetch.apply(this, arguments);
};

// Export function to reset mock data
export const resetMockData = () => {
  mockDataStore = {
    accounts: [...mockAccounts],
    contacts: [...mockContacts],
    tasks: [...mockTasks],
    interactions: [...mockInteractions],
    sequences: [...mockSequences],
    sequenceEnrollments: [...mockSequenceEnrollments],
    insights: [...mockSalesInsights],
    notes: [...mockResearchNotes],
    users: [...mockUsers],
    notifications: [...mockNotifications],
    estimates: [...mockEstimates],
    jobsites: [...mockJobsites],
    profiles: [...mockProfiles],
    templates: [...mockTemplates],
    scorecards: [...mockScorecards],
    taskComments: [...mockTaskComments],
    taskAttachments: [...mockTaskAttachments],
    accountAttachments: [...mockAccountAttachments],
    announcements: [...mockAnnouncements],
    atRiskAccounts: [...mockAtRiskAccounts],
    userNotificationStates: [...mockUserNotificationStates],
    notificationSnoozes: [...mockNotificationSnoozes]
  };
};
