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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
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

// Check if won status (same logic as parser)
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

async function investigateMismatch() {
  console.log('🔍 Investigating contract_end mismatch...\n');

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

  // Get all estimates from database
  const { data: dbEstimates, error: fetchError } = await supabase
    .from('estimates')
    .select('id, lmn_estimate_id, status, contract_end');

  if (fetchError) {
    console.error('❌ Error fetching estimates:', fetchError);
    process.exit(1);
  }

  console.log(`📊 Found ${dbEstimates.length} estimates in database\n`);

  // Create maps
  const dbMap = new Map(); // lmn_estimate_id -> db estimate
  dbEstimates.forEach(e => {
    if (e.lmn_estimate_id) {
      dbMap.set(e.lmn_estimate_id, e);
    }
  });

  // Categorize Excel estimates
  const excelWonWithContractEnd = [];
  const excelWonWithoutContractEnd = [];
  const excelNotWon = [];
  const excelNotInDb = [];
  const excelInDbButNotWon = [];
  const excelInDbWonButAlreadyHasContractEnd = [];
  const excelInDbWonNeedsUpdate = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const estimateId = row[estimateIdIndex]?.toString().trim();
    if (!estimateId) continue;

    const status = row[statusIndex];
    const contractEndRaw = row[contractEndIndex];
    const contractEndParsed = parseDate(contractEndRaw);

    const isWon = isWonStatus(status);
    const hasContractEnd = !!contractEndParsed;

    if (!isWon) {
      excelNotWon.push({ estimateId, status });
      continue;
    }

    if (!hasContractEnd) {
      excelWonWithoutContractEnd.push({ estimateId, status });
      continue;
    }

    // Won with contract_end
    excelWonWithContractEnd.push({ estimateId, status, contractEnd: contractEndParsed });

    // Check database
    const dbEstimate = dbMap.get(estimateId);
    if (!dbEstimate) {
      excelNotInDb.push({ estimateId, status, contractEnd: contractEndParsed });
      continue;
    }

    if (dbEstimate.status !== 'won') {
      excelInDbButNotWon.push({ 
        estimateId, 
        excelStatus: status, 
        dbStatus: dbEstimate.status,
        contractEnd: contractEndParsed 
      });
      continue;
    }

    // Check if already has contract_end
    const currentContractEnd = dbEstimate.contract_end 
      ? new Date(dbEstimate.contract_end).toISOString().split('T')[0]
      : null;

    if (currentContractEnd === contractEndParsed) {
      excelInDbWonButAlreadyHasContractEnd.push({ 
        estimateId, 
        contractEnd: contractEndParsed 
      });
    } else {
      excelInDbWonNeedsUpdate.push({ 
        estimateId, 
        excelContractEnd: contractEndParsed,
        dbContractEnd: currentContractEnd
      });
    }
  }

  console.log('══════════════════════════════════════════════════');
  console.log('📊 ANALYSIS RESULTS');
  console.log('══════════════════════════════════════════════════\n');

  console.log(`📋 Excel File Analysis:`);
  console.log(`   Total won estimates with contract_end: ${excelWonWithContractEnd.length}`);
  console.log(`   Total won estimates without contract_end: ${excelWonWithoutContractEnd.length}`);
  console.log(`   Total not won: ${excelNotWon.length}\n`);

  console.log(`💾 Database Matching:`);
  console.log(`   ✅ In DB, won, already has correct contract_end: ${excelInDbWonButAlreadyHasContractEnd.length}`);
  console.log(`   ⚠️  In DB, won, needs contract_end update: ${excelInDbWonNeedsUpdate.length}`);
  console.log(`   ❌ In DB but NOT marked as won: ${excelInDbButNotWon.length}`);
  console.log(`   ❌ NOT in database at all: ${excelNotInDb.length}\n`);

  console.log('══════════════════════════════════════════════════');
  console.log('🔍 DETAILED BREAKDOWN');
  console.log('══════════════════════════════════════════════════\n');

  if (excelNotInDb.length > 0) {
    console.log(`❌ Estimates NOT in database (${excelNotInDb.length}):`);
    console.log(`   These won estimates with contract_end are missing from the database.`);
    console.log(`   They may have been filtered out during import.`);
    excelNotInDb.slice(0, 10).forEach(e => {
      console.log(`   - ${e.estimateId} (${e.status}) - contract_end: ${e.contractEnd}`);
    });
    if (excelNotInDb.length > 10) {
      console.log(`   ... and ${excelNotInDb.length - 10} more`);
    }
    console.log('');
  }

  if (excelInDbButNotWon.length > 0) {
    console.log(`⚠️  Estimates in DB but NOT marked as won (${excelInDbButNotWon.length}):`);
    console.log(`   Excel says they're won, but database has different status.`);
    excelInDbButNotWon.slice(0, 10).forEach(e => {
      console.log(`   - ${e.estimateId}: Excel="${e.excelStatus}" vs DB="${e.dbStatus}"`);
    });
    if (excelInDbButNotWon.length > 10) {
      console.log(`   ... and ${excelInDbButNotWon.length - 10} more`);
    }
    console.log('');
  }

  if (excelInDbWonNeedsUpdate.length > 0) {
    console.log(`🔄 Estimates that need contract_end update (${excelInDbWonNeedsUpdate.length}):`);
    excelInDbWonNeedsUpdate.slice(0, 10).forEach(e => {
      console.log(`   - ${e.estimateId}: Excel="${e.excelContractEnd}" vs DB="${e.dbContractEnd || 'NULL'}"`);
    });
    if (excelInDbWonNeedsUpdate.length > 10) {
      console.log(`   ... and ${excelInDbWonNeedsUpdate.length - 10} more`);
    }
    console.log('');
  }

  console.log('══════════════════════════════════════════════════');
  console.log('💡 SUMMARY');
  console.log('══════════════════════════════════════════════════\n');
  console.log(`Total won estimates with contract_end in Excel: ${excelWonWithContractEnd.length}`);
  console.log(`Already correct in DB: ${excelInDbWonButAlreadyHasContractEnd.length}`);
  console.log(`Needs update: ${excelInDbWonNeedsUpdate.length}`);
  console.log(`Not in DB: ${excelNotInDb.length}`);
  console.log(`In DB but not won: ${excelInDbButNotWon.length}`);
  console.log(`\nTotal that should be updatable: ${excelInDbWonNeedsUpdate.length + excelInDbButNotWon.length}`);
  console.log(`(The ${excelInDbButNotWon.length} estimates need status update first, then contract_end)`);
}

investigateMismatch();

