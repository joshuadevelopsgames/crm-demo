# Testing Guide: Per-Year Segment Storage

## Migration Status
✅ Database migration completed: `add_segment_by_year_to_accounts.sql`

## Test Scenarios

### 1. Test Import Process - Segments Calculated for All Years

**Steps:**
1. Navigate to **Import Leads** page
2. Import a CSV file that contains estimates spanning multiple years (e.g., 2024, 2025, 2026)
3. After import completes, check the browser console for segment calculation logs:
   - Look for: `📊 Calculating revenue segments for all accounts...`
   - Look for: `📊 Segment calculation results:`
4. Verify in database (or via API):
   - Query an account that has revenue in multiple years
   - Check that `segment_by_year` field contains segments for each year:
     ```sql
     SELECT id, name, revenue_by_year, segment_by_year 
     FROM accounts 
     WHERE segment_by_year IS NOT NULL 
     LIMIT 5;
     ```
   - Example expected format:
     ```json
     {
       "revenue_by_year": { "2024": 50000, "2025": 75000, "2026": 60000 },
       "segment_by_year": { "2024": "B", "2025": "A", "2026": "B" }
     }
     ```

**Expected Results:**
- ✅ Segments are calculated for ALL years that have revenue (not just selected year)
- ✅ `segment_by_year` JSONB field is populated with year-segment mappings
- ✅ `revenue_segment` field is set to the selected year's segment (backward compatibility)
- ✅ Console logs show segment counts for the selected year

---

### 2. Test UI Display - Segments Update When Year Changes

**Steps:**
1. Navigate to **Accounts** page
2. Note the current selected year (shown in the year selector dropdown at top)
3. Identify an account that has different segments for different years:
   - Look for accounts with `segment_by_year` containing different values
   - Or use an account you know has different revenue percentages across years
4. Note the segment badge/display for that account
5. Change the selected year using the year selector dropdown
6. Observe the account's segment display

**Expected Results:**
- ✅ Segment badge/display updates immediately when year changes
- ✅ Segment filter counts update to reflect the new year's segments
- ✅ All accounts show segments for the newly selected year
- ✅ No page refresh required - updates happen reactively

**Test Accounts to Check:**
- Account with Segment A in 2024 but Segment B in 2025
- Account with Segment D in one year (no Service estimates) but Segment A/B/C in another
- Account with no revenue in one year (should show Segment C)

---

### 3. Test Segment Calculation Logic

**Verify Segment Rules (per spec):**

**Segment D (Highest Priority):**
- Account with NO Service won estimates for selected year → Segment D
- Account with Service won estimates → Cannot be Segment D (must be A/B/C)

**Segment A:**
- Revenue percentage > 15% of total revenue for selected year

**Segment B:**
- Revenue percentage between 5% and 15% (inclusive) of total revenue for selected year

**Segment C:**
- Revenue percentage < 5% of total revenue for selected year
- OR no revenue data for selected year (default)

**Steps:**
1. Calculate total revenue for selected year: Sum of all accounts' `revenue_by_year[selectedYear]`
2. For a test account, calculate: `(account.revenue_by_year[selectedYear] / totalRevenue) * 100`
3. Verify the displayed segment matches the calculated percentage:
   - > 15% → Segment A
   - 5-15% → Segment B
   - < 5% → Segment C
4. For Segment D: Check if account has any Service won estimates for selected year
   - If NO Service estimates → Segment D
   - If ANY Service estimates → A/B/C based on percentage

---

### 4. Test Manual Segment Recalculation (Admin Only)

**Steps:**
1. Log in as admin user
2. Navigate to **Settings** page
3. Scroll to "Recalculate Segments" section
4. Click "Recalculate Segments" button
5. Wait for completion message
6. Verify segments are recalculated for all years:
   - Check console logs for segment calculation results
   - Verify `segment_by_year` is updated in database
   - Change selected year and verify segments are correct

**Expected Results:**
- ✅ Only admins can see/use the recalculation button
- ✅ Segments are recalculated for ALL years (not just selected year)
- ✅ `segment_by_year` field is updated for all accounts
- ✅ `revenue_segment` is updated to selected year's segment
- ✅ Success message shows segment counts

