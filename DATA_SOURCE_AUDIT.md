# Data Source Audit Report

## Summary
This audit identifies all data sources in the LECRM application and recommends migrations to Supabase where appropriate.

---

## ✅ Data Sources Using Supabase (Correct)

### Primary Data (via `/api/data/*` endpoints)
All of these use Supabase as the backend:
- **Accounts** - `/api/data/accounts` → `accounts` table
- **Contacts** - `/api/data/contacts` → `contacts` table
- **Estimates** - `/api/data/estimates` → `estimates` table
- **Jobsites** - `/api/data/jobsites` → `jobsites` table
- **Tasks** - `/api/data/tasks` → `tasks` table
- **Interactions** - `/api/data/interactions` → `interactions` table
- **Scorecards** - `/api/data/scorecards` → `scorecard_responses` table
- **Templates** - `/api/data/templates` → `scorecard_templates` table
- **Announcements** - `/api/data/announcements` → `announcements` table
- **Notifications** - `/api/data/notifications` → `notifications` table
- **Notification Snoozes** - `/api/data/notificationSnoozes` → `notification_snoozes` table
- **Account Attachments** - `/api/data/accountAttachments` → `account_attachments` table

**Status:** ✅ All using Supabase correctly

---

## ⚠️ Data Sources NOT Using Supabase (Needs Review)

### 1. Yearly Official Data - JSON File
**Location:** `api/data/yearlyOfficialData.js`
**Current Source:** `yearly_official_data.json` (file system)
**Supabase Support:** ✅ Exists but **DISABLED** (line 80: `if (false)`)

**Issue:**
- Supabase table `yearly_official_estimates` exists and has migration script
- Code has full Supabase support implemented
- Currently disabled and using JSON file instead

**Recommendation:**
```javascript
// Change line 80 in api/data/yearlyOfficialData.js from:
if (false) { // Changed to false to skip Supabase

// To:
if (true) { // Enable Supabase for yearly official data
```

**Benefits:**
- Faster queries (indexed database vs file read)
- Better scalability
- Consistent with rest of application
- Can query by year efficiently

**Migration Steps:**
1. Ensure `yearly_official_estimates` table exists in Supabase
2. Import data: `node import-yearly-data-to-supabase.js`
3. Enable Supabase in `api/data/yearlyOfficialData.js` (change `false` to `true`)
4. Test that Reports page still works
5. Keep JSON file as backup during transition

---

### 2. Google Sheets - Scorecard Template Import
**Location:** `src/services/googleSheetsService.js` → `src/pages/Scoring.jsx`
**Current Source:** Google Sheets API (for import only)
**Usage:** 
- `parseScorecardTemplateFromSheet()` - Imports template structure from Google Sheets
- Used in: `src/pages/Scoring.jsx` (line 153) - "Import ICP Template" button

**Status:** ✅ **This is fine** - Google Sheets is used as an import source, not a data source
- Flow: Google Sheets → Import → Supabase `scorecard_templates` table
- After import, template is stored in Supabase
- Google Sheets is only used for initial import or updates
- No changes needed - this is an import function, not a primary data source

---

### 3. Google Sheets - Data Export/Import
**Location:** `src/services/googleSheetsService.js`
**Current Source:** Google Sheets API
**Usage:**
- `exportAllDataToGoogleSheet()` - Exports accounts/contacts to Google Sheets
- `writeToGoogleSheet()` - Writes data to Google Sheets
- Used in: `src/pages/Settings.jsx` (line 30)

**Status:** ✅ **This is fine** - Google Sheets is used as an export destination, not a data source
- Data flows: Supabase → Google Sheets (export only)
- Not used for reading primary data
- No changes needed

---

## 🔍 External APIs (Not Data Sources - These are Fine)

These are external services, not data sources:
- **Resend API** - Email sending (`api/bug-report.js`)
- **SMTP (Nodemailer)** - Email sending via SMTP (`api/bug-report.js`)
- **Google OAuth API** - Authentication (`api/google-auth/token.js`)
- **Google Sheets API** - Export functionality (not primary data source)

**Status:** ✅ No changes needed - these are external services, not data storage

**Note:** SendGrid has been removed - only Resend and SMTP are supported for email sending.

---

## 📋 Summary of Recommendations

### High Priority
1. **Enable Supabase for Yearly Official Data**
   - File: `api/data/yearlyOfficialData.js`
   - Change: Line 80, change `if (false)` to `if (true)`
   - Impact: Faster queries, better scalability, consistency

### Low Priority
2. **Google Sheets Import/Export** - No changes needed
   - Import: Used to import templates into Supabase (one-time operation)
   - Export: Used to export data to Google Sheets (export only, not a data source)

---

## Migration Checklist

### Yearly Official Data Migration
- [ ] Verify `yearly_official_estimates` table exists in Supabase
- [ ] Run `node import-yearly-data-to-supabase.js` to import data
- [ ] Verify data in Supabase (check row count matches JSON file)
- [ ] Enable Supabase in `api/data/yearlyOfficialData.js` (change `false` to `true`)
- [ ] Test Reports page with Supabase data
- [ ] Keep JSON file as backup for 1-2 weeks
- [ ] Remove JSON file dependency after verification

### Scorecard Template (No Action Needed)
- ✅ Templates are imported from Google Sheets into Supabase
- ✅ After import, Supabase is the source of truth
- ✅ Google Sheets is only used for import/export, not as primary data source

---

## Files to Review/Update

1. **`api/data/yearlyOfficialData.js`** (Line 80)
   - Enable Supabase: Change `if (false)` to `if (true)`

2. **`src/services/googleSheetsService.js`**
   - ✅ Keep: Import/Export functions (fine as-is - not primary data sources)

---

## Notes

- **base44.entities** is a wrapper that calls `/api/data/*` endpoints, which use Supabase. This is correct.
- All primary data (accounts, contacts, estimates, etc.) is correctly using Supabase.
- **The only non-Supabase data source is:**
  1. **Yearly official data** (JSON file - Supabase support exists but disabled)
     - This is the only primary data source not using Supabase
     - Supabase table exists and code is ready, just needs to be enabled

