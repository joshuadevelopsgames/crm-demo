#!/usr/bin/env node

/**
 * Compare Our Database Data to LMN Excel Exports
 * 
 * Step 1: Compare our database to "Estimates List.xlsx" (the general export we import from)
 *         - Is our data exactly like the sheet, or have we filtered it?
 * 
 * Step 2: Compare "Estimates List.xlsx" to "Estimate List - Detailed Export.xlsx"
 *         - What's different between the two exports?
 */

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Load env
try {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^[\"']|[\"']$/g, '');
          if (!process.env[key]) process.env[key] = value;
        }
      }
    });
  }
} catch (e) {}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function normalizeId(id) {
  if (!id) return null;
  return id.toString().trim().toUpperCase();
}

function parseMoney(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  const str = String(value).replace(/[$,]/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 86400000);
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

async function compareData() {
  console.log('🔍 Comparing Our Database to LMN Excel Exports\n');
  console.log('='.repeat(60) + '\n');

  // Step 1: Read "Estimates List.xlsx" (the general export we import from)
  console.log('📖 Step 1: Reading "Estimates List.xlsx" (general export)...\n');
  
  const generalExportPath = join(homedir(), 'Downloads', 'Estimates List.xlsx');
  if (!existsSync(generalExportPath)) {
    console.error(`❌ File not found: ${generalExportPath}`);
    console.error('   Please make sure "Estimates List.xlsx" is in your Downloads folder.');
    process.exit(1);
  }

  const generalWorkbook = XLSX.readFile(generalExportPath);
  const generalSheet = generalWorkbook.Sheets[generalWorkbook.SheetNames[0]];
  const generalRows = XLSX.utils.sheet_to_json(generalSheet, { header: 1, defval: null });

  const generalHeaders = generalRows[0];
  const generalIdCol = generalHeaders.findIndex(h => h && (h.includes('Estimate ID') || h.includes('Estimate #')));
  const generalStatusCol = generalHeaders.findIndex(h => h && (h.includes('Status') || h.includes('Pipeline Status')));
  const generalPriceCol = generalHeaders.findIndex(h => h && (h.includes('Total Price') || h.includes('Price')));
  const generalDateCol = generalHeaders.findIndex(h => h && (h.includes('Close Date') || h.includes('Estimate Close Date')));
  const generalDivisionCol = generalHeaders.findIndex(h => h && h.includes('Division'));

  const generalEstimates = new Map();
  for (let i = 1; i < generalRows.length; i++) {
    const row = generalRows[i];
    if (!row || row.length === 0) continue;
    
    const id = normalizeId(row[generalIdCol]);
    if (id) {
      generalEstimates.set(id, {
        id,
        status: (row[generalStatusCol] || '').toString().trim(),
        price: parseMoney(row[generalPriceCol]),
        closeDate: parseDate(row[generalDateCol]),
        division: (row[generalDivisionCol] || '').toString().trim(),
      });
    }
  }

  console.log(`   Found ${generalEstimates.size} estimates in "Estimates List.xlsx"\n`);

  // Step 2: Fetch our database estimates
  console.log('📥 Step 2: Fetching our database estimates...\n');
  
  let allEstimates = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw error;

    if (data && data.length > 0) {
      allEstimates = allEstimates.concat(data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`   Found ${allEstimates.length} estimates in database\n`);

  // Create map of our estimates by ID
  const ourEstimates = new Map();
  allEstimates.forEach(est => {
    const id = normalizeId(est.lmn_estimate_id || est.estimate_number);
    if (id) {
      ourEstimates.set(id, est);
    }
  });

  console.log(`   Mapped ${ourEstimates.size} estimates by ID\n`);

  // Step 3: Compare our database to "Estimates List.xlsx"
  console.log('📊 Step 3: Comparing our database to "Estimates List.xlsx"...\n');

  const inGeneralButNotInOur = [];
  const inOurButNotInGeneral = [];
  const inBoth = [];

  generalEstimates.forEach((generalEst, id) => {
    if (ourEstimates.has(id)) {
      inBoth.push({ id, general: generalEst, ours: ourEstimates.get(id) });
    } else {
      inGeneralButNotInOur.push({ id, general: generalEst });
    }
  });

  ourEstimates.forEach((ourEst, id) => {
    if (!generalEstimates.has(id)) {
      inOurButNotInGeneral.push({ id, ours: ourEst });
    }
  });

  console.log(`   Estimates in "Estimates List.xlsx": ${generalEstimates.size}`);
  console.log(`   Estimates in our database: ${ourEstimates.size}`);
  console.log(`   In both: ${inBoth.length}`);
  console.log(`   In general export but NOT in our database: ${inGeneralButNotInOur.length}`);
  console.log(`   In our database but NOT in general export: ${inOurButNotInGeneral.length}\n`);

  if (inGeneralButNotInOur.length > 0) {
    console.log('⚠️  Estimates in "Estimates List.xlsx" but NOT in our database:');
    console.log(`   (showing first 20 of ${inGeneralButNotInOur.length})\n`);
    inGeneralButNotInOur.slice(0, 20).forEach(({ id, general }) => {
      console.log(`   ${id}: ${general.status}, $${general.price.toLocaleString()}, ${general.division}`);
    });
    console.log('');
  }

  if (inOurButNotInGeneral.length > 0) {
    console.log('⚠️  Estimates in our database but NOT in "Estimates List.xlsx":');
    console.log(`   (showing first 20 of ${inOurButNotInGeneral.length})\n`);
    inOurButNotInGeneral.slice(0, 20).forEach(({ id, ours }) => {
      const price = parseFloat(ours.total_price) || 0;
      console.log(`   ${id}: ${ours.status || 'N/A'}, $${price.toLocaleString()}, ${ours.division || 'N/A'}`);
    });
    console.log('');
  }

  // Step 4: Read "Estimate List - Detailed Export.xlsx"
  console.log('📖 Step 4: Reading "Estimate List - Detailed Export.xlsx" (detailed export)...\n');
  
  const detailedExportPath = join(homedir(), 'Downloads', 'Estimate List - Detailed Export.xlsx');
  if (!existsSync(detailedExportPath)) {
    console.error(`❌ File not found: ${detailedExportPath}`);
    console.error('   Please make sure "Estimate List - Detailed Export.xlsx" is in your Downloads folder.');
    process.exit(1);
  }

  const detailedWorkbook = XLSX.readFile(detailedExportPath);
  const detailedSheet = detailedWorkbook.Sheets[detailedWorkbook.SheetNames[0]];
  const detailedRows = XLSX.utils.sheet_to_json(detailedSheet, { header: 1, defval: null });

  const detailedHeaders = detailedRows[0];
  const detailedIdCol = detailedHeaders.findIndex(h => h && (h.includes('Estimate ID') || h.includes('Estimate #')));
  const detailedStatusCol = detailedHeaders.findIndex(h => h && (h.includes('Status') || h.includes('Pipeline Status')));
  const detailedPriceCol = detailedHeaders.findIndex(h => h && (h.includes('Total Price') || h.includes('Price')));
  const detailedDateCol = detailedHeaders.findIndex(h => h && (h.includes('Close Date') || h.includes('Estimate Close Date')));
  const detailedDivisionCol = detailedHeaders.findIndex(h => h && h.includes('Division'));

  const detailedEstimates = new Map();
  for (let i = 1; i < detailedRows.length; i++) {
    const row = detailedRows[i];
    if (!row || row.length === 0) continue;
    
    const id = normalizeId(row[detailedIdCol]);
    if (id) {
      detailedEstimates.set(id, {
        id,
        status: (row[detailedStatusCol] || '').toString().trim(),
        price: parseMoney(row[detailedPriceCol]),
        closeDate: parseDate(row[detailedDateCol]),
        division: (row[detailedDivisionCol] || '').toString().trim(),
      });
    }
  }

  console.log(`   Found ${detailedEstimates.size} estimates in "Estimate List - Detailed Export.xlsx"\n`);

  // Step 5: Compare "Estimates List.xlsx" to "Estimate List - Detailed Export.xlsx"
  console.log('📊 Step 5: Comparing "Estimates List.xlsx" to "Estimate List - Detailed Export.xlsx"...\n');

  const inGeneralButNotInDetailed = [];
  const inDetailedButNotInGeneral = [];
  const inBothExports = [];

  generalEstimates.forEach((generalEst, id) => {
    if (detailedEstimates.has(id)) {
      inBothExports.push({ id, general: generalEst, detailed: detailedEstimates.get(id) });
    } else {
      inGeneralButNotInDetailed.push({ id, general: generalEst });
    }
  });

  detailedEstimates.forEach((detailedEst, id) => {
    if (!generalEstimates.has(id)) {
      inDetailedButNotInGeneral.push({ id, detailed: detailedEst });
    }
  });

  console.log(`   Estimates in "Estimates List.xlsx": ${generalEstimates.size}`);
  console.log(`   Estimates in "Estimate List - Detailed Export.xlsx": ${detailedEstimates.size}`);
  console.log(`   In both exports: ${inBothExports.length}`);
  console.log(`   In general export but NOT in detailed export: ${inGeneralButNotInDetailed.length}`);
  console.log(`   In detailed export but NOT in general export: ${inDetailedButNotInGeneral.length}\n`);

  // Analyze differences
  if (inGeneralButNotInDetailed.length > 0) {
    console.log('📊 Estimates in "Estimates List.xlsx" but NOT in "Estimate List - Detailed Export.xlsx":');
    console.log(`   Total: ${inGeneralButNotInDetailed.length}\n`);
    
    const byStatus = {};
    const byDivision = {};
    
    inGeneralButNotInDetailed.forEach(({ general }) => {
      const status = general.status || 'Unknown';
      const division = general.division || 'Unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
      byDivision[division] = (byDivision[division] || 0) + 1;
    });
    
    console.log('   By Status:');
    Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`     ${status}: ${count}`);
    });
    
    console.log('\n   By Division:');
    Object.entries(byDivision).sort((a, b) => b[1] - a[1]).forEach(([division, count]) => {
      console.log(`     ${division}: ${count}`);
    });
    console.log('');
  }

  if (inDetailedButNotInGeneral.length > 0) {
    console.log('📊 Estimates in "Estimate List - Detailed Export.xlsx" but NOT in "Estimates List.xlsx":');
    console.log(`   Total: ${inDetailedButNotInGeneral.length}\n`);
    
    const byStatus = {};
    const byDivision = {};
    
    inDetailedButNotInGeneral.forEach(({ detailed }) => {
      const status = detailed.status || 'Unknown';
      const division = detailed.division || 'Unknown';
      byStatus[status] = (byStatus[status] || 0) + 1;
      byDivision[division] = (byDivision[division] || 0) + 1;
    });
    
    console.log('   By Status:');
    Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`     ${status}: ${count}`);
    });
    
    console.log('\n   By Division:');
    Object.entries(byDivision).sort((a, b) => b[1] - a[1]).forEach(([division, count]) => {
      console.log(`     ${division}: ${count}`);
    });
    console.log('');
  }

  // Export comparison
  console.log('💾 Exporting comparison results...\n');
  
  const comparisonCsv = [
    ['Estimate ID', 'In General Export', 'In Our Database', 'In Detailed Export', 'Status', 'Division', 'Price']
  ];

  const allIds = new Set([...generalEstimates.keys(), ...ourEstimates.keys(), ...detailedEstimates.keys()]);
  
  allIds.forEach(id => {
    const inGeneral = generalEstimates.has(id);
    const inOur = ourEstimates.has(id);
    const inDetailed = detailedEstimates.has(id);
    
    let status = '';
    let division = '';
    let price = '';
    
    if (inGeneral) {
      const est = generalEstimates.get(id);
      status = est.status;
      division = est.division;
      price = est.price;
    } else if (inOur) {
      const est = ourEstimates.get(id);
      status = est.status || '';
      division = est.division || '';
      price = parseFloat(est.total_price) || 0;
    } else if (inDetailed) {
      const est = detailedEstimates.get(id);
      status = est.status;
      division = est.division;
      price = est.price;
    }
    
    comparisonCsv.push([
      id,
      inGeneral ? 'Yes' : 'No',
      inOur ? 'Yes' : 'No',
      inDetailed ? 'Yes' : 'No',
      status,
      division,
      price
    ]);
  });

  writeFileSync('export_comparison.csv', comparisonCsv.map(row => row.join(',')).join('\n'));
  console.log('✅ Wrote export_comparison.csv\n');

  // Summary
  console.log('='.repeat(60));
  console.log('📊 SUMMARY\n');
  console.log('Step 1: Our Database vs "Estimates List.xlsx"');
  console.log(`   - In both: ${inBoth.length}`);
  console.log(`   - Missing from our DB: ${inGeneralButNotInOur.length}`);
  console.log(`   - Extra in our DB: ${inOurButNotInGeneral.length}\n`);
  
  console.log('Step 2: "Estimates List.xlsx" vs "Estimate List - Detailed Export.xlsx"');
  console.log(`   - In both: ${inBothExports.length}`);
  console.log(`   - Only in general: ${inGeneralButNotInDetailed.length}`);
  console.log(`   - Only in detailed: ${inDetailedButNotInGeneral.length}\n`);
}

compareData();

