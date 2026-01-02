# How "Won" Status Detection Works

## Current Implementation

The system checks for "won" status in **two places**:

### 1. During Import (`lmnEstimatesListParser.js`)

**Location:** `src/utils/lmnEstimatesListParser.js` (lines 162-204)

**Logic:**
1. Reads the **"Status"** column from Estimates List.xlsx
2. Converts to lowercase and trims whitespace
3. Checks for **exact matches** first, then **partial matches**
4. **Defaults to 'lost'** if no match found

**Won Statuses (Exact Matches):**
- `'email contract award'`
- `'verbal contract award'`
- `'work complete'`
- `'work in progress'`
- `'billing complete'`
- `'contract signed'`

**Won Statuses (Partial Matches - uses `.includes()`):**
- Contains `'email contract award'`
- Contains `'verbal contract award'`
- Contains `'work complete'`
- Contains `'billing complete'`
- Contains `'contract signed'`

**Lost Statuses:**
- `'estimate in progress - lost'`
- `'review + approve - lost'`
- `'client proposal phase - lost'`
- `'estimate lost'`
- `'estimate on hold'`
- `'estimate lost - no reply'`
- `'estimate lost - price too high'`
- Or contains any of the above

**Default:** `'lost'` (if no match found)

### 2. During Revenue Calculation (`revenueSegmentCalculator.js`)

**Location:** `src/utils/revenueSegmentCalculator.js` (lines 151-155, 200-204)

**Logic:**
- Checks if `est.status.toLowerCase() === 'won'`
- **Case-insensitive** (fixed recently)
- Only checks for the literal string `'won'`

**Issue:** This means estimates must have `status === 'won'` in the database, which only happens if the import parser recognized them as won.

### 3. During Renewal Date Calculation (`renewalDateCalculator.js`)

**Location:** `src/utils/renewalDateCalculator.js` (lines 22-25)

**Logic:**
- Checks if `est.status.toLowerCase() === 'won'`
- **Case-insensitive** (fixed recently)
- Only checks for the literal string `'won'`

## The Problem

**If your Excel file has status values that don't match the exact strings above, they will be imported as `'lost'` and won't count for revenue or at-risk accounts.**

### Common Status Values That Might Not Match:

- `"Won"` (capital W) - ✅ Should work now (case-insensitive)
- `"Sold"` - ❌ Not recognized
- `"Completed"` - ❌ Not recognized
- `"Awarded"` - ❌ Not recognized
- `"Accepted"` - ❌ Not recognized
- `"Closed Won"` - ❌ Not recognized
- `"Contract Awarded"` - ❌ Not recognized (needs "contract award")
- `"Work Completed"` - ❌ Not recognized (needs "work complete")
- `"Billing Completed"` - ❌ Not recognized (needs "billing complete")

## How to Check Your Data

### Step 1: Check Console Logs

After the page loads, look for this log:
```
🔍 At-Risk Accounts Debug: {
  statusCounts: { ... },
  ...
}
```

The `statusCounts` object will show you what status values actually exist in your estimates.

### Step 2: Check Database

Run this SQL query in Supabase:
```sql
SELECT status, COUNT(*) as count
FROM estimates
GROUP BY status
ORDER BY count DESC;
```

This will show you all status values and how many estimates have each one.

### Step 3: Check Excel File

Open your Estimates List.xlsx file and look at the "Status" column. Check what values are actually in there.

## Solutions

### Option 1: Update Excel Status Values

Change your Excel file's "Status" column to match one of the recognized won statuses:
- "Email Contract Award"
- "Verbal Contract Award"
- "Work Complete"
- "Work In Progress"
- "Billing Complete"
- "Contract Signed"

### Option 2: Update the Parser

If your status values are different, we can update the parser to recognize them. For example, if you use "Sold" or "Won", we can add those to the parser.

### Option 3: Update Existing Data

If estimates are already imported with wrong status, we can update them in the database:
```sql
-- Example: Update "Sold" to "won"
UPDATE estimates
SET status = 'won'
WHERE status = 'sold';

-- Or update based on other criteria
UPDATE estimates
SET status = 'won'
WHERE status IN ('completed', 'awarded', 'accepted');
```

## Recommended Fix

**I recommend checking what status values you actually have first**, then we can either:
1. Update the parser to recognize your status values
2. Update the database to change existing statuses
3. Or both

Let me know what status values you see in the console logs or database, and I can update the parser accordingly!

