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

// Import Google Sheets service
import { getSheetData } from '../services/googleSheetsService';

// For preview: Import mock data as fallback
import { 
  mockAccounts, 
  mockContacts, 
  mockTasks, 
  mockInteractions,
  mockScorecardTemplates,
  mockScorecardResponses,
  mockSequences,
  mockSequenceEnrollments,
  mockSalesInsights,
  mockResearchNotes,
  mockUsers,
  mockNotifications
} from './mockData';

// Cache for Google Sheets data
let sheetDataCache = null;
let isLoadingSheetData = false;

// Load data from Google Sheet
async function loadSheetData() {
  if (isLoadingSheetData) {
    // Wait for existing load
    while (isLoadingSheetData) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return sheetDataCache;
  }
  
  if (sheetDataCache) {
    return sheetDataCache;
  }
  
  isLoadingSheetData = true;
  try {
    sheetDataCache = await getSheetData();
  } catch (error) {
    console.error('Error loading Google Sheet data, using mock data:', error);
    sheetDataCache = null;
  } finally {
    isLoadingSheetData = false;
  }
  
  return sheetDataCache;
}

// Helper to get data - tries Google Sheets first, falls back to mock
async function getData(entityType) {
  try {
    const sheetData = await loadSheetData();
    
    if (sheetData && sheetData[entityType] && sheetData[entityType].length > 0) {
      console.log(`Loaded ${sheetData[entityType].length} ${entityType} from Google Sheet`);
      return sheetData[entityType];
    }
  } catch (error) {
    console.warn(`Error loading ${entityType} from Google Sheet, using mock data:`, error);
  }
  
  // Fallback to mock data
  const mockMap = {
    'scorecards': mockScorecardResponses,
    'contacts': mockContacts,
    'insights': mockSalesInsights,
    'notes': mockResearchNotes,
    'accounts': mockAccounts,
    'tasks': mockTasks,
    'interactions': mockInteractions,
    'templates': mockScorecardTemplates,
    'sequences': mockSequences,
    'enrollments': mockSequenceEnrollments,
    'sequenceEnrollments': mockSequenceEnrollments,
    'notifications': mockNotifications,
    'users': mockUsers,
    'lookupValues': []
  };
  
  return mockMap[entityType] || [];
}

