# Demo Mode Guide

This CRM system includes a demo mode that uses mock data, allowing you to explore all features without setting up a database or API connections.

## Quick Start

### Option 1: Environment Variable (Recommended)

1. Create a `.env` file in the root directory:
```bash
VITE_DEMO_MODE=true
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Navigate to the login page and enter any email and password to access the demo.

### Option 2: Runtime Toggle

1. Start the development server:
```bash
npm run dev
```

2. Open your browser's developer console and run:
```javascript
localStorage.setItem('demoMode', 'true');
location.reload();
```

3. Navigate to the login page and enter any email and password.

## Features Available in Demo Mode

All CRM features are available with mock data:

- **Accounts Management**: View and manage customer accounts with revenue segments, status, and organization scores
- **Contact Management**: Manage contacts linked to accounts with roles and preferences
- **Interaction Tracking**: Log emails, calls, meetings, notes, and LinkedIn messages with sentiment tracking
- **Task Management**: Create and manage tasks with priorities, categories, and due dates
- **Sequence Automation**: Create multi-step outreach sequences for different account types
- **Scoring System**: Create weighted questionnaires to generate organization scores (0-100)
- **Sales Insights**: Track pain points, opportunities, and buying motivations
- **Research Notes**: Store research findings with source URLs
- **Win/Loss Tracking**: Track estimates and their outcomes
- **Notifications**: View task reminders and account notifications
- **Dashboard**: View overview statistics and recent activity

## Mock Data Included

The demo includes realistic sample data:

- **3 Accounts**: Acme Corporation, Tech Startup Inc, and Global Manufacturing Co
- **3 Contacts**: Linked to the accounts with various roles
- **2 Tasks**: Sample tasks with different priorities and statuses
- **2 Interactions**: Email and call interactions with sentiment tracking
- **1 Sequence**: Prospect outreach sequence with multiple steps
- **1 Sequence Enrollment**: Active enrollment example
- **3 Sales Insights**: Opportunities, pain points, and risk factors
- **3 Research Notes**: Company info, key personnel, and market research
- **12 Estimates**: Win/loss tracking examples across multiple accounts
- **1 Scorecard Template**: Default ICP scoring template
- **3 Scorecard Responses**: Completed scorecards for accounts
- **15 Users**: Sample team members with different roles
- **2 Notifications**: Task reminders and account notifications

## Data Persistence

In demo mode, all data changes are stored in browser memory. This means:

- ✅ Changes persist during your session
- ❌ Changes are lost when you refresh the page
- ❌ Changes are not shared between browser tabs/windows

To reset all data to the original mock data, open the browser console and run:
```javascript
localStorage.setItem('resetMockData', 'true');
location.reload();
```

## Disabling Demo Mode

To disable demo mode:

1. Remove `VITE_DEMO_MODE=true` from your `.env` file, or
2. Run in the browser console:
```javascript
localStorage.removeItem('demoMode');
location.reload();
```

## Building for Production with Demo Mode

To build a production version with demo mode enabled:

1. Set the environment variable:
```bash
VITE_DEMO_MODE=true npm run build
```

2. Or create a `.env.production` file:
```
VITE_DEMO_MODE=true
```

## Troubleshooting

### Demo mode not activating

- Check that `VITE_DEMO_MODE=true` is set in your `.env` file
- Verify in browser console: `localStorage.getItem('demoMode')` should return `'true'`
- Check browser console for any errors

### Data not persisting

- Demo mode uses in-memory storage, so data resets on page refresh
- This is expected behavior for demo mode
- To persist changes, you'll need to set up the full application with a database

### Login not working

- In demo mode, any email/password combination should work
- If login fails, check the browser console for errors
- Try clearing localStorage and reloading: `localStorage.clear(); location.reload();`

## Technical Details

### How It Works

1. **Mock API Service**: Intercepts all `/api/` fetch calls and returns mock data
2. **Mock Data Store**: In-memory storage that allows create/update/delete operations
3. **Demo Authentication**: Uses localStorage to simulate authentication state
4. **User Context**: Modified to support demo user profiles

### File Structure

- `src/api/mockData.js`: Contains all mock data definitions
- `src/api/mockApiService.js`: Intercepts API calls and returns mock data
- `src/contexts/UserContext.jsx`: Updated to support demo mode authentication
- `src/pages/Login.jsx`: Updated to support demo mode login

### API Endpoints Mocked

All `/api/data/*` endpoints are mocked:
- `/api/data/accounts`
- `/api/data/contacts`
- `/api/data/tasks`
- `/api/data/interactions`
- `/api/data/sequences`
- `/api/data/sequenceEnrollments`
- `/api/data/insights`
- `/api/data/notes`
- `/api/data/profiles`
- `/api/data/notifications`
- `/api/data/estimates`
- `/api/data/jobsites`
- `/api/data/templates`
- `/api/data/scorecards`
- `/api/data/taskComments`
- `/api/data/taskAttachments`
- `/api/data/accountAttachments`
- `/api/data/announcements`
- `/api/data/atRiskAccounts`
- `/api/data/yearlyOfficialData`
- `/api/data/userNotificationStates`
- `/api/data/notificationSnoozes`

## Support

For issues or questions about demo mode, please check:
1. Browser console for errors
2. Network tab to verify API calls are being intercepted
3. Application state in React DevTools
