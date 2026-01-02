# Troubleshooting Guide: Data Not Saving to Supabase

This guide helps diagnose and fix issues when data fields aren't being saved to Supabase during import.

## Quick Diagnosis Checklist

1. ✅ **Check if Supabase can write the field** - Run `test-write-dates-to-supabase.js` (or similar)
2. ✅ **Check if parser extracts the field** - Run `test-parser-dates-debug.js` (or similar)
3. ✅ **Check if field survives merge** - Check browser console logs
4. ✅ **Check if field reaches API** - Check API logs in Vercel
5. ✅ **Check if field is in database** - Query Supabase directly

## Step-by-Step Troubleshooting Process

### Step 1: Verify Supabase Can Write the Field

**Problem:** Field might not be writable due to schema constraints, RLS policies, or data type mismatches.

**Solution:** Test direct writes to Supabase

```bash
# For date fields
node test-write-dates-to-supabase.js

# For other fields, create similar test script
# Test INSERT, UPDATE, and NULL values
```

**What to look for:**
- ✅ All tests pass → Supabase can write the field (problem is in pipeline)
- ❌ Tests fail → Check database schema, RLS policies, or data types

**Common issues:**
- Column doesn't exist in database schema
- Column type mismatch (e.g., expects `timestamptz`, got `text`)
- RLS (Row Level Security) policy blocking writes
- Missing permissions

### Step 2: Verify Parser Extracts the Field

**Problem:** Parser might not be reading the field from Excel/CSV.

**Solution:** Run parser test script

```bash
# For estimates
node test-parser-dates-debug.js

# For other files, check parser output
node check-all-parser-fields.js
```

**What to check:**
1. **Column detection:**
   - Is the column found? (`colMap.fieldName >= 0`)
   - Are column names matching correctly? (case-sensitive vs case-insensitive)
   - Are alternative column names supported?

2. **Data extraction:**
   - What's the raw value from Excel? (`fieldRaw`)
   - What's the parsed value? (`fieldParsed`)
   - Is the parser function working correctly?

3. **Parser errors:**
   - Check `result.errors` array
   - Look for `ReferenceError`, `TypeError`, or other exceptions
   - Check if parser is returning 0 records (indicates a bug)

**Common issues:**
- Column name mismatch (e.g., "Contract End" vs "Contract End Date")
- Parser bug (e.g., using variable before initialization)
- Empty cells in Excel (parser returns `null` correctly)
- Data type conversion issues (Excel serial dates, strings, etc.)

**Fix parser bugs:**
```javascript
// Example: Variable used before initialization
// ❌ BAD:
console.log(contractStartRaw); // ReferenceError!
const contractStartRaw = row[colMap.contractStart];

// ✅ GOOD:
const contractStartRaw = row[colMap.contractStart];
console.log(contractStartRaw);
```

### Step 3: Verify Field Survives Merge

**Problem:** Field might be lost during data merging/linking.

**Solution:** Check browser console logs during import

**What to look for:**
- `🔍 [Merge] Sample estimate BEFORE merge:` - Field should be present
- `🔍 [Merge] Sample estimate AFTER merge:` - Field should still be present

