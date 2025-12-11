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

// Cache for Google Sheets data
let sheetDataCache = null;
let isLoadingSheetData = false;

// Expose cache clearing function
export function clearSheetDataCache() {
  sheetDataCache = null;
  isLoadingSheetData = false;
}

// Load data from Google Sheet
async function loadSheetData(forceRefresh = false) {
  if (isLoadingSheetData && !forceRefresh) {
    // Wait for existing load
    while (isLoadingSheetData) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return sheetDataCache;
  }
  
  if (sheetDataCache && !forceRefresh) {
    return sheetDataCache;
  }
  
  isLoadingSheetData = true;
  try {
    sheetDataCache = await getSheetData(forceRefresh);
  } catch (error) {
    console.error('Error loading Google Sheet data:', error);
    sheetDataCache = null;
  } finally {
    isLoadingSheetData = false;
  }
  
  return sheetDataCache;
}

// Helper to get data - uses Google Sheets only, returns empty array if not available
async function getData(entityType, forceRefresh = false) {
  try {
    const sheetData = await loadSheetData(forceRefresh);
    
    if (sheetData && sheetData[entityType] && sheetData[entityType].length > 0) {
      console.log(`Loaded ${sheetData[entityType].length} ${entityType} from Google Sheet`);
      return sheetData[entityType];
    }
  } catch (error) {
    console.warn(`Error loading ${entityType} from Google Sheet:`, error);
  }
  
  // Return empty array if no data available
  return [];
}

// Placeholder - replace with actual base44 SDK initialization
// Currently using Google Sheets data (with mock fallback)
export const base44 = {
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
        // In staging, we don't persist to mock data - return the data as if created
        const newAccount = { ...data, id: data.id || Date.now().toString() };
        return newAccount;
      },
      update: async (id, data) => {
        // In staging, we don't persist to mock data - return the data as if updated
        return { ...data, id };
      },
      // Upsert: Create if doesn't exist, update if it does
      upsert: async (data, lookupField = 'lmn_crm_id') => {
        // In staging, check Google Sheets data for existing record
        const sheetData = await loadSheetData();
        const accounts = sheetData?.accounts || [];
        const existing = accounts.find(a => 
          a[lookupField] && data[lookupField] && a[lookupField] === data[lookupField]
        );
        
        if (existing) {
          // Return as if updated
          return { ...existing, ...data, id: existing.id, _action: 'updated' };
        } else {
          // Return as if created
          const newAccount = { ...data, id: data.id || Date.now().toString() };
          return { ...newAccount, _action: 'created' };
        }
      },
    },
    Contact: {
      list: async (forceRefresh = false) => {
        const data = await getData('contacts', forceRefresh);
        return Array.isArray(data) ? data : [];
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
      create: async (data) => {
        // In staging, we don't persist to mock data - return the data as if created
        const newContact = { ...data, id: data.id || Date.now().toString() };
        return newContact;
      },
      update: async (id, data) => {
        // In staging, we don't persist to mock data - return the data as if updated
        return { ...data, id };
      },
      // Upsert: Create if doesn't exist, update if it does
      upsert: async (data, lookupField = 'lmn_contact_id') => {
        // In staging, check Google Sheets data for existing record
        const sheetData = await loadSheetData();
        const contacts = sheetData?.contacts || [];
        const existing = contacts.find(c => 
          c[lookupField] && data[lookupField] && c[lookupField] === data[lookupField]
        );
        
        if (existing) {
          // Return as if updated
          return { ...existing, ...data, id: existing.id, _action: 'updated' };
        } else {
          // Return as if created
          const newContact = { ...data, id: data.id || Date.now().toString() };
          return { ...newContact, _action: 'created' };
        }
      },
    },
    Interaction: {
      list: async () => {
        const data = await getData('interactions');
        return Array.isArray(data) ? data : [];
      },
      filter: async (filters, sort) => {
        const data = await getData('interactions');
        let results = Array.isArray(data) ? [...data] : [];
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
        // In staging, we don't persist to mock data - return the data as if created
        const newInteraction = { ...data, id: Date.now().toString() };
        return newInteraction;
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
        // In staging, we don't persist to mock data - return the data as if created
        const newTask = { ...data, id: Date.now().toString() };
        return newTask;
      },
      update: async (id, data) => {
        // In staging, we don't persist to mock data - return the data as if updated
        return { ...data, id };
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
    Estimate: {
      list: async () => {
        const sheetData = await loadSheetData();
        return sheetData?.estimates || [];
      },
      filter: async (filters, sort) => {
        const sheetData = await loadSheetData();
        let results = [...(sheetData?.estimates || [])];
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
      create: async (data) => {
        // In staging, we don't persist to mock data - return the data as if created
        const newEstimate = { ...data, id: data.id || Date.now().toString() };
        return newEstimate;
      },
      update: async (id, data) => {
        // In staging, we don't persist to mock data - return the data as if updated
        return { ...data, id };
      },
      upsert: async (data, lookupField = 'lmn_estimate_id') => {
        // In staging, we don't persist to mock data - return the data as if created/updated
        const newEstimate = { ...data, id: data.id || Date.now().toString() };
        return { ...newEstimate, _action: 'created' };
      },
    },
    Jobsite: {
      list: async () => {
        const sheetData = await loadSheetData();
        return sheetData?.jobsites || [];
      },
      filter: async (filters, sort) => {
        const sheetData = await loadSheetData();
        let results = [...(sheetData?.jobsites || [])];
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
      create: async (data) => {
        // In staging, we don't persist to mock data - return the data as if created
        const newJobsite = { ...data, id: data.id || Date.now().toString() };
        return newJobsite;
      },
      update: async (id, data) => {
        // In staging, we don't persist to mock data - return the data as if updated
        return { ...data, id };
      },
      upsert: async (data, lookupField = 'lmn_jobsite_id') => {
        // In staging, we don't persist to mock data - return the data as if created/updated
        const newJobsite = { ...data, id: data.id || Date.now().toString() };
        return { ...newJobsite, _action: 'created' };
      },
    },
  },
  auth: {
    me: async () => ({ email: 'user@example.com', id: '1' }),
    logout: () => {},
  },
};

