# Quick Setup: Use Google Sheet Data

## Option 1: Public Sheet (No API Key Needed) ✅ EASIEST

If your Google Sheet is set to "Anyone with the link can view", you can use it immediately:

1. **Make Sheet Public:**
   - Open your Google Sheet
   - Click "Share" button (top right)
   - Click "Change to anyone with the link"
   - Set permission to "Viewer"
   - Click "Done"

2. **That's it!** The system will automatically read from your sheet using CSV export.

The sheet ID is already configured: `193wKTGmz1zvWud05U1rCY9SysGQAeYc2KboO6_JjrJs`

---

## Option 2: With API Key (More Reliable)

If you want to use the Google Sheets API (works with private sheets):

1. **Get API Key:**
   - Go to https://console.cloud.google.com/
   - Create/select a project
   - Enable "Google Sheets API"
   - Create API Key (Credentials → Create Credentials → API Key)
   - (Optional) Restrict key to Google Sheets API only

2. **Create `.env` file:**
   ```bash
   VITE_GOOGLE_SHEETS_API_KEY=your-api-key-here
   ```

3. **Restart dev server:**
   ```bash
   npm run dev
   ```

---

## What Gets Loaded

The system will read from these tabs in your Google Sheet:

- ✅ **Scorecard** - All scorecard entries (multiple dates)
- ✅ **Company Contacts** - Contact information
- ✅ **Sales Insights** - Sales insights data
- ✅ **Research Notes** - Research notes data

---

## Sheet Tab Format Requirements

### Scorecard Tab
Already matches your format! ✅
- Column A: Scorecard (Question/Section)
- Column B: Data (Answers)
- Column C: Score
- Column D: Pass/Fail
- Multiple dated entries supported

### Company Contacts Tab
Expected format (with header row):
```
First Name | Last Name | Email | Phone | Title | Account ID | Account Name | Role | LinkedIn | Preferences
```

### Sales Insights Tab
Expected format (with header row):
```
Account ID | Insight Type | Title | Content | Tags | Recorded By | Recorded Date | Related Interaction ID
```

### Research Notes Tab
Expected format (with header row):
```
Account ID | Note Type | Title | Content | Source URL | Recorded By | Recorded Date
```

---

## Testing

1. Make your sheet public (Option 1) OR set up API key (Option 2)
2. Refresh your browser
3. Check browser console for: "Loaded X scorecards from Google Sheet"
4. Data should appear in the CRM

---

## Troubleshooting

**No data showing:**
- Check browser console for errors
- Verify sheet is public (if using Option 1)
- Verify API key is correct (if using Option 2)
- Check sheet tab names match exactly

**"Failed to fetch" errors:**
- Sheet might not be public
- API key might be invalid
- Sheet ID might be wrong

**Data format issues:**
- Verify tab structure matches expected format
- Check for empty rows or missing headers

---

## Current Status

✅ Google Sheets service created
✅ Scorecard parsing implemented
✅ Contacts, Insights, Notes parsing ready
✅ Automatic fallback to mock data if sheet unavailable
✅ Works with public sheets (no API key needed)

The system will automatically try to load from your Google Sheet. If it can't access it, it falls back to mock data so the app still works.