**Common issues:**
- Spread operator not preserving field (shouldn't happen, but check)
- Merge logic overwriting field with `null`
- Field being filtered out during merge

**Debug in code:**
```javascript
// In lmnMergeData.js, add logging:
console.log('🔍 [Merge] Sample estimate:', {
  fieldName: estimate.fieldName,
  hasField: !!estimate.fieldName
});
```

### Step 4: Verify Field Reaches API

**Problem:** Field might be lost between frontend and API.

**Solution:** Check API logs and add debug logging

**What to check:**
1. **Frontend logs:**
   - `🔍 [Import] Sample estimate in chunk (BEFORE API call):` - Field should be present
   - Check `JSON.stringify` payload size (might be truncated)

2. **API logs (Vercel):**
   - `🔍 API: Sample estimate (INCOMING):` - Field should be present
   - `🔍 API: estimateData AFTER destructuring:` - Field should still be present
   - `🔍 API: estimateData FINAL:` - Field should be present before save

**Common issues:**
- Field removed during destructuring in API
- Field not in spread operator (`...estimateWithoutIds`)
- Payload too large (Vercel 4.5MB limit)
- JSON serialization issues

**Fix API issues:**
```javascript
// ❌ BAD: Field might be lost
const { id, account_id, fieldName, ...rest } = estimate;
const data = { ...rest }; // fieldName is lost!

// ✅ GOOD: Use spread operator
const { id, account_id, ...rest } = estimate;
const data = { ...rest }; // fieldName is preserved
```

### Step 5: Verify Field is in Database

**Problem:** Field might be saved but query isn't returning it.

**Solution:** Query Supabase directly

```sql
-- Check if field exists and has values
SELECT 
  id,
  field_name,
  COUNT(*) as total,
  COUNT(field_name) as has_value,
  COUNT(*) - COUNT(field_name) as null_count
FROM table_name
GROUP BY field_name
LIMIT 10;
```

**What to check:**
- Does the column exist?
- Are there any values (not all NULL)?
- Are values in correct format?

## Common Issues and Fixes

### Issue 1: Parser Returns 0 Records

**Symptoms:**
- `Total estimates parsed: 0`
- `Errors: 0` (or errors about variable initialization)

**Causes:**
- Variable used before initialization (`ReferenceError`)
- Parser throwing exception and catching it
- All records filtered out

**Fix:**
1. Check parser for `ReferenceError` or `TypeError`
2. Look for variables used before declaration
3. Check if debug logging uses variables before they're defined

### Issue 2: Field is `null` in Database

**Symptoms:**
- Field exists in Excel
- Field is `null` in Supabase
- No errors during import

**Causes:**
- Parser returning `null` (empty cells)
- Field not in Excel (column missing)
- Parser bug (not extracting correctly)

**Fix:**
1. Run `test-parser-dates-debug.js` to see raw values
2. Check if Excel cells are actually empty
3. Verify parser column detection (`colMap.fieldName >= 0`)

### Issue 3: Field Not Being Updated

**Symptoms:**
- Field updates to value, then reverts to `null`
- Field never updates from existing `null` value

**Causes:**
- Supabase not updating `null` to value (should work, but test it)
- Update logic filtering out the field
- RLS policy preventing updates

**Fix:**
1. Test with `test-update-null-dates.js`
2. Check if field is in update payload
3. Verify RLS policies allow updates

### Issue 4: Field Lost During Destructuring

**Symptoms:**
- Field present in incoming data
- Field missing after destructuring
- Field not in final `estimateData`

**Causes:**
- Field explicitly destructured out
- Spread operator not preserving field
- Field name mismatch

**Fix:**
```javascript
// ❌ BAD: Field explicitly removed
const { id, account_id, fieldName, ...rest } = estimate;

// ✅ GOOD: Only remove what you need
const { id, account_id, _internal, ...rest } = estimate;
// fieldName is preserved in rest
```

## Available Debug Tools

### 1. Test Supabase Writes
```bash
node test-write-dates-to-supabase.js
node test-update-null-dates.js
```
**Purpose:** Verify Supabase can write/update the field

### 2. Test Parser
```bash
node test-parser-dates-debug.js
node test-estimates-parser.js
```
**Purpose:** Verify parser extracts field correctly

### 3. Check All Parser Fields
```bash
node check-all-parser-fields.js
```
**Purpose:** Identify fields in Excel that aren't being parsed

### 4. Browser Console Logs
During import, check for:
- `🔍 [Import] Sample estimate from mergedData (BEFORE filter):`
- `🔍 [Import] Sample estimate in chunk (BEFORE API call):`
- `🔍 [Merge] Sample estimate BEFORE/AFTER merge:`

### 5. API Logs (Vercel)
Check Vercel function logs for:
- `🔍 API: Sample estimate (INCOMING):`
- `🔍 API: estimateData AFTER destructuring:`
- `🔍 API: estimateData FINAL:`

## Debugging Workflow

1. **Start with Supabase test** - Can the database write the field?
   - ✅ Yes → Continue to step 2
   - ❌ No → Fix database schema/RLS

2. **Test parser** - Does parser extract the field?
   - ✅ Yes → Continue to step 3
   - ❌ No → Fix parser (check column detection, parsing logic)

3. **Check merge** - Does field survive merge?
   - ✅ Yes → Continue to step 4
   - ❌ No → Fix merge logic

4. **Check API** - Does field reach API?
   - ✅ Yes → Continue to step 5
   - ❌ No → Fix API destructuring/spread

5. **Check database** - Is field in database?
   - ✅ Yes → Problem solved!
   - ❌ No → Check update logic, RLS policies

## Prevention Tips

1. **Always test parser independently** - Use test scripts before full import
2. **Add debug logging early** - Log at each step of the pipeline
3. **Use spread operators carefully** - Only destructure what you need to remove
4. **Test with null values** - Ensure `null` → value updates work
5. **Verify column detection** - Use flexible matching (case-insensitive, alternatives)
6. **Check for variable initialization errors** - Don't use variables before they're defined

## Quick Reference: File Locations

- **Parser test scripts:** `test-parser-dates-debug.js`, `test-estimates-parser.js`
- **Supabase test scripts:** `test-write-dates-to-supabase.js`, `test-update-null-dates.js`
- **Field checker:** `check-all-parser-fields.js`
- **Parsers:** `src/utils/lmnEstimatesListParser.js`, `src/utils/lmnContactsExportParser.js`, etc.
- **API endpoints:** `api/data/estimates.js`, `api/data/contacts.js`, etc.
- **Merge logic:** `src/utils/lmnMergeData.js`
- **Import dialog:** `src/components/ImportLeadsDialog.jsx`

## Example: Fixing Date Fields Not Saving

Based on our recent debugging session:

1. **Symptom:** `estimate_date`, `contract_start`, `contract_end` all `null` in database
2. **Root cause:** Parser had `ReferenceError: Cannot access 'contractStartRaw' before initialization`
3. **Fix:** Moved debug logging to after variable initialization
4. **Verification:** 
   - ✅ Parser now extracts dates correctly (7932 estimates, 100% have `estimate_date`)
   - ✅ Supabase can write dates (test confirmed)
   - ✅ Dates are saved during import

**Key lesson:** Always check parser errors array and look for `ReferenceError` or `TypeError` that might be silently caught.

