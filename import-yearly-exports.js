#!/usr/bin/env node

/**
 * Import Yearly Detailed Export Files
 * 
 * Imports all yearly detailed export files and stores them in the database
 * as the source of truth for yearly reports.
 */

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import { readdirSync, readFileSync, existsSync } from 'fs';
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
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + value * 86400000);
  }
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

async function importYearlyExports() {
  console.log('📥 Importing Yearly Detailed Export Files\n');
  console.log('='.repeat(60) + '\n');

  const folderPath = join(homedir(), 'Downloads', 'estimates reports lists');
  const files = readdirSync(folderPath)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .sort();

  // File to year mapping (from analysis)
  const fileYearMap = {
    'Estimate List - Detailed Export.xlsx': 2025,
    'Estimate List - Detailed Export (1).xlsx': 2024,
    'Estimate List - Detailed Export (2).xlsx': 2023,
    'Estimate List - Detailed Export (3).xlsx': 2022,
    'Estimate List - Detailed Export (4).xlsx': 2022, // Merge with (3)
  };

  const yearlyData = {};

  // Process each file
  for (const fileName of files) {
    const year = fileYearMap[fileName];
    if (!year) {
      console.log(`⚠️  Skipping ${fileName} - year not mapped`);
      continue;
    }

    console.log(`📖 Processing ${fileName} (Year: ${year})...\n`);

    try {
      const filePath = join(folderPath, fileName);
      const workbook = XLSX.readFile(filePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

      if (rows.length < 2) {
        console.log('   ⚠️  Empty file, skipping');
        continue;
      }

      const headers = rows[0];
      const idCol = headers.findIndex(h => h && (h.includes('Estimate ID') || h.includes('Estimate #')));
      const statusCol = headers.findIndex(h => h && (h.includes('Status') || h.includes('Pipeline Status')));
      const priceCol = headers.findIndex(h => h && (h.includes('Total Price') || h.includes('Price')));
      const dateCol = headers.findIndex(h => h && (h.includes('Close Date') || h.includes('Estimate Close Date')));
      const divisionCol = headers.findIndex(h => h && h.includes('Division'));

      if (!yearlyData[year]) {
        yearlyData[year] = [];
      }

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        const id = normalizeId(row[idCol]);
        if (!id) continue;

        // Check if already exists (for 2022 merge)
        const exists = yearlyData[year].find(e => e.lmn_estimate_id === id);
        if (exists) {
          console.log(`   ⚠️  Duplicate estimate ${id} in year ${year}, skipping`);
          continue;
        }

        yearlyData[year].push({
          lmn_estimate_id: id,
          status: (row[statusCol] || '').toString().trim(),
          total_price: parseMoney(row[priceCol]),
          estimate_close_date: parseDate(row[dateCol]),
          division: (row[divisionCol] || '').toString().trim(),
          source_year: year,
          source_file: fileName,
          is_official_lmn_data: true, // Flag as official LMN data
        });
      }

      console.log(`   ✅ Imported ${yearlyData[year].length} estimates for ${year}\n`);
    } catch (error) {
      console.error(`   ❌ Error processing ${fileName}: ${error.message}\n`);
    }
  }

  // Store in database
  console.log('💾 Storing in database...\n');

  // First, check if we need to create a table for yearly official data
  // For now, we'll store it in a JSON file and create an API endpoint
  // Or we could add a field to existing estimates table

  // Option 1: Store as JSON file (simple, no DB changes needed)
  const fs = await import('fs');
  const yearlyDataJson = JSON.stringify(yearlyData, null, 2);
  fs.writeFileSync('yearly_official_data.json', yearlyDataJson);
  console.log('✅ Wrote yearly_official_data.json\n');

  // Option 2: Create/update estimates with official flag
  console.log('📊 Summary by Year:\n');
  Object.keys(yearlyData).sort().forEach(year => {
    const data = yearlyData[year];
    const sold = data.filter(e => {
      const status = (e.status || '').toLowerCase();
      return status.includes('sold') || 
             status === 'contract signed' ||
             status === 'work complete' ||
             status === 'billing complete';
    });
    const soldDollar = sold.reduce((sum, e) => sum + (e.total_price || 0), 0);
    
    console.log(`  ${year}:`);
    console.log(`    Total: ${data.length} estimates`);
    console.log(`    Sold: ${sold.length} estimates ($${soldDollar.toLocaleString()})`);
  });

  console.log('\n✅ Import complete!\n');
  console.log('Next steps:');
  console.log('  1. Create API endpoint to serve this data');
  console.log('  2. Update Reports page to use this as source of truth');
  console.log('  3. Add UI to show which data source is being used');
}

importYearlyExports();

