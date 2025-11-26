# Google Sheets Integration Setup

## Overview

The CRM can now read data directly from your Google Sheet instead of using mock data. This requires setting up Google Sheets API access.

## Setup Steps

### 1. Get Google Sheets API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Google Sheets API"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy your API key
6. (Optional) Restrict the API key to Google Sheets API only for security

### 2. Configure API Key

Create a `.env` file in the project root:

```bash
VITE_GOOGLE_SHEETS_API_KEY=your-api-key-here
```

### 3. Make Sheet Public (Easiest) OR Use OAuth

**Option A: Make Sheet Public (Simplest)**
1. Open your Google Sheet
2. Click "Share" → "Change to anyone with the link"
3. Set permission to "Viewer"
4. Copy the link

**Option B: Use Service Account (More Secure)**
- Requires setting up a service account
- More complex but more secure
- See Google Sheets API documentation

### 4. Update Sheet ID

The sheet ID is already configured in `src/services/googleSheetsService.js`:
```javascript
const GOOGLE_SHEET_ID = '193wKTGmz1zvWud05U1rCY9SysGQAeYc2KboO6_JjrJs';
```

This is extracted from your sheet URL: `https://docs.google.com/spreadsheets/d/193wKTGmz1zvWud05U1rCY9SysGQAeYc2KboO6_JjrJs/edit`

### 5. Sheet Structure Requirements

Your Google Sheet should have these tabs:
- **Scorecard** - Scorecard data (already structured correctly)
- **Company Contacts** - Contact information
- **Sales Insights** - Sales insights
- **Research Notes** - Research notes

## Sheet Tab Formats

### Scorecard Tab
Already matches your current format:
- Column A: Scorecard (Question/Section labels)
- Column B: Data (Answers)
- Column C: Score (Points)
- Column D: Pass/Fail
- Multiple dated entries

### Company Contacts Tab
Expected format (with header row):
| First Name | Last Name | Email | Phone | Title | Account ID | Account Name | Role | LinkedIn | Preferences |
|------------|-----------|-------|-------|-------|------------|--------------|------|----------|-------------|
| John       | Doe       | ...   | ...   | ...   | ...        | ...          | ...  | ...      | ...         |

### Sales Insights Tab
Expected format (with header row):
| Account ID | Insight Type | Title | Content | Tags | Recorded By | Recorded Date | Related Interaction ID |
|------------|--------------|-------|---------|------|-------------|---------------|------------------------|
| 1          | opportunity  | ...   | ...     | ...  | ...         | ...           | ...                    |

### Research Notes Tab
Expected format (with header row):
| Account ID | Note Type | Title | Content | Source URL | Recorded By | Recorded Date |
|------------|-----------|-------|---------|------------|-------------|---------------|
| 1          | company_info | ... | ...   | ...        | ...         | ...           |

## Switching to Google Sheets Data

Once API key is configured, the system will automatically use Google Sheets data instead of mock data.

## Troubleshooting

### "Failed to fetch" errors
- Check API key is set correctly in `.env`
- Verify Google Sheets API is enabled
- Check sheet is public (if using API key only)
- Verify sheet ID is correct

### Empty data
- Check sheet tab names match exactly (case-sensitive)
- Verify data format matches expected structure
- Check browser console for specific errors

### Rate Limits
- Google Sheets API has rate limits
- Data is cached for 5 minutes to reduce API calls
- If you hit limits, increase cache duration

## Next Steps

1. Set up API key
2. Create `.env` file with key
3. Restart dev server
4. Data will load from Google Sheet automatically





