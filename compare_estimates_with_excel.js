/**
 * Compare Estimates from Database with Estimates List.xlsx
 * 
 * This script:
 * 1. Reads Estimates List.xlsx from Downloads folder
 * 2. Fetches estimates from Supabase database
 * 3. Compares the two datasets
 * 4. Reports discrepancies (missing estimates, different values, etc.)
 * 
 * Usage:
 *   node compare_estimates_with_excel.js
 * 
 * Requires environment variables:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key
 */

import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables!');
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nYou can set them like this:');
  console.error('  export SUPABASE_URL="https://your-project.supabase.co"');
  console.error('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"');
  console.error('\nOr create a .env file with these variables.');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Path to Estimates List.xlsx in Downloads
const downloadsPath = join(homedir(), 'Downloads', 'Estimates List.xlsx');

console.log('📊 Comparing Estimates from Database with Excel File\n');
console.log(`📁 Excel file: ${downloadsPath}\n`);

/**
 * Parse date from Excel (handles various formats)
 */
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d);
    }
  }
  return null;
}

/**
 * Normalize estimate ID for comparison
 */
function normalizeEstimateId(id) {
  if (!id) return null;
  return id.toString().trim().toUpperCase();
}

/**
 * Read and parse Excel file
 */
function readExcelFile() {
  try {
    console.log('📖 Reading Excel file...');
    const workbook = XLSX.readFile(downloadsPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
    
    if (rows.length < 2) {
      throw new Error('Excel file appears to be empty or has no data rows');
    }
    
    const headers = rows[0];
    const colMap = {
      estimateType: headers.findIndex(h => h === 'Estimate Type'),
      estimateId: headers.findIndex(h => h === 'Estimate ID'),
      estimateDate: headers.findIndex(h => h === 'Estimate Date'),
      contractStart: headers.findIndex(h => h === 'Contract Start'),
      contractEnd: headers.findIndex(h => h === 'Contract End'),
      status: headers.findIndex(h => h === 'Status'),
      totalPrice: headers.findIndex(h => h === 'Total Price'),
      totalPriceWithTax: headers.findIndex(h => h === 'Total Price With Tax'),
      contactId: headers.findIndex(h => h === 'Contact ID'),
      contactName: headers.findIndex(h => h === 'Contact Name'),
      division: headers.findIndex(h => h === 'Division'),
    };
    
    const estimates = new Map();
    let rowNum = 1;
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const estimateId = row[colMap.estimateId]?.toString().trim();
      if (!estimateId) continue;
      
      const normalizedId = normalizeEstimateId(estimateId);
      if (estimates.has(normalizedId)) {
        console.warn(`⚠️  Duplicate Estimate ID in Excel row ${i + 1}: ${estimateId}`);
        continue;
      }
      
      estimates.set(normalizedId, {
        estimateId: estimateId,
        normalizedId: normalizedId,
        estimateType: row[colMap.estimateType]?.toString().trim() || null,
        estimateDate: parseDate(row[colMap.estimateDate]),
        contractStart: parseDate(row[colMap.contractStart]),
        contractEnd: parseDate(row[colMap.contractEnd]),
        status: row[colMap.status]?.toString().trim() || null,
        totalPrice: row[colMap.totalPrice] ? parseFloat(row[colMap.totalPrice]) : null,
        totalPriceWithTax: row[colMap.totalPriceWithTax] ? parseFloat(row[colMap.totalPriceWithTax]) : null,
        contactId: row[colMap.contactId]?.toString().trim() || null,
        contactName: row[colMap.contactName]?.toString().trim() || null,
        division: row[colMap.division]?.toString().trim() || null,
        rowNumber: i + 1,
      });
    }
    
    console.log(`✅ Parsed ${estimates.size} estimates from Excel\n`);
    return estimates;
  } catch (error) {
    console.error('❌ Error reading Excel file:', error.message);
    if (error.code === 'ENOENT') {
      console.error(`   File not found: ${downloadsPath}`);
      console.error('   Please make sure "Estimates List.xlsx" is in your Downloads folder.');
    }
    process.exit(1);
  }
}

/**
 * Fetch estimates from Supabase
 */