// Placeholder - replace with actual base44 SDK initialization
// Currently using Google Sheets data (with mock fallback)
export const base44 = {
  entities: {
    Account: {
      list: async () => {
        const data = await getData('accounts');
        return Array.isArray(data) ? data : [];
      },
      filter: async (filters, sort) => {
        const data = await getData('accounts');
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
        const newAccount = { ...data, id: data.id || Date.now().toString() };
        mockAccounts.push(newAccount);
        return newAccount;
      },
      update: async (id, data) => {
        const index = mockAccounts.findIndex(a => a.id === id);
        if (index !== -1) {
          mockAccounts[index] = { ...mockAccounts[index], ...data };
          return mockAccounts[index];
        }
        return data;
      },
      // Upsert: Create if doesn't exist, update if it does
      upsert: async (data, lookupField = 'lmn_crm_id') => {
        // Find existing by lookup field
        const existing = mockAccounts.find(a => 
          a[lookupField] && data[lookupField] && a[lookupField] === data[lookupField]
        );
        
        if (existing) {
          // Update existing
          const index = mockAccounts.findIndex(a => a.id === existing.id);
          mockAccounts[index] = { ...existing, ...data, id: existing.id };
          return { ...mockAccounts[index], _action: 'updated' };
        } else {
          // Create new
          const newAccount = { ...data, id: data.id || Date.now().toString() };
          mockAccounts.push(newAccount);
          return { ...newAccount, _action: 'created' };
        }
      },
    },
    Contact: {
      list: async () => {
        const data = await getData('contacts');
        return Array.isArray(data) ? data : [];
      },
      filter: async (filters, sort) => {
        const data = await getData('contacts');
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
      create: async (data) => {
        const newContact = { ...data, id: data.id || Date.now().toString() };
        mockContacts.push(newContact);
        return newContact;
      },
      update: async (id, data) => {
        const index = mockContacts.findIndex(c => c.id === id);
        if (index !== -1) {
          mockContacts[index] = { ...mockContacts[index], ...data };
          return mockContacts[index];
        }
        return data;
      },
      // Upsert: Create if doesn't exist, update if it does
      upsert: async (data, lookupField = 'lmn_contact_id') => {
        // Find existing by lookup field
        const existing = mockContacts.find(c => 
          c[lookupField] && data[lookupField] && c[lookupField] === data[lookupField]
        );
        
        if (existing) {
          // Update existing
          const index = mockContacts.findIndex(c => c.id === existing.id);
          mockContacts[index] = { ...existing, ...data, id: existing.id };
          return { ...mockContacts[index], _action: 'updated' };
        } else {
          // Create new
          const newContact = { ...data, id: data.id || Date.now().toString() };
          mockContacts.push(newContact);
          return { ...newContact, _action: 'created' };
        }
      },
    },
    Interaction: {
      list: async () => mockInteractions,
      filter: async (filters, sort) => {
        let results = [...mockInteractions];
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
        const newInteraction = { ...data, id: Date.now().toString() };
        mockInteractions.push(newInteraction);
        return newInteraction;
      },
    },
    Task: {
      list: async (sort) => {
        let results = [...mockTasks];
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
        let results = [...mockTasks];
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
        const newTask = { ...data, id: Date.now().toString() };
        mockTasks.push(newTask);
        return newTask;
      },
      update: async (id, data) => {
        const index = mockTasks.findIndex(t => t.id === id);
        if (index !== -1) {
          mockTasks[index] = { ...mockTasks[index], ...data };
          return mockTasks[index];
        }
        return data;
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
        const newSequence = { ...data, id: Date.now().toString() };
        mockSequences.push(newSequence);
        return newSequence;
      },
      update: async (id, data) => {
        const index = mockSequences.findIndex(s => s.id === id);
        if (index !== -1) {
          mockSequences[index] = { ...mockSequences[index], ...data };
          return mockSequences[index];
        }
        return data;
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
        const newEnrollment = { ...data, id: Date.now().toString() };
        mockSequenceEnrollments.push(newEnrollment);
        return newEnrollment;
      },
      update: async (id, data) => {
        const index = mockSequenceEnrollments.findIndex(e => e.id === id);
        if (index !== -1) {
          mockSequenceEnrollments[index] = { ...mockSequenceEnrollments[index], ...data };
          return mockSequenceEnrollments[index];
        }
        return data;
      },
    },
    ScorecardTemplate: {
      list: async () => mockScorecardTemplates,
      create: async (data) => {
        const newTemplate = { ...data, id: Date.now().toString() };
        mockScorecardTemplates.push(newTemplate);
        return newTemplate;
      },
      update: async (id, data) => {
        const index = mockScorecardTemplates.findIndex(t => t.id === id);
        if (index !== -1) {
          mockScorecardTemplates[index] = { ...mockScorecardTemplates[index], ...data };
          return mockScorecardTemplates[index];
        }
        return data;
      },
    },
    ScorecardResponse: {
      list: async () => {
        const data = await getData('scorecards');
        return Array.isArray(data) ? data : [];
      },
      filter: async (filters, sort) => {
        const data = await getData('scorecards');
        let results = Array.isArray(data) ? [...data] : [];
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(response => {
            return Object.entries(filters).every(([key, value]) => {
              return response[key] === value;
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
        const newResponse = { ...data, id: Date.now().toString() };
        mockScorecardResponses.push(newResponse);
        return newResponse;
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
      list: async () => mockUsers,
      filter: async (filters) => {
        let results = [...mockUsers];
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(user => {
            return Object.entries(filters).every(([key, value]) => {
              return user[key] === value;
            });
          });
        }
        return results;
      },
      get: async (id) => {
        return mockUsers.find(u => u.id === id);
      },
      create: async (data) => {
        const newUser = { ...data, id: Date.now().toString(), created_at: new Date().toISOString() };
        mockUsers.push(newUser);
        return newUser;
      },
      update: async (id, data) => {
        const index = mockUsers.findIndex(u => u.id === id);
        if (index !== -1) {
          mockUsers[index] = { ...mockUsers[index], ...data };
          return mockUsers[index];
        }
        return data;
      },
    },
    Notification: {
      list: async () => {
        const data = await getData('notifications');
        return Array.isArray(data) ? data : mockNotifications;
      },
      filter: async (filters, sort) => {
        let results = [...mockNotifications];
        if (filters && Object.keys(filters).length > 0) {
          results = results.filter(notification => {
            return Object.entries(filters).every(([key, value]) => {
              return notification[key] === value;
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
        const newNotification = { 
          ...data, 
          id: Date.now().toString(),
          is_read: false,
          created_at: new Date().toISOString()
        };
        mockNotifications.push(newNotification);
        return newNotification;
      },
      update: async (id, data) => {
        const index = mockNotifications.findIndex(n => n.id === id);
        if (index !== -1) {
          mockNotifications[index] = { ...mockNotifications[index], ...data };
          return mockNotifications[index];
        }
        return data;
      },
      markAsRead: async (id) => {
        const index = mockNotifications.findIndex(n => n.id === id);
        if (index !== -1) {
          mockNotifications[index].is_read = true;
          return mockNotifications[index];
        }
        return null;
      },
      markAllAsRead: async (userId) => {
        mockNotifications.forEach(n => {
          if (n.user_id === userId) {
            n.is_read = true;
          }
        });
        return mockNotifications.filter(n => n.user_id === userId);
      },
    },
  },
  auth: {
    me: async () => ({ email: 'user@example.com', id: '1' }),
    logout: () => {},
  },
};

