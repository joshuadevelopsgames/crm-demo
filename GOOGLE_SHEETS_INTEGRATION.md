# Google Sheets Integration Plan

## Overview

To create a form that can input data into the Google Sheet (and potentially sync bidirectionally), we'll need:

1. **Google Sheets API Integration** - Read/write to the sheet
2. **Form-to-Sheet Mapping** - Map CRM form fields to sheet columns
3. **Data Export Function** - Export scorecard data to sheet
4. **Data Import Function** - Import existing data from sheet

## Google Sheet Structure Analysis

Based on the sheet at: https://docs.google.com/spreadsheets/d/193wKTGmz1zvWud05U1rCY9SysGQAeYc2KboO6_JjrJs/edit?usp=sharing

### Scorecard Tab Structure:
- Column A: Scorecard (Question/Section labels)
- Column B: Data (Answers)
- Column C: Score (Points)
- Column D: Pass/Fail
- Row 2: Date field
- Row 3+: Multiple dated entries (historical scorecards)
- Sections: Corporate Demographics, Non-Negotiables, Red Flags, etc.

### Other Tabs:
- Sales Insights
- Company Contacts
- Contact Cadence
- Research Notes
- Lookup Legend

## Implementation Options

### Option 1: Google Sheets API (Recommended)
- Use Google Sheets API v4
- Requires OAuth2 authentication
- Can read/write directly to sheets
- Real-time sync possible

### Option 2: Export to CSV/Excel
- Generate CSV/Excel file matching sheet structure
- User imports manually
- Simpler, no API setup needed

### Option 3: Webhook Integration
- Use Google Apps Script
- Trigger webhooks on sheet changes
- More complex but enables bidirectional sync

## Recommended Implementation

### Phase 1: Export Function (Easiest)
1. Add "Export to Google Sheet" button to scorecard completion
2. Format data to match sheet structure
3. Download as CSV that can be pasted into sheet
4. Include all sections, scores, date, pass/fail

### Phase 2: Direct API Integration
1. Set up Google Sheets API credentials
2. Create service account or OAuth flow
3. Build export function that writes directly to sheet
4. Add import function to read from sheet

### Phase 3: Bidirectional Sync
1. Webhook listeners for sheet changes
2. Auto-sync scorecard updates
3. Conflict resolution strategy

## Data Mapping

### Scorecard to Sheet Mapping:
```
CRM Field → Sheet Column
- scorecard_date → Row 2, Column B (Date field)
- section → Column A (Section header rows)
- question_text → Column A (Question rows)
- answer → Column B (Data column)
- weighted_score → Column C (Score column)
- normalized_score → Row 2, Column C
- is_pass → Column D (Pass/Fail)
```

### Example Row Mapping:
```
Row 2: Date: | January 1, 2025 | 90 | PASS
Row 3: (blank)
Row 7: Corporate Demographic Information | | 3 |
Row 8: Client Operations Region | Calgary/Surrounding | 2 |
Row 9: Can someone introduce us? | No | 0 |
...
Row 12: Sub-total | | 3 |
```

## Code Structure

### New Files Needed:
1. `src/utils/googleSheets.js` - Google Sheets API wrapper
2. `src/components/scorecard/ExportToSheet.jsx` - Export button/function
3. `src/services/googleSheetsService.js` - Sheet operations service

### Dependencies to Add:
```json
{
  "googleapis": "^126.0.0"  // For Google Sheets API
}
```

## Implementation Steps

### Step 1: Basic Export (CSV)
1. Create export function in TakeScorecard
2. Format data as CSV matching sheet structure
3. Download file with proper formatting
4. User can copy/paste into Google Sheet

### Step 2: Google Sheets API Setup
1. Create Google Cloud Project
2. Enable Sheets API
3. Create Service Account or OAuth credentials
4. Store credentials securely (environment variables)

### Step 3: Direct Write to Sheet
1. Implement write function using Google Sheets API
2. Create new row for each scorecard completion
3. Format data to match sheet structure exactly
4. Handle errors gracefully

### Step 4: Import from Sheet
1. Read existing data from sheet
2. Parse and validate format
3. Create ScorecardResponse records
4. Match to existing accounts

## Security Considerations

- Store API credentials in environment variables
- Use service account for server-side operations
- OAuth for user-specific access
- Rate limiting to avoid API quotas
- Error handling for API failures

## Future Enhancements

- Real-time sync (when sheet changes, update CRM)
- Bulk import/export
- Template sync (sync scorecard templates from sheet)
- Multi-sheet support (Sales Insights, Research Notes tabs)
- Automated backups to sheets

## Quick Start (Basic CSV Export)

For now, we can implement a simple CSV export that matches the Google Sheet structure. Users can copy/paste the CSV into their sheet. This requires no API setup and works immediately.

Would you like me to implement the basic CSV export first, or set up full Google Sheets API integration?



