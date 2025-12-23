import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// UI breakdown estimate IDs (from the user's breakdown)
const uiEstimateIds = [
  'EST2949022', 'EST2948972', 'EST2949003', 'EST3015462', 'EST3015636', 'EST3015715', 'EST3015813',
  'EST5206145', 'EST5255379', 'EST5255410', 'EST5263149', 'EST5334065', 'EST5334084', 'EST5334273',
  'EST5334250', 'EST5334226', 'EST5334122', 'EST5334039', 'EST5334212', 'EST5367065', 'EST5432414',
  'EST5432422', 'EST5436938', 'EST5850847', 'EST5450865', 'EST5850859', 'EST5850652', 'EST5850941',
  'EST5850929', 'EST5850908', 'EST5850892', 'EST5850874', 'EST5850796', 'EST5850780', 'EST5850726',
  'EST5850702', 'EST5850683', 'EST5850994', 'EST5850973', 'EST5850958', 'EST5450635', 'EST5455650',
  'EST5457122', 'EST5456796', 'EST5850755', 'EST5482169', 'EST5497919', 'EST5492965', 'EST5492918',
  'EST5507681', 'EST5554724', 'EST5554750', 'EST5552200', 'EST5562364', 'EST5560678', 'EST5562797',
  'EST5567905', 'EST5575757', 'EST5574448', 'EST5599711', 'EST5609396', 'EST5649036', 'EST5669679',
  'EST5669644', 'EST3270334', 'EST3270368', 'EST3270381', 'EST3270794', 'EST3299572', 'EST5770273',
  'EST5770259', 'EST5814054', 'EST5838658', 'EST5333954'
];

// Parse Excel file
const filePath = join(__dirname, '../Downloads/Triovest Estimates List.xlsx');
console.log('Reading file:', filePath);

const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer' });
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

const headers = rows[0];
const colMap = {
  estimateId: headers.findIndex(h => h === 'Estimate ID'),
  estimateDate: headers.findIndex(h => h === 'Estimate Date'),
  contractStart: headers.findIndex(h => h === 'Contract Start'),
  contractEnd: headers.findIndex(h => h === 'Contract End'),
  totalPrice: headers.findIndex(h => h === 'Total Price'),
  totalPriceWithTax: headers.findIndex(h => h === 'Total Price With Tax'),
  status: headers.findIndex(h => h === 'Status')
};

const excelEstimateIds = new Set();

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;
  
  const estimateId = row[colMap.estimateId]?.toString().trim();
  if (estimateId) {
    excelEstimateIds.add(estimateId);
  }
}

console.log(`\n=== COMPARISON ===\n`);
console.log(`UI shows: ${uiEstimateIds.length} estimates`);
console.log(`Excel file has: ${excelEstimateIds.size} total estimates`);

// Find estimates in UI but not in Excel
const missingFromExcel = uiEstimateIds.filter(id => !excelEstimateIds.has(id));

console.log(`\n=== ESTIMATES IN UI BUT NOT IN EXCEL ===\n`);
if (missingFromExcel.length === 0) {
  console.log('All UI estimates are in the Excel file.');
} else {
  console.log(`Found ${missingFromExcel.length} estimate(s) in UI that are NOT in Excel:`);
  missingFromExcel.forEach(id => {
    console.log(`  - ${id}`);
  });
}

// Find estimates in Excel but not in UI (for reference)
const missingFromUI = Array.from(excelEstimateIds).filter(id => !uiEstimateIds.includes(id));

console.log(`\n=== ESTIMATES IN EXCEL BUT NOT IN UI (excluded estimates) ===\n`);
console.log(`Found ${missingFromUI.length} estimate(s) in Excel that are NOT in UI breakdown:`);
if (missingFromUI.length > 0 && missingFromUI.length <= 50) {
  missingFromUI.slice(0, 20).forEach(id => {
    console.log(`  - ${id}`);
  });
  if (missingFromUI.length > 20) {
    console.log(`  ... and ${missingFromUI.length - 20} more`);
  }
}

// Check if there are any estimates that match but with different formatting
console.log(`\n=== CHECKING FOR FORMATTING DIFFERENCES ===\n`);
const excelIdsArray = Array.from(excelEstimateIds);
const uiIdsSet = new Set(uiEstimateIds);

// Check if any Excel IDs are close matches (e.g., missing EST prefix)
const potentialMatches = [];
excelIdsArray.forEach(excelId => {
  if (!uiIdsSet.has(excelId)) {
    // Check if it's just the number part
    const numberPart = excelId.replace(/^EST/i, '');
    const withPrefix = `EST${numberPart}`;
    if (uiIdsSet.has(withPrefix)) {
      potentialMatches.push({ excel: excelId, ui: withPrefix });
    }
  }
});

if (potentialMatches.length > 0) {
  console.log('Potential formatting differences found:');
  potentialMatches.forEach(m => {
    console.log(`  Excel: "${m.excel}" might match UI: "${m.ui}"`);
  });
} else {
  console.log('No obvious formatting differences found.');
}

