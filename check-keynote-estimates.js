import * as XLSX from 'xlsx';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse Excel file to check for Keynote-related accounts/contacts
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
  totalPrice: headers.findIndex(h => h === 'Total Price'),
  totalPriceWithTax: headers.findIndex(h => h === 'Total Price With Tax'),
  status: headers.findIndex(h => h === 'Status')
};

console.log('\n=== SEARCHING FOR KEYNOTE-RELATED ESTIMATES ===\n');

const keynoteEstimates = [];
const allContactNames = new Set();

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;
  
  const estimateId = row[colMap.estimateId]?.toString().trim();
  const contactName = row[colMap.contactName]?.toString().trim() || '';
  const totalPrice = row[colMap.totalPrice];
  const totalPriceWithTax = row[colMap.totalPriceWithTax];
  
  if (contactName) {
    allContactNames.add(contactName);
  }
  
  if (contactName.toLowerCase().includes('keynote')) {
    keynoteEstimates.push({
      estimateId,
      contactName,
      contactId: row[colMap.contactId]?.toString().trim() || 'N/A',
      estimateDate: row[colMap.estimateDate] || 'N/A',
      totalPrice: totalPrice || 0,
      totalPriceWithTax: totalPriceWithTax || 0,
      status: row[colMap.status] || 'N/A'
    });
  }
}

if (keynoteEstimates.length > 0) {
  console.log(`Found ${keynoteEstimates.length} estimate(s) with "Keynote" in contact name:\n`);
  keynoteEstimates.forEach(est => {
    console.log(`  Estimate ID: ${est.estimateId}`);
    console.log(`  Contact Name: ${est.contactName}`);
    console.log(`  Contact ID: ${est.contactId}`);
    console.log(`  Estimate Date: ${est.estimateDate}`);
    console.log(`  Total Price: $${est.totalPrice}`);
    console.log(`  Total Price With Tax: $${est.totalPriceWithTax}`);
    console.log(`  Status: ${est.status}`);
    console.log('  ---');
  });
} else {
  console.log('No estimates found with "Keynote" in contact name.');
}

console.log(`\n=== CHECKING FOR EST5574448 SPECIFICALLY ===\n`);
const est5574448 = rows.find((row, idx) => {
  if (idx === 0) return false; // Skip header
  const estimateId = row[colMap.estimateId]?.toString().trim();
  return estimateId === '5574448' || estimateId === 'EST5574448' || estimateId.includes('5574448');
});

if (est5574448) {
  console.log('FOUND in Excel:');
  console.log(`  Estimate ID: ${est5574448[colMap.estimateId]}`);
  console.log(`  Contact Name: ${est5574448[colMap.contactName] || 'N/A'}`);
  console.log(`  Contact ID: ${est5574448[colMap.contactId] || 'N/A'}`);
  console.log(`  Total Price: ${est5574448[colMap.totalPrice] || 'N/A'}`);
  console.log(`  Total Price With Tax: ${est5574448[colMap.totalPriceWithTax] || 'N/A'}`);
} else {
  console.log('EST5574448 NOT FOUND in Excel file.');
  console.log('\nThis confirms the estimate exists in the database but not in your Excel export.');
}

console.log(`\n=== ALL UNIQUE CONTACT NAMES (to verify Triovest contacts) ===\n`);
const sortedContacts = Array.from(allContactNames).sort();
console.log(`Total unique contacts: ${sortedContacts.length}`);
const triovestContacts = sortedContacts.filter(name => 
  name.toLowerCase().includes('triovest') || 
  name.toLowerCase().includes('keynote')
);
if (triovestContacts.length > 0) {
  console.log(`\nTriovest/Keynote related contacts (${triovestContacts.length}):`);
  triovestContacts.forEach(name => {
    console.log(`  - ${name}`);
  });
}

