# Compare Estimates Script

This script compares estimates from your database with the `Estimates List.xlsx` file in your Downloads folder.

## Prerequisites

1. **Estimates List.xlsx** must be in your Downloads folder
2. **Environment variables** must be set:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

## Setup

### Option 1: Set environment variables in your shell

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Option 2: Create a `.env` file (if using dotenv)

Add these to your `.env` file:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Usage

### Run the script:

```bash
npm run compare:estimates
```

Or directly:

```bash
node compare_estimates_with_excel.js
```

## What It Does

1. **Reads** `Estimates List.xlsx` from your Downloads folder
2. **Fetches** all estimates from your Supabase database
3. **Compares** the two datasets by Estimate ID
4. **Reports**:
   - Estimates in Excel but missing in database
   - Estimates in database but missing in Excel
   - Estimates with different values (dates, prices, status, etc.)
   - Perfect matches

## Output

The script will show:
- Summary statistics
- List of missing estimates (if any)
- List of estimates with differences (if any)
- Perfect match confirmation (if everything matches)

## Example Output

```
📊 Comparing Estimates from Database with Excel File

📁 Excel file: /Users/joshua/Downloads/Estimates List.xlsx

📖 Reading Excel file...
✅ Parsed 8269 estimates from Excel

🔍 Fetching estimates from database...
✅ Fetched 8269 estimates from database

================================================================================
📊 COMPARISON RESULTS
================================================================================

📈 Summary:
   Excel file:     8269 estimates
   Database:       8269 estimates
   Perfect matches: 8265 estimates
   Missing in DB:  0 estimates
   Missing in Excel: 0 estimates
   With differences: 4 estimates

✅ PERFECT MATCH! All estimates match between Excel and database.
```

