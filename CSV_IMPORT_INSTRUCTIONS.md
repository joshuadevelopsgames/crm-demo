# CSV Import Instructions for Win/Loss System

## Quick Start

1. **Start your development server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Add the test route** to `src/App.jsx`:
   ```jsx
   // Add import at top
   import WinLossTest from './pages/WinLossTest';
   
   // Add route inside Routes section
   <Route path="/win-loss-test" element={<WinLossTest />} />
   ```

3. **Navigate to the page**:
   ```
   http://localhost:5173/win-loss-test
   ```

4. **Upload your CSV**:
   - Click the blue "Upload CSV" button
   - Select `Estimate Test - Sheet1.csv` from your Downloads folder
   - Wait for processing (should be instant)
   - View your real data analyzed!

## What You'll See

### Dashboard Overview
- **Total Estimates**: All 458 estimates from your CSV
- **Estimates Won**: Count and total dollar value
- **Estimates Lost**: Count and total dollar value
- **Overall Win Rate**: Percentage of won estimates
- **Pending Estimates**: Count of estimates in progress

### Per-Customer Analytics
For each customer in your CSV, you'll see:
- Company name (e.g., "Royop Development Ltd", "RioCan", etc.)
- Total number of estimates submitted
- Number won, lost, and pending
- Win rate percentage
- Total dollar value of all estimates
- Won value and Lost value breakdowns

### Detailed Estimates Table
Filterable list showing:
- Estimate ID (e.g., EST3414942)
- Customer name
- Estimate date
- Project description
- Amount
- Status (Won/Lost/Pending)

## Status Mapping

Your CSV's "Sales Pipeline Status" and "Status" fields are automatically mapped:

### WON Statuses
- "Sold"
- "Contract Signed"
- "Email Contract Award"
- "Verbal Contract Award"

### LOST Statuses
- "Lost"
- "Estimate Lost"
- "Estimate Lost - Price too high"

### PENDING Statuses
- "Pending"
- "Estimate In Progress"

## Your Data Overview

From your CSV file:
- **458 total estimates**
- **Date range**: 2025 estimates
- **Multiple customers** tracked
- **Various project types**: Year Round Maintenance, Winter Maintenance, Snow Removal, etc.
- **Price range**: From $200 to $535,909
- **Sales team tracked**: Danny Goring, Jesse Pentland, Jonathan Hopkins, etc.

## Example Customers in Your Data

Based on the CSV preview, you have estimates for:
- **Riverglen Park Townhouse Complex**
- **Collective Waste Solutions**
- **Opus Corporation**
- **RioCan**
- **Royop Development Ltd** (many locations)
- **Hopewell Real Estate Service LP**
- **Remington Development Corporation**
- **BentallGreenOak**
- And many more...

## Benefits of This System

### Business Intelligence
- **Identify your best customers**: Which ones have the highest win rates?
- **Spot patterns**: Are certain types of projects won more often?
- **Track performance**: Overall win rate and trends
- **Value analysis**: How much revenue is won vs. lost?

### Strategic Insights
- **Focus efforts**: Concentrate on customers with high win rates
- **Pricing analysis**: Are you losing due to price? (tracked in lost reasons)
- **Pipeline health**: How many estimates are pending?
- **Revenue forecasting**: Based on pending estimates and historical win rates

## Next Steps

After viewing your data, you can:
1. **Identify top customers** by win rate
2. **Analyze lost estimates** to understand why deals don't close
3. **Calculate monthly/quarterly trends** (future enhancement)
4. **Integrate into main CRM** for permanent tracking
5. **Add more features** like date range filters, charts, exports

## Troubleshooting

### CSV Won't Upload
- Make sure the file is in CSV format (not Excel)
- Check that it has the header row with column names
- Verify it's the correct file (Estimate Test - Sheet1.csv)

### Data Looks Wrong
- Check that the CSV hasn't been modified
- Ensure the "Sales Pipeline Status" column has values
- Verify "Total Price" column has numeric values

### No Customers Showing
- Check that "Contact Name" column has values
- Make sure estimates have valid dates
- Confirm "Total Price" is not zero

## File Locations

- **Test Page**: `/src/pages/WinLossTest.jsx`
- **CSV Parser**: `/src/utils/csvParser.js`
- **Mock Data**: `/src/api/mockData.js`
- **Documentation**: `/WIN_LOSS_TEST_SETUP.md`

## Support

If you need modifications:
- Add date range filters
- Add charts/graphs
- Export to PDF or Excel
- Add more customer details
- Track by salesperson
- Compare time periods

Just ask and I can implement additional features!






















