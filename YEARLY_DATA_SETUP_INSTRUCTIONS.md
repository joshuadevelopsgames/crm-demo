# Yearly Official Data Setup Instructions

## Overview

The yearly official data system uses LMN's detailed export files as the source of truth for yearly reports. Data can be stored in either:
1. **Supabase table** (recommended for production)
2. **JSON file** (fallback, simpler setup)

## Setup Steps

### Option 1: Supabase Table (Recommended)

1. **Create the table:**
   - Run `create_yearly_official_data_table.sql` in your Supabase SQL editor
   - Or execute via psql: `psql $DATABASE_URL -f create_yearly_official_data_table.sql`

2. **Import the data:**
   ```bash
   node import-yearly-data-to-supabase.js
   ```

3. **Verify:**
   - Check Supabase dashboard: `yearly_official_estimates` table should have 1,823 rows
   - Years: 2022 (25), 2023 (121), 2024 (591), 2025 (1,086)

### Option 2: JSON File (Fallback)

1. **Import from Excel files:**
   ```bash
   node import-yearly-exports.js
   ```

2. **Verify:**
   - Check that `yearly_official_data.json` exists
   - Should contain 1,823 estimates across 4 years

## How It Works

The API endpoint (`api/data/yearlyOfficialData.js`) automatically:
1. **Tries Supabase first** - If table exists, uses it
2. **Falls back to JSON** - If table doesn't exist, reads from JSON file
3. **Returns data** with source indicator (`supabase` or `json`)

## Current Status

✅ **Data imported to JSON file** - `yearly_official_data.json` contains all 1,823 estimates
⏳ **Supabase table** - Needs to be created (run SQL migration)

## After Setup

Once the Supabase table is created and data is imported:
- Reports will automatically use Supabase data (faster, indexed)
- JSON file will serve as backup
- API will indicate source in response (`source: 'supabase'` or `source: 'json'`)

## Adding New Yearly Data

When you get a new year's detailed export:

1. Place file in `~/Downloads/estimates reports lists/`
2. Update `fileYearMap` in `import-yearly-exports.js` if needed
3. Run: `node import-yearly-exports.js` (updates JSON)
4. Run: `node import-yearly-data-to-supabase.js` (updates Supabase)

The new year will automatically appear in reports.

