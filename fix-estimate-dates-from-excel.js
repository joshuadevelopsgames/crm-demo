#!/usr/bin/env node

/**
 * Fix estimate dates by reading from Excel file and updating database
 * This backfills estimate_date and estimate_close_date for existing estimates
 */

import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Try to load .env file if it exists (for local development)
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
} catch (e) {
  console.error('Error loading .env file:', e);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables or .env file.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Parse Excel date (same logic as parser)
function parseDate(value) {
  if (!value) return null;
  // If it's an Excel serial date (number)
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // UTC: Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
    // Return as ISO timestamp with timezone (timestamptz format for database)
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00Z`; // Full ISO timestamp for timestamptz
  }
  // Try parsing as date string
  if (typeof value === 'string') {
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return `${isoMatch[0]}T00:00:00Z`; // Convert to ISO timestamp
    }
    // Try parsing as UTC date string
    if (value.includes('T') || value.includes('Z') || value.includes('+') || value.includes('-')) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getUTCFullYear();
        const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
        const day = String(parsed.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}T00:00:00Z`;
      }
    } else {
      const parsed = new Date(value + 'T00:00:00Z');
      if (!isNaN(parsed.getTime())) {
        const year = parsed.getUTCFullYear();
        const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
        const day = String(parsed.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}T00:00:00Z`;
      }
    }
  }
  return null;
}

async function fixEstimateDates() {
  console.log('🔧 Fixing estimate dates from Excel file...\n');

  const downloadsPath = join(homedir(), 'Downloads');
  // Try multiple possible filenames
  const possibleFiles = [
    'Estimates List (3).xlsx',
    'Estimates List.xlsx',
    'Estimates List (2).xlsx',
    'Estimates List (1).xlsx'
  ];
  
  let filePath = null;
  for (const filename of possibleFiles) {
    const path = join(downloadsPath, filename);
    if (existsSync(path)) {
      filePath = path;
      console.log(`✅ Found file: ${filename}`);
      break;
    }
  }
  
  if (!filePath) {
    console.error('❌ File not found. Tried:');
    possibleFiles.forEach(f => console.error(`   - ${f}`));
    console.error(`\n   Please make sure one of these files is in your Downloads folder.`);
    process.exit(1);
  }

  try {
    // Read Excel file
    console.log('📖 Reading Excel file...');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    const rows = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      defval: null,
      raw: true // Keep raw values to see Excel serial dates
    });
    
    if (rows.length < 2) {
      console.error('❌ Excel file appears to be empty or has no data rows');
      process.exit(1);
    }
    
    const headers = rows[0];
    const estimateIdIndex = headers.findIndex(h => h === 'Estimate ID');
    const estimateDateIndex = headers.findIndex(h => h === 'Estimate Date');
    const estimateCloseDateIndex = headers.findIndex(h => h === 'Estimate Close Date');
    
    if (estimateIdIndex === -1) {
      console.error('❌ Could not find "Estimate ID" column in Excel file');
      process.exit(1);
    }
    
    console.log(`✅ Found columns: Estimate ID (${estimateIdIndex}), Estimate Date (${estimateDateIndex}), Estimate Close Date (${estimateCloseDateIndex})\n`);
    
    // Build map of estimate ID -> dates from Excel
    const excelDates = new Map();
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const estimateId = row[estimateIdIndex]?.toString().trim();
      if (!estimateId) continue;
      
      const estimateDate = parseDate(row[estimateDateIndex]);
      const estimateCloseDate = parseDate(row[estimateCloseDateIndex]);
      
      excelDates.set(estimateId, {
        estimate_date: estimateDate,
        estimate_close_date: estimateCloseDate
      });
    }
    
    console.log(`📊 Loaded ${excelDates.size} estimates from Excel file\n`);
    
    // Fetch all estimates from database
    console.log('📥 Fetching estimates from database...');
    let allEstimates = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, lmn_estimate_id, estimate_date, estimate_close_date')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) {
        console.error('❌ Error fetching estimates:', error);
        process.exit(1);
      }
      
      if (data && data.length > 0) {
        allEstimates = allEstimates.concat(data);
        hasMore = data.length === pageSize;
        page++;
      } else {
        hasMore = false;
      }
    }
    
    console.log(`📊 Found ${allEstimates.length} estimates in database\n`);
    
    // Find estimates that need dates updated
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const toUpdate = [];
    
    for (const estimate of allEstimates) {
      const estimateId = estimate.lmn_estimate_id;
      if (!estimateId) {
        skippedCount++;
        continue;
      }
      
      const excelData = excelDates.get(estimateId);
      if (!excelData) {
        skippedCount++;
        continue; // Not in Excel file
      }
      
      // Check if dates need updating
      const needsUpdate = 
        (!estimate.estimate_date && excelData.estimate_date) ||
        (!estimate.estimate_close_date && excelData.estimate_close_date) ||
        (estimate.estimate_date !== excelData.estimate_date) ||
        (estimate.estimate_close_date !== excelData.estimate_close_date);
      
      if (needsUpdate) {
        toUpdate.push({
          id: estimate.id,
          estimateId: estimateId,
          estimate_date: excelData.estimate_date,
          estimate_close_date: excelData.estimate_close_date
        });
      } else {
        skippedCount++;
      }
    }
    
    console.log(`📋 Found ${toUpdate.length} estimates that need date updates\n`);
    
    if (toUpdate.length === 0) {
      console.log('✅ All estimates already have correct dates!');
      return;
    }
    
    // Update in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(toUpdate.length / BATCH_SIZE);
      
      console.log(`📝 Updating batch ${batchNum}/${totalBatches} (${batch.length} estimates)...`);
      
      const updatePromises = batch.map(async (item) => {
        try {
          const { error } = await supabase
            .from('estimates')
            .update({
              estimate_date: item.estimate_date,
              estimate_close_date: item.estimate_close_date
            })
            .eq('id', item.id);
          
          if (error) {
            console.error(`❌ Error updating estimate ${item.estimateId}:`, error.message);
            errorCount++;
            return false;
          }
          
          updatedCount++;
          return true;
        } catch (err) {
          console.error(`❌ Error updating estimate ${item.estimateId}:`, err.message);
          errorCount++;
          return false;
        }
      });
      
      await Promise.all(updatePromises);
      
      if (batchNum % 10 === 0 || batchNum === totalBatches) {
        console.log(`  ✅ Updated ${updatedCount} estimates so far...`);
      }
    }
    
    console.log('\n📊 Summary:');
    console.log('══════════════════════════════════════════════════');
    console.log(`  ✅ Updated: ${updatedCount} estimates`);
    console.log(`  ⏭️  Skipped: ${skippedCount} estimates (already have dates or not in Excel)`);
    console.log(`  ❌ Errors: ${errorCount} estimates`);
    console.log('══════════════════════════════════════════════════');
    
    console.log('\n✨ Date fix complete! Estimates now have dates from Excel file.');
    
  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }
}

fixEstimateDates();