---

### 5. Test Estimate Updates Trigger Segment Recalculation

**Steps:**
1. Note an account's current segment for selected year
2. Create or update an estimate for that account:
   - Change estimate status to "won"
   - Change estimate type (Standard vs Service)
   - Change estimate price
3. Wait a few seconds (recalculation is async)
4. Refresh accounts list or check database
5. Verify segment is recalculated based on new estimate data

**Expected Results:**
- ✅ Segments automatically recalculate when estimates are created/updated/deleted
- ✅ Recalculation happens asynchronously (doesn't block API response)
- ✅ Both `segment_by_year` and `revenue_segment` are updated
- ✅ Segment D status updates if Service estimates are added/removed

---

### 6. Test Edge Cases

**No Revenue Data:**
- Account with no `revenue_by_year` → Should default to Segment C
- Account with `revenue_by_year` but no data for selected year → Should default to Segment C

**Zero Total Revenue:**
- If total revenue for selected year is 0 → All accounts should default to Segment C

**Missing segment_by_year:**
- Account without `segment_by_year` field → Should fall back to `revenue_segment`
- If both missing → Should default to Segment C

**Year Changes:**
- Account with segments for 2024, 2025, but user selects 2026:
  - If account has revenue for 2026 → Segment should be calculated/displayed
  - If account has no revenue for 2026 → Should show Segment C

---

## Verification Queries

### Check segment_by_year data:
```sql
SELECT 
  id, 
  name, 
  revenue_by_year, 
  segment_by_year,
  revenue_segment
FROM accounts 
WHERE segment_by_year IS NOT NULL 
ORDER BY name
LIMIT 10;
```

### Check accounts with different segments across years:
```sql
SELECT 
  id, 
  name, 
  segment_by_year
FROM accounts 
WHERE segment_by_year IS NOT NULL 
  AND jsonb_object_keys(segment_by_year)::text[] && ARRAY['2024', '2025']
  AND (segment_by_year->>'2024') IS DISTINCT FROM (segment_by_year->>'2025')
LIMIT 5;
```

### Count segments for a specific year:
```sql
SELECT 
  segment_by_year->>'2024' as segment_2024,
  COUNT(*) as count
FROM accounts 
WHERE segment_by_year IS NOT NULL 
  AND segment_by_year ? '2024'
GROUP BY segment_by_year->>'2024'
ORDER BY segment_2024;
```

---

## Success Criteria

✅ **Import Process:**
- Segments calculated for ALL years during import
- `segment_by_year` populated correctly
- Console logs show calculation progress

✅ **UI Display:**
- Segments update immediately when year changes
- No page refresh required
- All accounts show correct segment for selected year

✅ **Data Integrity:**
- `segment_by_year` contains segments for all years with revenue
- `revenue_segment` matches `segment_by_year[selectedYear]`
- Segment calculations follow spec rules (R1-R23)

✅ **Edge Cases:**
- Missing data handled gracefully (defaults to Segment C)
- Zero revenue scenarios handled correctly
- Backward compatibility maintained (`revenue_segment` fallback)

---

## Troubleshooting

**Issue: Segments not updating when year changes**
- Check browser console for errors
- Verify `getSegmentForYear()` is being called with correct `selectedYear`
- Check that `YearSelectorContext` is providing updated `selectedYear`

**Issue: Import not calculating segments for all years**
- Check console logs during import
- Verify `calculateSegmentsForAllYears()` is called in `lmnMergeData.js`
- Check that `revenue_by_year` is populated before segment calculation

**Issue: Segment D not showing correctly**
- Verify account has NO Service won estimates for selected year
- Check estimate `estimate_type` field (should be "Standard" only)
- Verify `isWonStatus()` is correctly identifying won estimates

**Issue: Database migration not applied**
- Run migration manually: `psql -d your_database -f add_segment_by_year_to_accounts.sql`
- Verify column exists: `\d accounts` in psql
- Check index exists: `\di idx_accounts_segment_by_year`


