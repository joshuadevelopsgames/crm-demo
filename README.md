# CRM System - Complete User Guide

A comprehensive Customer Relationship Management system built with React, integrated with Google Sheets for seamless data management.

## 📚 Documentation

- **[Complete User Guide](./USER_GUIDE.md)** - Comprehensive guide on how to use the system
- **[Demo Mode Guide](./DEMO_MODE.md)** - Run the CRM with mock data (no setup required!)
- **[Google Sheets Setup](./GOOGLE_SHEETS_QUICK_SETUP.md)** - Quick setup for Google Sheets integration
- **[Sheet to CRM Mapping](./SHEET_TO_CRM_MAPPING.md)** - How Google Sheet tabs map to CRM features
- **[Mobile App Setup](./MOBILE_APP_SETUP.md)** - Build iOS and Android apps with Capacitor

## Features

- **Account Management**: Track companies/organizations with revenue segments, status, and organization scores
- **Contact Management**: Manage contacts linked to accounts with roles and preferences
- **Interaction Tracking**: Log emails, calls, meetings, notes, and LinkedIn messages with sentiment tracking
- **Task Management**: Create and manage tasks with priorities, categories, and due dates
- **Sequence Automation**: Create multi-step outreach sequences for different account types
- **Scoring System**: Create weighted questionnaires to generate organization scores (0-100)
- **Sales Insights**: Track pain points, opportunities, and buying motivations
- **Research Notes**: Store research findings with source URLs
- **Google Sheets Integration**: Automatic data sync from your Google Sheet

## Tech Stack

- React 18
- React Router v6
- React Query (@tanstack/react-query)
- base44 API Client
- shadcn/ui components
- Tailwind CSS
- date-fns
- Vite
- **Capacitor** - Mobile app support (iOS & Android)

## Setup

### Quick Start with Demo Mode (Recommended for Testing)

1. Install dependencies:
```bash
npm install
```

2. Enable demo mode by creating a `.env` file:
```bash
VITE_DEMO_MODE=true
```

3. Start development server:
```bash
npm run dev
```

4. Navigate to the login page and enter any email/password to access the demo with mock data.

See **[Demo Mode Guide](./DEMO_MODE.md)** for more details.

### Full Setup (Production)

1. Install dependencies:
```bash
npm install
```

2. Configure base44 client:
   - Update `src/api/base44Client.js` with your base44 instance configuration
   - Add your API key and base URL

3. Configure environment variables (see `.env.example` for required variables)

4. Start development server:
```bash
npm run dev
```

## Mobile App

This CRM can be built as a native mobile app for iOS and Android using Capacitor. The desktop website remains unchanged - mobile optimizations are separate.

**Quick Start:**
```bash
# Build web app
npm run build

# Sync to native projects
npm run cap:sync

# Open in Xcode (iOS) or Android Studio
npm run cap:ios
# or
npm run cap:android
```

See **[Mobile App Setup Guide](./MOBILE_APP_SETUP.md)** for detailed instructions.

## Project Structure

```
src/
├── api/
│   └── base44Client.js      # base44 API client configuration
├── components/
│   ├── Layout.jsx            # Main layout with navigation
│   └── account/              # Account-related components
│       ├── InteractionTimeline.jsx
│       ├── ContactsList.jsx
│       ├── AccountScore.jsx
│       ├── AddInteractionDialog.jsx
│       └── EditAccountDialog.jsx
├── pages/
│   ├── Dashboard.jsx
│   ├── Accounts.jsx
│   ├── AccountDetail.jsx
│   ├── Contacts.jsx
│   ├── Tasks.jsx
│   ├── Sequences.jsx
│   ├── Scoring.jsx
│   └── TakeScorecard.jsx
├── utils/
│   └── index.js              # Utility functions
├── App.jsx                   # Main app with routing
├── main.jsx                  # Entry point
└── index.css                 # Global styles
```

## Notes

- The base44 client is currently a placeholder. You'll need to configure it with your actual base44 SDK.
- shadcn/ui components need to be installed separately. See: https://ui.shadcn.com/
- Make sure to set up your base44 entities according to the schemas provided.

