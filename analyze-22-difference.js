#!/usr/bin/env node

/**
 * Analyze the 22 estimates that differ between our count (1,108) and LMN's (1,086)
 * Find patterns or commonalities that explain why LMN excludes them
 */

import XLSX from 'xlsx';
import { join } from 'path';
import { existsSync } from 'fs';

function getYearFromDate(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + (d - 1) * 24 * 60 * 60 * 1000);
    return date.getUTCFullYear();
  }
  if (dateValue instanceof Date) {
    return dateValue.getFullYear();
  }
  const dateStr = String(dateValue);
  if (dateStr.length >= 4) {
    return parseInt(dateStr.substring(0, 4));
  }
  return null;
}

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

async function analyze22Difference() {
  console.log('🔍 Analyzing the 22 Estimate Difference\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    const excelPath = join(process.env.HOME || '/Users/joshua', 'Downloads', 'Estimates List.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

    console.log(`✅ Loaded ${data.length} rows from LMN export\n`);

    // Base filter: close_date in 2025, exclude_stats=false, archived=false, price>0, not Lost
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

    console.log(`Base filtered (exclude Lost): ${unique.length} (LMN: 1086, diff: ${unique.length - 1086})\n`);

    // Now let's try to identify which 22 might be excluded by LMN
    // We'll test various exclusion criteria and see which ones get us to 1086

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧪 Testing Exclusion Criteria:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Test 1: Exclude "Estimate In Progress"
    const excludeEIP = unique.filter(r => {
      const status = (r['Status'] || '').toString().toLowerCase().trim();
      return status !== 'estimate in progress';
    });
    console.log(`1. Exclude "Estimate In Progress": ${excludeEIP.length} (diff: ${excludeEIP.length - 1086})`);
    if (excludeEIP.length === 1086) {
      console.log('   ✅ EXACT MATCH! LMN excludes "Estimate In Progress"\n');
    } else {
      const eipCount = unique.length - excludeEIP.length;
      console.log(`   (${eipCount} Estimate In Progress estimates)\n`);
    }

    // Test 2: Exclude "Client Proposal Phase"
    const excludeProposal = unique.filter(r => {
      const status = (r['Status'] || '').toString().toLowerCase().trim();
      return status !== 'client proposal phase';
    });
    console.log(`2. Exclude "Client Proposal Phase": ${excludeProposal.length} (diff: ${excludeProposal.length - 1086})`);
    const proposalCount = unique.length - excludeProposal.length;
    console.log(`   (${proposalCount} Client Proposal Phase estimates)\n`);

    // Test 3: Exclude "Estimate On Hold"
    const excludeHold = unique.filter(r => {
      const status = (r['Status'] || '').toString().toLowerCase().trim();
      return status !== 'estimate on hold';
    });
    console.log(`3. Exclude "Estimate On Hold": ${excludeHold.length} (diff: ${excludeHold.length - 1086})`);
    const holdCount = unique.length - excludeHold.length;
    console.log(`   (${holdCount} Estimate On Hold estimates)\n`);

    // Test 4: Exclude "Work In Progress"
    const excludeWIP = unique.filter(r => {
      const status = (r['Status'] || '').toString().toLowerCase().trim();
      return status !== 'work in progress';
    });
    console.log(`4. Exclude "Work In Progress": ${excludeWIP.length} (diff: ${excludeWIP.length - 1086})`);
    const wipCount = unique.length - excludeWIP.length;
    console.log(`   (${wipCount} Work In Progress estimates)\n`);

    // Test 5: Exclude EIP + Proposal + Hold
    const excludeAllInProgress = unique.filter(r => {
      const status = (r['Status'] || '').toString().toLowerCase().trim();
      return status !== 'estimate in progress' && 
             status !== 'client proposal phase' && 
             status !== 'estimate on hold';
    });
    console.log(`5. Exclude EIP + Proposal + Hold: ${excludeAllInProgress.length} (diff: ${excludeAllInProgress.length - 1086})`);
    const allInProgressCount = unique.length - excludeAllInProgress.length;
    console.log(`   (${allInProgressCount} total in-progress estimates)\n`);

    // Test 6: Check for revisions
    const revisions = unique.filter(r => {
      const version = r['Version'];
      if (!version) return false;
      const versionStr = String(version).trim();
      return versionStr !== '1' && versionStr !== '1.0' && versionStr !== '';
    });
    console.log(`6. Revisions (version != 1): ${revisions.length}`);
    console.log(`   If we exclude all revisions: ${unique.length - revisions.length} (diff: ${unique.length - revisions.length - 1086})\n`);

    // Test 7: Check Pipeline Status
    console.log('7. Pipeline Status breakdown:');
    const pipelineBreakdown = {};
    unique.forEach(r => {
      const pipeline = (r['Sales Pipeline Status'] || 'unknown').toString().trim();
      pipelineBreakdown[pipeline] = (pipelineBreakdown[pipeline] || 0) + 1;
    });
    Object.entries(pipelineBreakdown).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
      console.log(`   ${p}: ${c}`);
    });
    console.log('');

    // Test 8: Check Status breakdown
    console.log('8. Status breakdown:');
    const statusBreakdown = {};
    unique.forEach(r => {
      const s = (r['Status'] || 'unknown').toString().trim();
      statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
    });
    Object.entries(statusBreakdown).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
      console.log(`   ${s}: ${c}`);
    });
    console.log('');

    // Test 9: Check for very low prices (near-zero)
    const lowPrices = unique.filter(r => {
      const price = parseFloat(r['Total Price'] || r['Total Price With Tax'] || 0);
      return price > 0 && price < 100; // Less than $100
    });
    console.log(`9. Very low prices (< $100): ${lowPrices.length}`);
    if (lowPrices.length > 0) {
      console.log('   Sample low prices:');
      lowPrices.slice(0, 5).forEach(r => {
        const price = parseFloat(r['Total Price'] || r['Total Price With Tax'] || 0);
        console.log(`     $${price.toFixed(2)} - ${r['Status']} - ${r['Estimate ID']}`);
      });
    }
    console.log('');

    // Test 10: Check for estimates with no account or contact
    const noAccount = unique.filter(r => {
      return !r['Account'] || !r['Account ID'] || r['Account'] === '' || r['Account ID'] === '';
    });
    console.log(`10. No account/contact: ${noAccount.length}`);
    console.log('');

    // Test 11: Check for duplicate estimate numbers (revisions)
    const estimateNumbers = {};
    unique.forEach(r => {
      const estNum = r['Estimate Number'] || r['Estimate ID'];
      if (estNum) {
        if (!estimateNumbers[estNum]) {
          estimateNumbers[estNum] = [];
        }
        estimateNumbers[estNum].push(r);
      }
    });

    const duplicateEstNums = Object.entries(estimateNumbers).filter(([num, ests]) => ests.length > 1);
    console.log(`11. Duplicate estimate numbers (potential revisions): ${duplicateEstNums.length}`);
    if (duplicateEstNums.length > 0) {
      console.log('   Sample duplicates:');
      duplicateEstNums.slice(0, 5).forEach(([num, ests]) => {
        console.log(`     ${num}: ${ests.length} versions`);
        ests.forEach(e => {
          console.log(`       - ${e['Estimate ID']} (${e['Status']}, v${e['Version'] || '1'})`);
        });
      });
    }
    console.log('');

    // Test 12: Try to find the exact 22 by process of elimination
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🎯 Finding the Exact 22:\n');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // What if we exclude EIP + Proposal + Hold + WIP?
    const excludeAllProgress = unique.filter(r => {
      const status = (r['Status'] || '').toString().toLowerCase().trim();
      return status !== 'estimate in progress' && 
             status !== 'client proposal phase' && 
             status !== 'estimate on hold' &&
             status !== 'work in progress';
    });
    console.log(`Exclude all "in progress" statuses: ${excludeAllProgress.length} (diff: ${excludeAllProgress.length - 1086})`);
    const allProgressCount = unique.length - excludeAllProgress.length;
    console.log(`   (${allProgressCount} total in-progress estimates)\n`);

    // What if we exclude revisions with version > 1?
    const excludeRevisions = unique.filter(r => {
      const version = r['Version'];
      if (!version) return true; // Include if no version
      const versionStr = String(version).trim();
      return versionStr === '1' || versionStr === '1.0' || versionStr === '';
    });
    console.log(`Exclude revisions (version != 1): ${excludeRevisions.length} (diff: ${excludeRevisions.length - 1086})`);
    const revisionCount = unique.length - excludeRevisions.length;
    console.log(`   (${revisionCount} revisions)\n`);

    // What if we exclude both?
    const excludeBoth = unique.filter(r => {
      const status = (r['Status'] || '').toString().toLowerCase().trim();
      const isInProgress = status === 'estimate in progress' || 
                           status === 'client proposal phase' || 
                           status === 'estimate on hold' ||
                           status === 'work in progress';
      const version = r['Version'];
      const isRevision = version && String(version).trim() !== '1' && String(version).trim() !== '1.0' && String(version).trim() !== '';
      return !isInProgress && !isRevision;
    });
    console.log(`Exclude in-progress AND revisions: ${excludeBoth.length} (diff: ${excludeBoth.length - 1086})`);
    const bothCount = unique.length - excludeBoth.length;
    console.log(`   (${bothCount} total excluded)\n`);

    // Final analysis: What are the 22?
    // If we assume LMN excludes EIP, let's see what those 81 estimates look like
    const eipEstimates = unique.filter(r => {
      const status = (r['Status'] || '').toString().toLowerCase().trim();
      return status === 'estimate in progress';
    });

    if (eipEstimates.length > 0) {
      console.log('═══════════════════════════════════════════════════════════════');
      console.log('📊 "Estimate In Progress" Estimates Analysis:\n');
      console.log('═══════════════════════════════════════════════════════════════\n');
      console.log(`Total EIP: ${eipEstimates.length}`);
      console.log(`If LMN excludes all EIP: ${unique.length - eipEstimates.length} (diff: ${unique.length - eipEstimates.length - 1086})`);
      console.log(`If LMN excludes ${eipEstimates.length - 22} EIP: ${unique.length - (eipEstimates.length - 22)} (exact match?)\n`);

      // Analyze EIP estimates
      console.log('EIP Pipeline Status breakdown:');
      const eipPipeline = {};
      eipEstimates.forEach(r => {
        const pipeline = (r['Sales Pipeline Status'] || 'unknown').toString().trim();
        eipPipeline[pipeline] = (eipPipeline[pipeline] || 0) + 1;
      });
      Object.entries(eipPipeline).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
        console.log(`   ${p}: ${c}`);
      });
      console.log('');

      // Check EIP revisions
      const eipRevisions = eipEstimates.filter(r => {
        const version = r['Version'];
        if (!version) return false;
        const versionStr = String(version).trim();
        return versionStr !== '1' && versionStr !== '1.0' && versionStr !== '';
      });
      console.log(`EIP that are revisions: ${eipRevisions.length}`);
      console.log(`EIP that are NOT revisions: ${eipEstimates.length - eipRevisions.length}\n`);

      // Check EIP prices
      const eipPrices = eipEstimates.map(r => parseFloat(r['Total Price'] || r['Total Price With Tax'] || 0));
      const avgEipPrice = eipPrices.reduce((s, p) => s + p, 0) / eipPrices.length;
      const minEipPrice = Math.min(...eipPrices);
      const maxEipPrice = Math.max(...eipPrices);
      console.log(`EIP Price range: $${minEipPrice.toFixed(2)} - $${maxEipPrice.toFixed(2)} (avg: $${avgEipPrice.toFixed(2)})`);
    }

  } catch (error) {
    console.error('❌ An unexpected error occurred:', error);
    process.exit(1);
  }
}

analyze22Difference();

