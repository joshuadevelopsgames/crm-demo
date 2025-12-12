# Debug: Tab Names Issue

## The Problem

Your console shows:
- ✅ `Loaded 0 rows from Imported Contacts tab`
- ✅ `Loaded 0 rows from Imported Accounts tab`

But other tabs are loading fine (Contact Cadence, Company Contacts, etc.).

## Most Likely Causes

### 1. Tab Names Don't Match Exactly

The code looks for tabs named **exactly**:
- `Imported Accounts` (with a space, capital I and A)
- `Imported Contacts` (with a space, capital I and C)

**Check your Google Sheet:**
1. Open: https://docs.google.com/spreadsheets/d/1yz-StxTwUcisYEFREG0IbRfIkbmLQUE0DvEnL8oBxlk/edit
2. Look at the tab names at the bottom
3. Are they named exactly:
   - `Imported Accounts` (not "ImportedAccounts" or "imported accounts")
   - `Imported Contacts` (not "ImportedContacts" or "imported contacts")

**If they're different:**
- Right-click the tab → "Rename"
- Change to exactly: `Imported Accounts` or `Imported Contacts`
- Case-sensitive and spaces matter!

### 2. Tabs Are Empty (Only Headers)

The tabs exist but only have the header row (row 1), no data rows.

**Check:**
1. Click on "Imported Accounts" tab
2. Look at the bottom-left - what row number is the last row?
   - If it says "Row 1" → Only headers, no data
   - If it says "Row 1162" → Data is there (1,161 accounts + 1 header)

3. Click on "Imported Contacts" tab
4. Check the last row number
   - If it says "Row 1" → Only headers, no data
   - If it says "Row 1690" → Data is there (1,689 contacts + 1 header)

### 3. Data Was Written to Different Tabs

The data might have been written to tabs with different names.

**Check all tabs:**
1. Scroll through all tabs at the bottom
2. Look for tabs with lots of data (1,000+ rows)
3. Check their names - they might be:
   - `Accounts` (instead of "Imported Accounts")
   - `Contacts` (instead of "Imported Contacts")
   - Or some other variation

---

## Quick Test: Direct CSV URL

Test if the tabs are accessible:

### Test Imported Accounts:
Open this URL in your browser:
```
https://docs.google.com/spreadsheets/d/1yz-StxTwUcisYEFREG0IbRfIkbmLQUE0DvEnL8oBxlk/gviz/tq?tqx=out:csv&sheet=Imported%20Accounts
```

**Expected:**
- If you see CSV data with headers and rows → Tab exists and has data
- If you see an error or empty → Tab doesn't exist or is empty

### Test Imported Contacts:
Open this URL:
```
https://docs.google.com/spreadsheets/d/1yz-StxTwUcisYEFREG0IbRfIkbmLQUE0DvEnL8oBxlk/gviz/tq?tqx=out:csv&sheet=Imported%20Contacts
```

**Expected:**
- If you see CSV data → Tab exists and has data
- If you see an error → Tab doesn't exist or is empty

---

## What to Do Next

1. **Check tab names** - Make sure they're exactly `Imported Accounts` and `Imported Contacts`
2. **Check if tabs have data** - Look at the row count at the bottom
3. **Test the CSV URLs** - See if data is accessible
4. **Share what you find** - Let me know:
   - What are the exact tab names?
   - How many rows does each tab have?
   - What do the CSV URLs show?

---

## If Tabs Are Empty

If the tabs only have headers but no data, the write might have failed. Check:
1. Browser console from when you imported - look for errors
2. Vercel function logs - check if the write API returned success
3. Try importing again with a smaller test file

---

**Most likely fix:** The tab names don't match exactly. Rename them to `Imported Accounts` and `Imported Contacts` (with spaces, proper capitalization).

