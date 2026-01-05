#!/usr/bin/env node

/**
 * Analyze the last 2 estimates to find a pattern
 */

import XLSX from 'xlsx';
import { join } from 'path';
import { existsSync } from 'fs';

function getYear(d) {
  if (!d) return null;
  if (typeof d === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + (d - 1) * 24 * 60 * 60 * 1000);
    return date.getUTCFullYear();
  }
  const s = String(d);
  return s.length >= 4 ? parseInt(s.substring(0, 4)) : null;
}

async function analyzeLast2() {
  console.log('🔍 Final Analysis: The Last 2 Estimates\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const excelPath = join(process.env.HOME || '/Users/joshua', 'Downloads', 'Estimates List.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    // Base filter
    const base = data.filter(r => {
      const y = getYear(r['Estimate Close Date']);
      if (y !== 2025) return false;
      const exclude = r['Exclude Stats'];
      if (exclude === true || exclude === 'True' || exclude === 'true' || exclude === 1) return false;
      const archived = r['Archived'];
      if (archived === true || archived === 'True' || archived === 'true' || archived === 1) return false;
      const p = parseFloat(r['Total Price'] || r['Total Price With Tax'] || 0);
      if (p <= 0) return false;
      const status = (r['Status'] || '').toString().toLowerCase().trim();
      if (status.includes('lost')) return false;
      return true;
    });

    // Remove duplicates
    const unique = [];
    const seen = new Set();
    base.forEach(r => {
      const id = r['Estimate ID'];
      if (id) {
        if (!seen.has(id)) {
          seen.add(id);
          unique.push(r);
        }
      } else {
        unique.push(r);
      }
    });

    // Get included estimates (after our exclusions)
    const included = unique.filter(r => {
      const status = (r['Status'] || '').toString().toLowerCase().trim();
      const isHold = status === 'estimate on hold';
      const isProposal = status === 'client proposal phase';
      const isWIP = status === 'work in progress';
      const isEIP = status === 'estimate in progress';
      const version = r['Version'];
      const isNotRevision = !version || String(version).trim() === '1' || String(version).trim() === '1.0' || String(version).trim() === '';
      return !isHold && !isProposal && !isWIP && !(isEIP && isNotRevision);
    });

    // Get EIP revisions
    const eipRevisions = included.filter(r => {
      const status = (r['Status'] || '').toString().toLowerCase().trim();
      const isEIP = status === 'estimate in progress';
      const version = r['Version'];
      const isRevision = version && String(version).trim() !== '1' && String(version).trim() !== '1.0' && String(version).trim() !== '';
      return isEIP && isRevision;
    });

    console.log('Total included: ' + included.length);
    console.log('LMN shows: 1086');
    console.log('Difference: ' + (included.length - 1086) + ' (we have 2 extra)\n');

    // Find low-price EIP revisions
    const lowPriceEIP = eipRevisions.filter(r => {
      const price = parseFloat(r['Total Price'] || r['Total Price With Tax'] || 0);
      return price > 0 && price < 1000;
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 The 4 Low-Price EIP Revisions:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    lowPriceEIP.forEach(r => {
      const price = parseFloat(r['Total Price'] || r['Total Price With Tax'] || 0);
      const version = String(r['Version'] || 'none').trim();
      const closeDate = r['Estimate Close Date'];
      const estimateDate = r['Estimate Date'];
      const pipeline = r['Sales Pipeline Status'] || 'unknown';
      const account = r['Account'] || r['Account ID'] || 'no_account';
      
      console.log(r['Estimate ID'] + ':');
      console.log('  Price: $' + price.toFixed(2));
      console.log('  Version: \"' + version + '\"');
      console.log('  Pipeline: ' + pipeline);
      console.log('  Account: ' + account);
      console.log('  Close Date: ' + closeDate);
      console.log('  Estimate Date: ' + estimateDate);
      console.log('');
    });

    // Test: Exclude the 2 lowest price EIP revisions
    const sortedByPrice = lowPriceEIP.sort((a, b) => {
      const priceA = parseFloat(a['Total Price'] || a['Total Price With Tax'] || 0);
      const priceB = parseFloat(b['Total Price'] || b['Total Price With Tax'] || 0);
      return priceA - priceB;
    });

    const twoLowest = sortedByPrice.slice(0, 2);
    const twoLowestIds = new Set(twoLowest.map(r => r['Estimate ID']));

    const excludeTwoLowest = included.filter(r => !twoLowestIds.has(r['Estimate ID']));

    console.log('Test: Exclude 2 lowest-price EIP revisions');
    console.log('Result: ' + excludeTwoLowest.length + ' (LMN: 1086, diff: ' + (excludeTwoLowest.length - 1086) + ')\n');

    if (excludeTwoLowest.length === 1086) {
      console.log('✅ EXACT MATCH! The 2 are the lowest-price EIP revisions!\n');
      console.log('The 2 excluded estimates:');
      twoLowest.forEach(r => {
        const price = parseFloat(r['Total Price'] || r['Total Price With Tax'] || 0);
        console.log('  ' + r['Estimate ID'] + ': $' + price.toFixed(2) + ' - Version: \"' + (r['Version'] || 'none') + '\"');
      });
    }

    // Check for other patterns
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 Other Pattern Tests:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Check if they're the earliest or latest
    const sortedByDate = eipRevisions.sort((a, b) => {
      const dateA = new Date(a['Estimate Close Date'] || 0);
      const dateB = new Date(b['Estimate Close Date'] || 0);
      return dateA - dateB;
    });

    const twoEarliest = sortedByDate.slice(0, 2);
    const twoEarliestIds = new Set(twoEarliest.map(r => r['Estimate ID']));
    const excludeTwoEarliest = included.filter(r => !twoEarliestIds.has(r['Estimate ID']));
    console.log('Exclude 2 earliest EIP revisions: ' + excludeTwoEarliest.length + ' (diff: ' + (excludeTwoEarliest.length - 1086) + ')');

    const twoLatest = sortedByDate.slice(-2);
    const twoLatestIds = new Set(twoLatest.map(r => r['Estimate ID']));
    const excludeTwoLatest = included.filter(r => !twoLatestIds.has(r['Estimate ID']));
    console.log('Exclude 2 latest EIP revisions: ' + excludeTwoLatest.length + ' (diff: ' + (excludeTwoLatest.length - 1086) + ')\n');

    // Check version patterns
    const version2025 = eipRevisions.filter(r => String(r['Version'] || '').trim() === '2025');
    console.log('EIP revisions with Version \"2025\": ' + version2025.length);
    if (version2025.length === 2) {
      console.log('✅ Could be the 2!\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

analyzeLast2();




