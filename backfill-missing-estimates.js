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

async function backfillMissingEstimates() {
  console.log('🔧 Backfilling missing estimates with contract_end dates...\n');

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
  const colMap = {
    estimateType: headers.findIndex(h => h === 'Estimate Type'),
    estimateId: headers.findIndex(h => h === 'Estimate ID'),
    estimateDate: headers.findIndex(h => h === 'Estimate Date'),
    estimateCloseDate: headers.findIndex(h => h === 'Estimate Close Date'),
    contractStart: headers.findIndex(h => h === 'Contract Start'),
    contractEnd: headers.findIndex(h => h === 'Contract End'),
    projectName: headers.findIndex(h => h === 'Project Name'),
    version: headers.findIndex(h => h === 'Version'),
    contactName: headers.findIndex(h => h === 'Contact Name'),
    contactId: headers.findIndex(h => h === 'Contact ID'),
    status: headers.findIndex(h => h === 'Status'),
    totalPrice: headers.findIndex(h => h === 'Total Price'),
    totalPriceWithTax: headers.findIndex(h => h === 'Total Price With Tax'),
  };

  // Get all estimates from database
  const { data: dbEstimates } = await supabase
    .from('estimates')
    .select('id, lmn_estimate_id, status');

  const dbMap = new Map();
  dbEstimates?.forEach(e => {
    if (e.lmn_estimate_id) {
      dbMap.set(e.lmn_estimate_id, e);
    }
  });

  // Find missing estimates that are won with contract_end
  const missingEstimates = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const estimateId = row[colMap.estimateId]?.toString().trim();
    if (!estimateId) continue;

    const status = row[colMap.status];
    if (!isWonStatus(status)) continue;

    const contractEndRaw = row[colMap.contractEnd];
    const contractEndParsed = parseDate(contractEndRaw);
    if (!contractEndParsed) continue;

    // Check if it's missing from database
    if (!dbMap.has(estimateId)) {
      missingEstimates.push({
        estimateId,
        row,
        contractEnd: contractEndParsed
      });
    }
  }

  console.log(`📊 Found ${missingEstimates.length} missing won estimates with contract_end\n`);

  if (missingEstimates.length === 0) {
    console.log('✅ No missing estimates to backfill!');
    return;
  }

  // Parse and insert them
  let inserted = 0;
  let errors = 0;

  for (const { estimateId, row, contractEnd } of missingEstimates) {
    try {
      // Parse the estimate (simplified version of parser logic)
      const estimateData = {
        id: `lmn-estimate-${estimateId}`,
        lmn_estimate_id: estimateId,
        estimate_number: estimateId,
        estimate_type: row[colMap.estimateType]?.toString().trim() || '',
        estimate_date: parseDate(row[colMap.estimateDate]) ? `${parseDate(row[colMap.estimateDate])}T00:00:00Z` : null,
        estimate_close_date: parseDate(row[colMap.estimateCloseDate]) ? `${parseDate(row[colMap.estimateCloseDate])}T00:00:00Z` : null,
        contract_start: parseDate(row[colMap.contractStart]) ? `${parseDate(row[colMap.contractStart])}T00:00:00Z` : null,
        contract_end: `${contractEnd}T00:00:00Z`,
        project_name: row[colMap.projectName]?.toString().trim() || '',
        version: row[colMap.version]?.toString().trim() || '',
        contact_name: row[colMap.contactName]?.toString().trim() || '',
        status: 'won',
        total_price: row[colMap.totalPrice] ? parseFloat(row[colMap.totalPrice]) : null,
        total_price_with_tax: row[colMap.totalPriceWithTax] ? parseFloat(row[colMap.totalPriceWithTax]) : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('estimates')
        .insert(estimateData);

      if (insertError) {
        // If it's a duplicate, try to update instead
        if (insertError.code === '23505') {
          const { error: updateError } = await supabase
            .from('estimates')
            .update({ 
              contract_end: `${contractEnd}T00:00:00Z`,
              status: 'won',
              updated_at: new Date().toISOString()
            })
            .eq('lmn_estimate_id', estimateId);

          if (updateError) {
            console.error(`❌ Error updating ${estimateId}:`, updateError.message);
            errors++;
          } else {
            inserted++;
            if (inserted % 50 === 0) {
              console.log(`   Inserted/Updated ${inserted} estimates...`);
            }
          }
        } else {
          console.error(`❌ Error inserting ${estimateId}:`, insertError.message);
          errors++;
        }
      } else {
        inserted++;
        if (inserted % 50 === 0) {
          console.log(`   Inserted/Updated ${inserted} estimates...`);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${estimateId}:`, error.message);
      errors++;
    }
  }

  console.log('\n══════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('══════════════════════════════════════════════════');
  console.log(`✅ Inserted/Updated: ${inserted} estimates`);
  console.log(`❌ Errors: ${errors} estimates`);
  console.log('\n✨ Done! Now run createRenewalNotifications() to mark accounts as at-risk.');
}

backfillMissingEstimates();