async function fetchDatabaseEstimates() {
  try {
    console.log('🔍 Fetching estimates from database...');
    
    const { data, error } = await supabase
      .from('estimates')
      .select('*')
      .order('lmn_estimate_id', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    const estimates = new Map();
    
    data.forEach(est => {
      const estimateId = est.lmn_estimate_id || est.estimate_number;
      if (!estimateId) return;
      
      const normalizedId = normalizeEstimateId(estimateId);
      if (estimates.has(normalizedId)) {
        console.warn(`⚠️  Duplicate Estimate ID in database: ${estimateId} (IDs: ${est.id})`);
        return;
      }
      
      estimates.set(normalizedId, {
        estimateId: estimateId,
        normalizedId: normalizedId,
        id: est.id,
        estimateType: est.estimate_type || null,
        estimateDate: est.estimate_date ? new Date(est.estimate_date) : null,
        contractStart: est.contract_start ? new Date(est.contract_start) : null,
        contractEnd: est.contract_end ? new Date(est.contract_end) : null,
        status: est.status || null,
        totalPrice: est.total_price ? parseFloat(est.total_price) : null,
        totalPriceWithTax: est.total_price_with_tax ? parseFloat(est.total_price_with_tax) : null,
        contactId: est.lmn_contact_id || null,
        contactName: est.contact_name || null,
        division: est.division || null,
        accountId: est.account_id || null,
      });
    });
    
    console.log(`✅ Fetched ${estimates.size} estimates from database\n`);
    return estimates;
  } catch (error) {
    console.error('❌ Error fetching from database:', error.message);
    process.exit(1);
  }
}

/**
 * Compare two dates (ignoring time)
 */
function datesEqual(date1, date2) {
  if (!date1 && !date2) return true;
  if (!date1 || !date2) return false;
  return date1.toISOString().split('T')[0] === date2.toISOString().split('T')[0];
}

/**
 * Compare two numbers (with tolerance for floating point)
 */
function numbersEqual(num1, num2, tolerance = 0.01) {
  if (num1 === null && num2 === null) return true;
  if (num1 === null || num2 === null) return false;
  return Math.abs(num1 - num2) < tolerance;
}

/**
 * Main comparison function
 */
async function compareEstimates() {
  const excelEstimates = readExcelFile();
  const dbEstimates = await fetchDatabaseEstimates();
  
  const results = {
    totalInExcel: excelEstimates.size,
    totalInDatabase: dbEstimates.size,
    missingInDatabase: [],
    missingInExcel: [],
    differences: [],
    matches: 0,
  };
  
  // Find estimates in Excel but not in database
  for (const [normalizedId, excelEst] of excelEstimates.entries()) {
    if (!dbEstimates.has(normalizedId)) {
      results.missingInDatabase.push(excelEst);
    }
  }
  
  // Find estimates in database but not in Excel
  for (const [normalizedId, dbEst] of dbEstimates.entries()) {
    if (!excelEstimates.has(normalizedId)) {
      results.missingInExcel.push(dbEst);
    }
  }
  
  // Compare matching estimates
  for (const [normalizedId, excelEst] of excelEstimates.entries()) {
    const dbEst = dbEstimates.get(normalizedId);
    if (!dbEst) continue;
    
    const differences = [];
    
    // Compare key fields
    if (excelEst.estimateType !== dbEst.estimateType) {
      differences.push({
        field: 'Estimate Type',
        excel: excelEst.estimateType,
        database: dbEst.estimateType,
      });
    }
    
    if (!datesEqual(excelEst.estimateDate, dbEst.estimateDate)) {
      differences.push({
        field: 'Estimate Date',
        excel: excelEst.estimateDate?.toISOString().split('T')[0] || null,
        database: dbEst.estimateDate?.toISOString().split('T')[0] || null,
      });
    }
    
    if (!datesEqual(excelEst.contractStart, dbEst.contractStart)) {
      differences.push({
        field: 'Contract Start',
        excel: excelEst.contractStart?.toISOString().split('T')[0] || null,
        database: dbEst.contractStart?.toISOString().split('T')[0] || null,
      });
    }
    
    if (!datesEqual(excelEst.contractEnd, dbEst.contractEnd)) {
      differences.push({
        field: 'Contract End',
        excel: excelEst.contractEnd?.toISOString().split('T')[0] || null,
        database: dbEst.contractEnd?.toISOString().split('T')[0] || null,
      });
    }
    
    if (excelEst.status !== dbEst.status) {
      differences.push({
        field: 'Status',
        excel: excelEst.status,
        database: dbEst.status,
      });
    }
    
    if (!numbersEqual(excelEst.totalPrice, dbEst.totalPrice)) {
      differences.push({
        field: 'Total Price',
        excel: excelEst.totalPrice,
        database: dbEst.totalPrice,
      });
    }
    
    if (!numbersEqual(excelEst.totalPriceWithTax, dbEst.totalPriceWithTax)) {
      differences.push({
        field: 'Total Price With Tax',
        excel: excelEst.totalPriceWithTax,
        database: dbEst.totalPriceWithTax,
      });
    }
    
    if (excelEst.contactId !== dbEst.contactId) {
      differences.push({
        field: 'Contact ID',
        excel: excelEst.contactId,
        database: dbEst.contactId,
      });
    }
    
    if (excelEst.division !== dbEst.division) {
      differences.push({
        field: 'Division',
        excel: excelEst.division,
        database: dbEst.division,
      });
    }
    
    if (differences.length > 0) {
      results.differences.push({
        estimateId: excelEst.estimateId,
        normalizedId: normalizedId,
        databaseId: dbEst.id,
        differences: differences,
      });
    } else {
      results.matches++;
    }
  }
  
  return results;
}

/**
 * Print comparison results
 */
function printResults(results) {
  console.log('='.repeat(80));
  console.log('📊 COMPARISON RESULTS');
  console.log('='.repeat(80));
  console.log();
  
  console.log(`📈 Summary:`);
  console.log(`   Excel file:     ${results.totalInExcel} estimates`);
  console.log(`   Database:       ${results.totalInDatabase} estimates`);
  console.log(`   Perfect matches: ${results.matches} estimates`);
  console.log(`   Missing in DB:  ${results.missingInDatabase.length} estimates`);
  console.log(`   Missing in Excel: ${results.missingInExcel.length} estimates`);
  console.log(`   With differences: ${results.differences.length} estimates`);
  console.log();
  
  if (results.missingInDatabase.length > 0) {
    console.log('❌ ESTIMATES IN EXCEL BUT NOT IN DATABASE:');
    console.log('-'.repeat(80));
    results.missingInDatabase.slice(0, 20).forEach(est => {
      console.log(`   ${est.estimateId} (Row ${est.rowNumber})`);
      console.log(`      Type: ${est.estimateType || 'N/A'}, Status: ${est.status || 'N/A'}, Total: $${est.totalPrice || est.totalPriceWithTax || 'N/A'}`);
    });
    if (results.missingInDatabase.length > 20) {
      console.log(`   ... and ${results.missingInDatabase.length - 20} more`);
    }
    console.log();
  }
  
  if (results.missingInExcel.length > 0) {
    console.log('⚠️  ESTIMATES IN DATABASE BUT NOT IN EXCEL:');
    console.log('-'.repeat(80));
    results.missingInExcel.slice(0, 20).forEach(est => {
      console.log(`   ${est.estimateId} (DB ID: ${est.id})`);
      console.log(`      Type: ${est.estimateType || 'N/A'}, Status: ${est.status || 'N/A'}, Total: $${est.totalPrice || est.totalPriceWithTax || 'N/A'}`);
    });
    if (results.missingInExcel.length > 20) {
      console.log(`   ... and ${results.missingInExcel.length - 20} more`);
    }
    console.log();
  }
  
  if (results.differences.length > 0) {
    console.log('🔍 ESTIMATES WITH DIFFERENCES:');
    console.log('-'.repeat(80));
    results.differences.slice(0, 10).forEach(item => {
      console.log(`   ${item.estimateId} (DB ID: ${item.databaseId}):`);
      item.differences.forEach(diff => {
        console.log(`      ${diff.field}:`);
        console.log(`         Excel:    ${diff.excel}`);
        console.log(`         Database: ${diff.database}`);
      });
      console.log();
    });
    if (results.differences.length > 10) {
      console.log(`   ... and ${results.differences.length - 10} more with differences`);
    }
    console.log();
  }
  
  if (results.missingInDatabase.length === 0 && 
      results.missingInExcel.length === 0 && 
      results.differences.length === 0) {
    console.log('✅ PERFECT MATCH! All estimates match between Excel and database.');
    console.log();
  }
  
  console.log('='.repeat(80));
}

// Run the comparison
(async () => {
  try {
    const results = await compareEstimates();
    printResults(results);
  } catch (error) {
    console.error('❌ Error during comparison:', error);
    process.exit(1);
  }
})();

