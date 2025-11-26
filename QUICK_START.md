# Quick Start Guide - Preview the CRM

## Option 1: Full Setup (Recommended for Testing)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set Up shadcn/ui Components
```bash
# Initialize shadcn/ui (if not already done)
npx shadcn-ui@latest init

# Install required components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add select
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add radio-group
```

### Step 3: Create Mock Data File
Create `src/api/mockData.js` for preview (see below)

### Step 4: Run Development Server
```bash
npm run dev
```

Open http://localhost:5173 in your browser

---

## Option 2: Quick Preview with Mock Data

To preview without setting up base44, we can use mock data. Here's how:

### 1. Create Mock Data
See `src/api/mockData.js` below - this provides sample data for preview

### 2. Update base44Client.js Temporarily
Switch the base44 client to use mock data for preview (see instructions below)

### 3. Run Dev Server
```bash
npm install
npm run dev
```

---

## Creating Mock Data File

Create `src/api/mockData.js`:

```javascript
// Mock data for preview
export const mockAccounts = [
  {
    id: '1',
    name: 'Acme Corporation',
    account_type: 'customer',
    status: 'active',
    revenue_segment: 'enterprise',
    annual_revenue: 500000,
    industry: 'Technology',
    organization_score: 85,
    last_interaction_date: '2025-01-10',
    renewal_date: '2025-12-31'
  },
  {
    id: '2',
    name: 'Tech Startup Inc',
    account_type: 'prospect',
    status: 'negotiating',
    revenue_segment: 'startup',
    annual_revenue: 100000,
    industry: 'SaaS',
    organization_score: 72,
    last_interaction_date: '2025-01-05',
  }
];

export const mockContacts = [
  {
    id: '1',
    account_id: '1',
    account_name: 'Acme Corporation',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@acme.com',
    phone: '555-0100',
    title: 'CEO',
    role: 'decision_maker'
  }
];

export const mockScorecardTemplates = [
  {
    id: '1',
    name: 'ICP Weighted Scorecard',
    description: 'Ideal Customer Profile scoring',
    is_active: true,
    pass_threshold: 70,
    total_possible_score: 100,
    questions: [
      {
        question_text: 'Client Operations Region',
        weight: 2,
        answer_type: 'categorical',
        category: 'demographics',
        section: 'Corporate Demographic Information'
      },
      {
        question_text: 'Can someone introduce us?',
        weight: 1,
        answer_type: 'yes_no',
        category: 'demographics',
        section: 'Corporate Demographic Information'
      },
      {
        question_text: 'Located in Service Area (Calgary & Surrounding)',
        weight: 20,
        answer_type: 'yes_no',
        category: 'requirements',
        section: 'Non-Negotiables'
      },
      {
        question_text: 'Annual Budget (< $200K)',
        weight: 15,
        answer_type: 'yes_no',
        category: 'requirements',
        section: 'Non-Negotiables'
      }
    ]
  }
];
```

---

## Temporarily Using Mock Data

To preview without base44 setup, update `src/api/base44Client.js`:

```javascript
import { mockAccounts, mockContacts, mockScorecardTemplates } from './mockData';

export const base44 = {
  entities: {
    Account: {
      list: async () => mockAccounts,
      filter: async (filters) => {
        if (filters?.account_id) {
          return mockAccounts.filter(a => a.id === filters.account_id);
        }
        return mockAccounts;
      },
      create: async (data) => ({ ...data, id: Date.now().toString() }),
      update: async (id, data) => ({ ...data, id }),
    },
    Contact: {
      list: async () => mockContacts,
      filter: async (filters) => {
        if (filters?.account_id) {
          return mockContacts.filter(c => c.account_id === filters.account_id);
        }
        return mockContacts;
      },
      create: async (data) => ({ ...data, id: Date.now().toString() }),
    },
    ScorecardTemplate: {
      list: async () => mockScorecardTemplates,
      create: async (data) => ({ ...data, id: Date.now().toString() }),
      update: async (id, data) => ({ ...data, id }),
    },
    // ... add other entities with mock data
  },
  auth: {
    me: async () => ({ email: 'preview@example.com' }),
    logout: () => {},
  },
};
```

---

## Preview Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] shadcn/ui components installed
- [ ] Mock data file created
- [ ] base44Client.js updated to use mocks (optional)
- [ ] Dev server running (`npm run dev`)
- [ ] Browser open to http://localhost:5173

---

## What You'll See

Once running, you can:
1. Navigate to Dashboard - see stats and alerts
2. View Accounts - see account cards with scores
3. View Account Detail - see full account with tabs
4. Complete Scorecard - see Google Sheet-style form
5. Export to CSV - download CSV file
6. View Scorecard History - see historical scorecards with PASS/FAIL

---

## Troubleshooting

### Port Already in Use
```bash
npm run dev -- --port 3000
```

### shadcn/ui Components Missing
Make sure to run `npx shadcn-ui@latest init` first, then add components

### Mock Data Not Showing
Check that `base44Client.js` is importing and using mock data correctly

---

## Next Steps After Preview

1. Configure base44 client with real API credentials
2. Set up actual base44 entities
3. Test with real data
4. Customize styling/branding
5. Deploy to production





