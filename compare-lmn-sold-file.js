/**
 * Compare "# of Estimates Sold (1).xlsx" with database to find missing estimates
 * This file contains the 1,057 estimates that LMN is counting
 */

import { createClient } from '@supabase/supabase-js';
import { filterEstimatesByYear, isWonStatus } from './src/utils/reportCalculations.js';
import dotenv from 'dotenv';
import XLSX from 'xlsx';
import fs from 'fs';

dotenv.config();

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.PROD_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function compareLMNSoldFile() {
  console.log('🔍 Comparing "# of Estimates Sold (1).xlsx" with database\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Find the Excel file
  const fileName = '# of Estimates Sold (1).xlsx';
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const possiblePaths = [
    fileName,
    `./${fileName}`,
    `./exports/${fileName}`,
    `./data/${fileName}`,
    `${homeDir}/Downloads/${fileName}`,
    `~/Downloads/${fileName}`,
    `/Users/${process.env.USER}/Downloads/${fileName}`
  ];

  let filePath = null;
  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      filePath = path;
      break;
    }
  }

  if (!filePath) {
    console.log('❌ File not found. Please provide the path to "# of Estimates Sold (1).xlsx"');
    console.log('\nSearched in:');
    possiblePaths.forEach(p => console.log(`  - ${p}`));
    console.log('\n💡 You can:');
    console.log('  1. Place the file in the project root');
    console.log('  2. Or provide the full path as an argument');
    return;
  }

  console.log(`📄 Found file: ${filePath}\n`);

  try {
    // Read Excel file
    console.log('📥 Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const lmnData = XLSX.utils.sheet_to_json(worksheet);
    console.log(`✅ Found ${lmnData.length} rows in Excel file\n`);

    // Show column names to understand structure
    if (lmnData.length > 0) {
      console.log('📋 Column names in Excel file:');
      Object.keys(lmnData[0]).forEach(key => console.log(`  - "${key}"`));
      console.log('\n📋 Sample row:');
      console.log(JSON.stringify(lmnData[0], null, 2));
      console.log('');
    }

    // Get estimate IDs from LMN file (try all possible column names)
    const lmnEstimateIds = new Set();
    lmnData.forEach(row => {
      // Try all possible column name variations
      const possibleIdColumns = [
        'Estimate ID', 'EstimateID', 'estimate_id', 'Estimate_Id',
        'LMN Estimate ID', 'lmn_estimate_id', 'LMN_Estimate_ID',
        'ID', 'id', 'Estimate Number', 'EstimateNumber', 'estimate_number',
        'Estimate #', 'Estimate#', 'Estimate No', 'EstimateNo'
      ];
      
      for (const col of possibleIdColumns) {
        if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
          const id = String(row[col]).trim();
          if (id) {
            lmnEstimateIds.add(id);
            break; // Found it, move to next row
          }
        }
      }
    });

    console.log(`📊 Found ${lmnEstimateIds.size} unique estimate IDs in LMN file\n`);
    
    if (lmnEstimateIds.size === 0 && lmnData.length > 0) {
      console.log('⚠️  Warning: Could not find estimate ID column. Showing first few rows:');
      lmnData.slice(0, 3).forEach((row, idx) => {
        console.log(`\nRow ${idx + 1}:`);
        Object.entries(row).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      });
      console.log('');
    }

    // Fetch estimates from database
    console.log('📥 Fetching estimates from Supabase...');
    const supabase = getSupabase();
    
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('id', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch estimates: ${error.message}`);
      }

      if (data && data.length > 0) {
        allEstimates = allEstimates.concat(data);
        page++;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`✅ Fetched ${allEstimates.length} estimates from database\n`);

    // Filter to 2025 sold estimates (our current logic)
    const ourSold2025 = filterEstimatesByYear(allEstimates, 2025, true, true);
    console.log(`📊 Our count (2025 sold): ${ourSold2025.length}`);
    console.log(`📊 LMN count (from file): ${lmnEstimateIds.size}`);
    console.log(`📊 Difference: ${Math.abs(lmnEstimateIds.size - ourSold2025.length)}\n`);

    // Create a map of our estimates by ID
    const ourEstimateMap = new Map();
    ourSold2025.forEach(est => {
      const id = est.lmn_estimate_id || est.estimate_number || est.id;
      if (id) {
        ourEstimateMap.set(String(id).trim(), est);
      }
    });

    // Find estimates in LMN file but not in our database
    const missingFromDB = [];
    lmnEstimateIds.forEach(lmnId => {
      if (!ourEstimateMap.has(lmnId)) {
        // Find the row in LMN data
        const lmnRow = lmnData.find(row => {
          const id = row['Estimate ID'] || row['EstimateID'] || row['estimate_id'] || 
                     row['LMN Estimate ID'] || row['lmn_estimate_id'] || 
                     row['ID'] || row['id'];
          return String(id).trim() === lmnId;
        });
        missingFromDB.push({ id: lmnId, row: lmnRow });
      }
    });

    // Find estimates in our database but not in LMN file
    const missingFromLMN = [];
    ourEstimateMap.forEach((est, id) => {
      if (!lmnEstimateIds.has(id)) {
        missingFromLMN.push(est);
      }
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 COMPARISON RESULTS:\n');
    console.log(`Estimates in LMN file but NOT in our database: ${missingFromDB.length}`);
    if (missingFromDB.length > 0) {
      console.log('\nMissing estimates (first 10):');
      missingFromDB.slice(0, 10).forEach(({ id, row }) => {
        console.log(`  - ID: ${id}`);
        if (row) {
          const status = row['Status'] || row['status'] || 'unknown';
          const closeDate = row['Estimate Close Date'] || row['estimate_close_date'] || row['Close Date'] || 'unknown';
          console.log(`    Status: ${status}`);
          console.log(`    Close Date: ${closeDate}`);
        }
      });
    }

    console.log(`\nEstimates in our database but NOT in LMN file: ${missingFromLMN.length}`);
    if (missingFromLMN.length > 0) {
      console.log('\nExtra estimates (first 10):');
      missingFromLMN.slice(0, 10).forEach(est => {
        console.log(`  - ID: ${est.lmn_estimate_id || est.estimate_number || est.id}`);
        console.log(`    Status: ${est.status}`);
        console.log(`    Pipeline Status: ${est.pipeline_status || 'null'}`);
        console.log(`    Close Date: ${est.estimate_close_date || 'null'}`);
      });
    }

    // Check if we can find the missing estimates in the full database (not just sold)
    if (missingFromDB.length > 0) {
      console.log('\n═══════════════════════════════════════════════════════════════');
      console.log('🔍 Checking if missing estimates exist in database (any status):\n');
      
      const foundInDB = [];
      missingFromDB.forEach(({ id }) => {
        const found = allEstimates.find(est => {
          const estId = est.lmn_estimate_id || est.estimate_number || est.id;
          return String(estId).trim() === id;
        });
        if (found) {
          foundInDB.push({ id, estimate: found });
        }
      });

      console.log(`Found ${foundInDB.length} of ${missingFromDB.length} missing estimates in database (with different status/filters):`);
      foundInDB.forEach(({ id, estimate }) => {
        console.log(`  - ID: ${id}`);
        console.log(`    Status: ${estimate.status}`);
        console.log(`    Pipeline Status: ${estimate.pipeline_status || 'null'}`);
        console.log(`    Close Date: ${estimate.estimate_close_date || 'null'}`);
        console.log(`    Exclude Stats: ${estimate.exclude_stats || false}`);
        console.log(`    Archived: ${estimate.archived || false}`);
        console.log(`    Price: ${estimate.total_price || estimate.total_price_with_tax || 0}`);
        console.log('');
      });
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY:\n');
    console.log(`LMN file count: ${lmnEstimateIds.size}`);
    console.log(`Our database count (2025 sold): ${ourSold2025.length}`);
    console.log(`Missing from our count: ${missingFromDB.length}`);
    console.log(`Extra in our count: ${missingFromLMN.length}`);
    
    if (lmnEstimateIds.size === ourSold2025.length && missingFromDB.length === 0 && missingFromLMN.length === 0) {
      console.log('\n✅ PERFECT MATCH!');
    } else {
      console.log('\n⚠️  Mismatch detected - see details above');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run if called directly
compareLMNSoldFile().catch(console.error);

export { compareLMNSoldFile };

