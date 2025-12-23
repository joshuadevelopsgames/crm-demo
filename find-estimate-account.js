import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse Excel file to find EST5574448
const filePath = join(__dirname, '../Downloads/Triovest Estimates List.xlsx');
console.log('Reading file:', filePath);

const workbook = XLSX.read(readFileSync(filePath), { type: 'buffer' });
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });

const headers = rows[0];
const colMap = {
  estimateId: headers.findIndex(h => h === 'Estimate ID'),
  contactName: headers.findIndex(h => h === 'Contact Name'),
  contactId: headers.findIndex(h => h === 'Contact ID'),
  estimateDate: headers.findIndex(h => h === 'Estimate Date'),
  contractStart: headers.findIndex(h => h === 'Contract Start'),
  contractEnd: headers.findIndex(h => h === 'Contract End'),
  totalPrice: headers.findIndex(h => h === 'Total Price'),
  totalPriceWithTax: headers.findIndex(h => h === 'Total Price With Tax'),
  status: headers.findIndex(h => h === 'Status'),
  projectName: headers.findIndex(h => h === 'Project Name')
};

console.log('\n=== SEARCHING FOR EST5574448 ===\n');

let found = false;
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;
  
  const estimateId = row[colMap.estimateId]?.toString().trim();
  
  if (estimateId === '5574448' || estimateId === 'EST5574448' || estimateId.includes('5574448')) {
    found = true;
    console.log('FOUND ESTIMATE:');
    console.log(`  Estimate ID: ${estimateId}`);
    console.log(`  Contact Name: ${row[colMap.contactName] || 'N/A'}`);
    console.log(`  Contact ID: ${row[colMap.contactId] || 'N/A'}`);
    console.log(`  Project Name: ${row[colMap.projectName] || 'N/A'}`);
    console.log(`  Estimate Date: ${row[colMap.estimateDate] || 'N/A'}`);
    console.log(`  Contract Start: ${row[colMap.contractStart] || 'N/A'}`);
    console.log(`  Contract End: ${row[colMap.contractEnd] || 'N/A'}`);
    console.log(`  Total Price: ${row[colMap.totalPrice] || 'N/A'}`);
    console.log(`  Total Price With Tax: ${row[colMap.totalPriceWithTax] || 'N/A'}`);
    console.log(`  Status: ${row[colMap.status] || 'N/A'}`);
    break;
  }
}

if (!found) {
  console.log('EST5574448 NOT FOUND in Excel file.');
  console.log('\nChecking for similar IDs...');
  
  // Check for similar IDs
  const similarIds = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const estimateId = row[colMap.estimateId]?.toString().trim() || '';
    if (estimateId.includes('557') || estimateId.includes('4448')) {
      similarIds.push({
        id: estimateId,
        contactName: row[colMap.contactName] || 'N/A',
        contactId: row[colMap.contactId] || 'N/A'
      });
    }
  }
  
  if (similarIds.length > 0) {
    console.log(`\nFound ${similarIds.length} similar estimate IDs:`);
    similarIds.forEach(item => {
      console.log(`  ${item.id} - Contact: ${item.contactName} (ID: ${item.contactId})`);
    });
  }
  
  // List all unique contact names to help identify
  console.log('\n=== ALL CONTACT NAMES IN FILE ===\n');
  const contactNames = new Set();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const contactName = row[colMap.contactName]?.toString().trim();
    if (contactName) {
      contactNames.add(contactName);
    }
  }
  
  const sortedContacts = Array.from(contactNames).sort();
  console.log(`Total unique contacts: ${sortedContacts.length}`);
  sortedContacts.forEach(name => {
    console.log(`  - ${name}`);
  });
}

