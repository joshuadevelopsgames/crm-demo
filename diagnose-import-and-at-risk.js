#!/usr/bin/env node

/**
 * Comprehensive diagnostic script to:
 * 1. Parse all import files
 * 2. Find accounts that should be at-risk
 * 3. Compare parsed data structure with what's saved in Supabase
 * 4. List all fields that should be picked up
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
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

// Import parsers (we'll need to read the files and parse manually since we can't easily import the parsers)
function parseDate(value) {
  if (!value) return null;
  if (typeof value === 'number') {
    // Excel serial date
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + (value - 1) * 24 * 60 * 60 * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}T00:00:00Z`;
  }
  if (typeof value === 'string') {
    // Try parsing as date string
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getUTCFullYear();
      const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const day = String(parsed.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}T00:00:00Z`;
    }
  }
  return null;
}

function getDaysUntilRenewal(renewalDate) {
  if (!renewalDate) return null;
  const renewal = new Date(renewalDate);
  if (isNaN(renewal.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  renewal.setHours(0, 0, 0, 0);
  const diffTime = renewal - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

async function diagnose() {
  console.log('🔍 Comprehensive Import and At-Risk Account Diagnostic\n');
  console.log('='.repeat(80));
  
  const downloadsPath = join(process.env.HOME || process.env.USERPROFILE, 'Downloads');
  const files = {
    contactsExport: join(downloadsPath, 'Contacts Export.xlsx'),
    leadsList: join(downloadsPath, 'Leads.xlsx'),
    estimatesList: join(downloadsPath, 'Estimates List.xlsx'),
    jobsiteExport: join(downloadsPath, 'Jobsite Export (1).xlsx')
  };
  
  // Check files exist
  console.log('\n📁 Checking import files...');
  for (const [name, path] of Object.entries(files)) {
    if (existsSync(path)) {
      console.log(`  ✅ ${name}: ${path}`);
    } else {
      console.log(`  ❌ ${name}: NOT FOUND at ${path}`);
      return;
    }
  }
  
  // Read and parse files
  console.log('\n📖 Reading and parsing files...');
  
  // 1. Contacts Export
  console.log('\n1️⃣ Contacts Export:');
  const contactsWorkbook = XLSX.readFile(files.contactsExport);
  const contactsSheet = contactsWorkbook.Sheets[contactsWorkbook.SheetNames[0]];
  const contactsRows = XLSX.utils.sheet_to_json(contactsSheet, { header: 1, defval: null });
  const contactsHeaders = contactsRows[0];
  console.log(`   Headers (${contactsHeaders.length}):`, contactsHeaders.filter(h => h).slice(0, 10).join(', '), '...');
  console.log(`   Rows: ${contactsRows.length - 1}`);
  
  // Extract accounts from Contacts Export
  const accountsMap = new Map();
  const crmIdIndex = contactsHeaders.findIndex(h => h && h.toString().trim() === 'CRM ID');
  const crmNameIndex = contactsHeaders.findIndex(h => h && h.toString().trim() === 'CRM Name');
  const typeIndex = contactsHeaders.findIndex(h => h && h.toString().trim() === 'Type');
  const classificationIndex = contactsHeaders.findIndex(h => h && h.toString().trim() === 'Classification');
  const archivedIndex = contactsHeaders.findIndex(h => h && h.toString().trim() === 'Archived');
  const tagsIndex = contactsHeaders.findIndex(h => h && h.toString().trim() === 'Tags');
  
  for (let i = 1; i < contactsRows.length; i++) {
    const row = contactsRows[i];
    const crmId = row[crmIdIndex]?.toString().trim();
    const crmName = row[crmNameIndex]?.toString().trim();
    if (crmId && crmName && !accountsMap.has(crmId)) {
      accountsMap.set(crmId, {
        lmn_crm_id: crmId,
        name: crmName,
        account_type: row[typeIndex]?.toString().trim() || 'Lead',
        classification: row[classificationIndex]?.toString().trim() || 'Undefined',
        archived: row[archivedIndex]?.toString().trim().toLowerCase() === 'true',
        tags: row[tagsIndex]?.toString().trim() || ''
      });
    }
  }
  console.log(`   ✅ Extracted ${accountsMap.size} unique accounts`);
  
  // 2. Estimates List
  console.log('\n2️⃣ Estimates List:');
  const estimatesWorkbook = XLSX.readFile(files.estimatesList);
  const estimatesSheet = estimatesWorkbook.Sheets[estimatesWorkbook.SheetNames[0]];
  const estimatesRows = XLSX.utils.sheet_to_json(estimatesSheet, { header: 1, defval: null });
  const estimatesHeaders = estimatesRows[0];
  console.log(`   Headers (${estimatesHeaders.length}):`, estimatesHeaders.filter(h => h).slice(0, 10).join(', '), '...');
  console.log(`   Rows: ${estimatesRows.length - 1}`);
  
  // Extract estimates
  const estimateIdIndex = estimatesHeaders.findIndex(h => h && h.toString().trim() === 'Estimate ID');
  const estimateDateIndex = estimatesHeaders.findIndex(h => h && h.toString().trim() === 'Estimate Date');
  const contractStartIndex = estimatesHeaders.findIndex(h => h && h.toString().trim() === 'Contract Start');
  const contractEndIndex = estimatesHeaders.findIndex(h => h && h.toString().trim() === 'Contract End');
  const statusIndex = estimatesHeaders.findIndex(h => h && h.toString().trim() === 'Status');
  const contactIdIndex = estimatesHeaders.findIndex(h => h && h.toString().trim() === 'Contact ID');
  const totalPriceWithTaxIndex = estimatesHeaders.findIndex(h => h && h.toString().trim() === 'Total Price With Tax');
  
  const estimates = [];
  const wonEstimates = [];
  
  for (let i = 1; i < estimatesRows.length; i++) {
    const row = estimatesRows[i];
    const estimateId = row[estimateIdIndex]?.toString().trim();
    if (!estimateId) continue;
    
    const status = row[statusIndex]?.toString().trim() || '';
    const isWon = status.toLowerCase().includes('contract') || 
                 status.toLowerCase().includes('work complete') ||
                 status.toLowerCase().includes('billing complete');
    
    const estimate = {
      lmn_estimate_id: estimateId,
      estimate_date: parseDate(row[estimateDateIndex]),
      contract_start: parseDate(row[contractStartIndex]),
      contract_end: parseDate(row[contractEndIndex]),
      status: isWon ? 'won' : 'lost',
      lmn_contact_id: row[contactIdIndex]?.toString().trim() || null, // This is actually CRM ID
      total_price_with_tax: parseFloat(row[totalPriceWithTaxIndex]) || 0
    };
    
    estimates.push(estimate);
    if (isWon && estimate.contract_end) {
      wonEstimates.push(estimate);
    }
  }
  
  console.log(`   ✅ Extracted ${estimates.length} estimates`);
  console.log(`   ✅ Found ${wonEstimates.length} won estimates with contract_end dates`);
  
  // 3. Calculate at-risk accounts
  console.log('\n3️⃣ Calculating At-Risk Accounts:');
  console.log('   (Accounts with won estimates expiring within 180 days)');
  
  const accountRenewals = new Map(); // crmId -> earliest renewal date
  
  for (const estimate of wonEstimates) {
    if (!estimate.contract_end) continue;
    
    // Try to match estimate to account via lmn_contact_id (which is actually CRM ID)
    const crmId = estimate.lmn_contact_id ? estimate.lmn_contact_id.toLowerCase() : null;
    if (!crmId || !accountsMap.has(crmId)) continue;
    
    const renewalDate = estimate.contract_end;
    const daysUntil = getDaysUntilRenewal(renewalDate);
    
    if (daysUntil !== null && daysUntil <= 180 && daysUntil >= 0) {
      const account = accountsMap.get(crmId);
      if (!accountRenewals.has(crmId) || new Date(renewalDate) < new Date(accountRenewals.get(crmId).renewalDate)) {
        accountRenewals.set(crmId, {
          account: account,
          renewalDate: renewalDate,
          daysUntil: daysUntil,
          estimateId: estimate.lmn_estimate_id
        });
      }
    }
  }
  
  const atRiskAccounts = Array.from(accountRenewals.values())
    .sort((a, b) => a.daysUntil - b.daysUntil);
  
  console.log(`   ✅ Found ${atRiskAccounts.length} accounts that should be at-risk`);
  
  if (atRiskAccounts.length > 0) {
    console.log('\n   📋 At-Risk Accounts (first 10):');
    atRiskAccounts.slice(0, 10).forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.account.name} (${item.account.lmn_crm_id})`);
      console.log(`      Renewal: ${new Date(item.renewalDate).toLocaleDateString()} (${item.daysUntil} days)`);
      console.log(`      Estimate: ${item.estimateId}`);
    });
  }
  
  // 4. Compare with Supabase
  console.log('\n4️⃣ Comparing with Supabase Database:');
  
  // Fetch accounts from Supabase
  console.log('   Fetching accounts from Supabase...');
  let allAccounts = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('accounts')
      .select('id, lmn_crm_id, name, at_risk_status, status')
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.error('   ❌ Error fetching accounts:', error);
      break;
    }
    
    if (data && data.length > 0) {
      allAccounts = allAccounts.concat(data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`   ✅ Fetched ${allAccounts.length} accounts from Supabase`);
  
  // Check which at-risk accounts are marked as at-risk in database
  const atRiskInDb = allAccounts.filter(a => a.at_risk_status === true);
  console.log(`   📊 Accounts marked as at-risk in DB: ${atRiskInDb.length}`);
  
  // Match at-risk accounts from import with database
  console.log('\n   🔍 Matching At-Risk Accounts:');
  let matchedCount = 0;
  let notMatchedCount = 0;
  
  for (const item of atRiskAccounts) {
    const dbAccount = allAccounts.find(a => 
      a.lmn_crm_id && a.lmn_crm_id.toLowerCase() === item.account.lmn_crm_id.toLowerCase()
    );
    
    if (dbAccount) {
      if (dbAccount.at_risk_status === true) {
        matchedCount++;
      } else {
        notMatchedCount++;
        if (notMatchedCount <= 5) {
          console.log(`   ⚠️  ${item.account.name} (${item.account.lmn_crm_id}) should be at-risk but isn't in DB`);
          console.log(`      DB status: at_risk_status=${dbAccount.at_risk_status}, status=${dbAccount.status}`);
        }
      }
    } else {
      if (notMatchedCount <= 5) {
        console.log(`   ❌ ${item.account.name} (${item.account.lmn_crm_id}) not found in database`);
      }
      notMatchedCount++;
    }
  }
  
  console.log(`\n   ✅ Matched (correctly marked): ${matchedCount}`);
  console.log(`   ⚠️  Not matched (should be at-risk but aren't): ${notMatchedCount}`);
  
  // 5. Field comparison
  console.log('\n5️⃣ Field Comparison:');
  console.log('   Fields that should be picked up from import files:\n');
  
  console.log('   📋 Accounts (from Contacts Export):');
  console.log('      - lmn_crm_id (from "CRM ID")');
  console.log('      - name (from "CRM Name")');
  console.log('      - account_type (from "Type")');
  console.log('      - classification (from "Classification")');
  console.log('      - status (from "Archived" - archived if true, active if false)');
  console.log('      - tags (from "Tags")');
  
  console.log('\n   📋 Estimates (from Estimates List):');
  console.log('      - lmn_estimate_id (from "Estimate ID")');
  console.log('      - estimate_date (from "Estimate Date")');
  console.log('      - contract_start (from "Contract Start")');
  console.log('      - contract_end (from "Contract End") ⚠️ CRITICAL for at-risk calculation');
  console.log('      - status (from "Status" - won/lost)');
  console.log('      - lmn_contact_id (from "Contact ID" - actually CRM ID)');
  console.log('      - total_price_with_tax (from "Total Price With Tax")');
  
  // Check estimates in database
  console.log('\n   🔍 Checking Estimates in Database:');
  let allEstimates = [];
  page = 0;
  hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('estimates')
      .select('id, lmn_estimate_id, estimate_date, contract_start, contract_end, status')
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.error('   ❌ Error fetching estimates:', error);
      break;
    }
    
    if (data && data.length > 0) {
      allEstimates = allEstimates.concat(data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`   ✅ Fetched ${allEstimates.length} estimates from Supabase`);
  
  const wonEstimatesInDb = allEstimates.filter(e => e.status && e.status.toLowerCase() === 'won');
  const wonWithContractEnd = wonEstimatesInDb.filter(e => e.contract_end);
  const wonWithoutContractEnd = wonEstimatesInDb.filter(e => !e.contract_end);
  
  console.log(`   📊 Won estimates in DB: ${wonEstimatesInDb.length}`);
  console.log(`   ✅ Won estimates with contract_end: ${wonWithContractEnd.length}`);
  console.log(`   ⚠️  Won estimates WITHOUT contract_end: ${wonWithoutContractEnd.length}`);
  
  if (wonWithoutContractEnd.length > 0) {
    console.log('\n   ⚠️  Sample won estimates missing contract_end (first 5):');
    wonWithoutContractEnd.slice(0, 5).forEach(est => {
      console.log(`      - ${est.lmn_estimate_id || est.id}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ Diagnostic complete!');
}

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
  });

