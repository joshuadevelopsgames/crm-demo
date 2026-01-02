#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Load env
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

// Try multiple possible env variable names
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('Current env vars:', {
    hasSUPABASE_URL: !!process.env.SUPABASE_URL,
    hasVITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
    hasSUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Parse date (same logic as parser)
const parseDate = (value) => {
  if (!value) return null;
  if (typeof value === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'string') {
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return isoMatch[0];
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear();
      const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const day = String(parsed.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return null;
};

// Check if won status
const isWonStatus = (status) => {
  if (!status) return false;
  const stat = String(status).toLowerCase().trim();
  return (
    stat === 'email contract award' ||
    stat === 'verbal contract award' ||
    stat === 'work complete' ||
    stat === 'work in progress' ||
    stat === 'billing complete' ||
    stat === 'contract signed' ||
    stat.includes('email contract award') ||
    stat.includes('verbal contract award') ||
    stat.includes('work complete') ||
    stat.includes('billing complete') ||
    stat.includes('contract signed')
  );
};

async function fixContractEndDates() {
  console.log('🔧 Fixing contract_end dates for won estimates...\n');

  // Read Excel file
  const filePath = join(homedir(), 'Downloads', 'Estimates List.xlsx');
  if (!existsSync(filePath)) {
    console.error('❌ Could not find Estimates List.xlsx in Downloads');
    process.exit(1);
  }

  console.log(`📖 Reading: ${filePath}\n`);
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, header: 1 });

  const headers = rows[0];
  const statusIndex = headers.findIndex(h => h === 'Status');
  const contractEndIndex = headers.findIndex(h => h === 'Contract End');
  const estimateIdIndex = headers.findIndex(h => h === 'Estimate ID');

  if (statusIndex < 0 || contractEndIndex < 0 || estimateIdIndex < 0) {
    console.error('❌ Required columns not found');
    process.exit(1);
  }

  // Get all estimates from database
  const { data: dbEstimates, error: fetchError } = await supabase
    .from('estimates')
    .select('id, lmn_estimate_id, status, contract_end');

  if (fetchError) {
    console.error('❌ Error fetching estimates:', fetchError);
    process.exit(1);
  }

  console.log(`📊 Found ${dbEstimates.length} estimates in database\n`);

  // Create map of lmn_estimate_id -> database estimate
  const dbMap = new Map();
  dbEstimates.forEach(e => {
    if (e.lmn_estimate_id) {
      dbMap.set(e.lmn_estimate_id, e);
    }
  });

  // Process Excel rows
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const estimateId = row[estimateIdIndex]?.toString().trim();
    if (!estimateId) continue;

    const status = row[statusIndex];
    if (!isWonStatus(status)) continue;

    const contractEndRaw = row[contractEndIndex];
    const contractEndParsed = parseDate(contractEndRaw);

    if (!contractEndParsed) continue; // Skip if no contract_end date

    // Find matching database estimate
    const dbEstimate = dbMap.get(estimateId);
    if (!dbEstimate) {
      skipped++;
      continue; // Estimate not in database
    }

    // Check if it needs updating
    const currentContractEnd = dbEstimate.contract_end 
      ? new Date(dbEstimate.contract_end).toISOString().split('T')[0]
      : null;

    if (currentContractEnd === contractEndParsed) {
      skipped++;
      continue; // Already correct
    }

    // Update it
    try {
      // Convert YYYY-MM-DD to ISO timestamp for Supabase
      const contractEndTimestamp = `${contractEndParsed}T00:00:00Z`;

      const { error: updateError } = await supabase
        .from('estimates')
        .update({ 
          contract_end: contractEndTimestamp,
          updated_at: new Date().toISOString()
        })
        .eq('id', dbEstimate.id);

      if (updateError) {
        console.error(`❌ Error updating ${estimateId}:`, updateError.message);
        errors++;
      } else {
        updated++;
        if (updated % 50 === 0) {
          console.log(`   Updated ${updated} estimates...`);
        }
      }
    } catch (error) {
      console.error(`❌ Error updating ${estimateId}:`, error.message);
      errors++;
    }
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('══════════════════════════════════════════════════');
  console.log(`✅ Updated: ${updated} estimates`);
  console.log(`⏭️  Skipped: ${skipped} estimates (already correct or not in DB)`);
  console.log(`❌ Errors: ${errors} estimates`);
  console.log('\n✨ Done! Now run createRenewalNotifications() to mark accounts as at-risk.');
}

fixContractEndDates();

