# Setup Instructions

## 1. Install Dependencies

```bash
npm install
```

## 2. Set Up shadcn/ui Components

This project uses shadcn/ui components. You'll need to install them:

1. Install shadcn/ui CLI (if not already installed):
```bash
npx shadcn-ui@latest init
```

2. Install the required components:
```bash
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

The components will be installed in `src/components/ui/`.

## 3. Configure base44 Client

Update `src/api/base44Client.js` with your actual base44 configuration:

```javascript
import { Base44 } from '@base44/sdk';

export const base44 = new Base44({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-instance.base44.io'
});
```

## 4. Set Up base44 Entities

Make sure your base44 instance has the following entities configured:

- Account
- Contact
- Interaction
- Task
- Sequence
- SequenceEnrollment
- ScorecardTemplate
- ScorecardResponse

The schemas for these entities are provided in the code comments or should match the structure used in the components.

## 5. Start Development Server

```bash
npm run dev
```

## Notes

- The `createPageUrl` utility converts page names to kebab-case URLs (e.g., "AccountDetail" → "/account-detail")
- All routes are configured in `src/App.jsx`
- The Layout component handles navigation and page highlighting
- React Query is used for all data fetching and caching





