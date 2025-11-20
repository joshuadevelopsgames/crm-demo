# Preview Your CRM 🎉

## Quick Start (3 Steps)

### 1. Install Dependencies
```bash
cd /Users/joshua/LECRM
npm install
```

### 2. Set Up UI Components

The project uses shadcn/ui components. You'll need to install them:

```bash
# Initialize shadcn/ui (choose your options - defaults work fine)
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

### 3. Run Development Server
```bash
npm run dev
```

Then open **http://localhost:5173** in your browser! 🚀

---

## What's Included for Preview

✅ **Mock Data Already Set Up** - The system is configured with sample data:
- 3 sample accounts (Acme Corporation, Tech Startup, Global Manufacturing)
- Sample contacts linked to accounts
- Sample tasks and interactions
- Sample scorecard template
- Sample sequences

✅ **All Features Work** - You can:
- Navigate through all pages
- View accounts and details
- Complete scorecards (with Google Sheet-style form)
- Export to CSV
- See pass/fail status
- View historical scorecards
- Create/edit accounts, contacts, tasks
- View interactions timeline

---

## What You'll See

1. **Dashboard** (`/` or `/dashboard`)
   - Stats cards (Active Accounts, Contacts, Tasks, At Risk)
   - Alerts for neglected accounts, renewals, overdue tasks
   - Active sequences

2. **Accounts** (`/accounts`)
   - List of accounts with scores
   - Filter by type, segment
   - Search functionality
   - Click any account to see details

3. **Account Detail** (`/account-detail?id=1`)
   - Full account information
   - Tabs for Interactions, Contacts, Scoring
   - Scorecard history with PASS/FAIL
   - Export buttons on historical scorecards

4. **Scorecard Form** (`/take-scorecard?accountId=1&templateId=1`)
   - Google Sheet-style form layout
   - Questions grouped by sections
   - Sub-totals per section
   - Total score with PASS/FAIL
   - Export to CSV button

5. **Scoring Templates** (`/scoring`)
   - Create/edit scorecard templates
   - Add questions with sections
   - Set pass threshold

6. **Other Pages**
   - Contacts (`/contacts`)
   - Tasks (`/tasks`)
   - Sequences (`/sequences`)

---

## Troubleshooting

### Port Already in Use
```bash
npm run dev -- --port 3000
```

### Components Not Found
Make sure you've run `npx shadcn-ui@latest init` and installed all components listed above.

### Mock Data Not Showing
The mock data is already configured in `src/api/base44Client.js`. It should work automatically.

### Styling Looks Off
Make sure Tailwind CSS is configured. Check `tailwind.config.js` and `postcss.config.js` are set up correctly.

---

## Testing the Scorecard System

1. Go to **Accounts** page
2. Click on **Acme Corporation** (first account)
3. Go to **Scoring** tab
4. Click **Complete Scorecard** on "ICP Weighted Scorecard"
5. Fill out the questions (Google Sheet-style form)
6. See sub-totals calculate as you answer
7. See PASS/FAIL status at bottom
8. Click **Export to CSV** to download
9. Submit to save (or just export without saving)

---

## Next Steps After Preview

Once you've previewed and like what you see:

1. **Connect Real Data**: Update `src/api/base44Client.js` to use your actual base44 SDK
2. **Customize**: Adjust colors, branding, add your logo
3. **Deploy**: Build for production (`npm run build`) and deploy

---

## Notes

- Data is stored in memory (mock arrays) - refresh will reset changes
- For persistence, you'll need to connect to real base44 API
- All features are functional except actual data persistence
- CSV export works and downloads real files

Enjoy exploring your CRM! 🎯



