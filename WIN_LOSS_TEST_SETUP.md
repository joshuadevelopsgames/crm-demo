# Win/Loss Ratio Test Page

## Overview
A standalone test page for tracking estimate win/loss ratios per customer without modifying the main LECRM site.

## Features

### 1. Overall Statistics Dashboard
- **Total Estimates**: Count of all estimates in the system
- **Estimates Won**: Total won estimates with dollar value
- **Estimates Lost**: Total lost estimates with dollar value  
- **Overall Win Rate**: Percentage of won estimates out of decided (won + lost) estimates
- **Pending Estimates**: Count of estimates awaiting decision

### 2. Per-Customer Analytics
For each customer, displays:
- **Total # of Estimates**: All estimates submitted to this customer
- **# Estimates Won**: Successfully won estimates
- **# Estimates Lost**: Lost estimates
- **Win Rate %**: Percentage calculated as (Won / (Won + Lost)) × 100
- **Total Value**: Sum of all estimate amounts
- **Won Value**: Total dollar value of won estimates
- **Lost Value**: Total dollar value of lost estimates

### 3. Detailed Estimates List
- Filterable by status (All, Won, Lost, Pending)
- Shows estimate number, customer, date, description, amount, and status
- Displays win/loss dates and reasons for lost estimates
- Sortable and searchable

## Data Structure

### Estimate Fields
```javascript
{
  id: string
  account_id: string
  account_name: string
  estimate_number: string (e.g., "EST-2024-001")
  estimate_date: date (YYYY-MM-DD)
  description: string
  total_amount: number
  status: 'won' | 'lost' | 'pending'
  won_date?: date
  lost_date?: date
  lost_reason?: string
  created_by: string
  notes?: string
}
```

## How to Access

### Option 1: Add Temporary Route (Testing Only)
Add this to `src/App.jsx` inside the Routes section:

```jsx
<Route path="/win-loss-test" element={<WinLossTest />} />
```

And import at the top:
```jsx
import WinLossTest from './pages/WinLossTest';
```

Then navigate to: `http://localhost:5173/win-loss-test`

### Option 2: Replace an Existing Page Temporarily
Temporarily import and use in another route for testing.

## Using Your Real CSV Data

The test page now includes a CSV import feature:

1. **Click "Upload CSV"** button on the page
2. **Select your file**: Choose "Estimate Test - Sheet1.csv" from your Downloads folder
3. **Automatic Processing**: The system will:
   - Parse all 458 estimates from your CSV
   - Map statuses correctly (Sold → won, Lost → lost, Pending → pending)
   - Calculate win/loss ratios per customer
   - Display all your real data

### CSV Format Support
The parser handles your exact CSV format including:
- **Customer Name**: Contact Name field
- **Estimate Date**: MM/DD/YYYY format
- **Status**: Maps "Contract Signed", "Email Contract Award", etc. to "won"
- **Lost Estimates**: Maps "Estimate Lost", "Estimate Lost - Price too high" to "lost"
- **Pending**: Maps "Estimate In Progress", "Pending" to "pending"
- **Amount**: Parses currency format like "$58,501.00"
- **All 47 columns** from your CSV are properly handled

## Mock Data

The test page uses mock data from `/src/api/mockData.js`:
- **12 sample estimates** across 3 customers
- Mix of won, lost, and pending statuses
- Realistic scenarios including:
  - Annual maintenance contracts
  - Seasonal services
  - One-time projects
  - Multi-year agreements

### Sample Statistics
- **Acme Corporation**: 5 estimates, 3 won, 1 lost, 1 pending (75% win rate)
- **Tech Startup Inc**: 3 estimates, 1 won, 1 lost, 1 pending (50% win rate)  
- **Global Manufacturing Co**: 4 estimates, 2 won, 2 lost (50% win rate)

## Calculation Logic

### Win Rate Formula
```
Win Rate = (Estimates Won / (Estimates Won + Estimates Lost)) × 100
```

**Note**: Pending estimates are excluded from win rate calculations.

### Why This Matters
- Win rates below 50% may indicate pricing or proposal issues
- High win rates (70%+) suggest strong product-market fit
- Per-customer tracking helps identify which relationships are most successful
- Lost reasons provide insights for improvement

## Integration Notes

This is a **standalone test page** and does NOT:
- Modify any existing LECRM pages
- Add navigation items automatically
- Change the Layout or routing structure
- Affect the production site

To integrate into production:
1. Add API endpoint for estimates
2. Connect to real database
3. Add CRUD operations (Create, Update, Delete estimates)
4. Add to navigation menu
5. Implement date range filtering
6. Add export to CSV functionality
7. Add charting/visualization options

## Future Enhancements
- Date range filters (last 30 days, quarter, year)
- Charts and graphs (pie charts for win/loss, trend lines)
- Export functionality (CSV, PDF reports)
- Comparison views (month-over-month, year-over-year)
- Team member performance (win rates per sales rep)
- Lost reason analysis (group by reasons)
- Revenue forecasting based on pending estimates
- Integration with accounting systems

## Files Created/Modified

### New Files
- `/src/pages/WinLossTest.jsx` - Main test page component with CSV import
- `/src/utils/csvParser.js` - CSV parsing and data processing utilities

### Modified Files  
- `/src/api/mockData.js` - Added `mockEstimates` array with sample data

### No Changes To
- Main LECRM navigation
- Routing configuration
- Layout component
- Any existing pages or features

## Your Actual Data Analysis

Based on your CSV file ("Estimate Test - Sheet1.csv"):
- **Total Records**: 458 estimates
- **Date Range**: All estimates from 2025
- **Customers**: Multiple unique customers (RioCan, Royop Development, Remington, etc.)
- **Key Fields Tracked**:
  - Contact Name (customer)
  - Estimate ID
  - Estimate Date
  - Sales Pipeline Status (Pending/Sold/Lost)
  - Total Price
  - Project Name
  - Salesperson & Estimator

The system will automatically calculate:
- Win rate per customer
- Total estimate value per customer
- Won vs Lost dollar amounts
- Breakdown of all 458 estimates by status





















