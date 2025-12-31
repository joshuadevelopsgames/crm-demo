#!/usr/bin/env node

import XLSX from 'xlsx';
import { join } from 'path';
import { homedir } from 'os';

const excelPath = join(process.env.HOME || homedir(), 'Downloads', 'Estimates List.xlsx');
const workbook = XLSX.readFile(excelPath);
const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

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

function isWonStatus(status) {
  if (!status) return false;
  const statusLower = status.toString().toLowerCase().trim();
  const wonStatuses = ['contract signed', 'work complete', 'billing complete', 'email contract award', 'verbal contract award', 'won'];
  return wonStatuses.includes(statusLower);
}

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

// Apply LMN-compatible filtering
const filtered = unique.filter(r => {
  const status = (r['Status'] || '').toString().toLowerCase().trim();
  const isHold = status === 'estimate on hold';
  const isProposal = status === 'client proposal phase';
  const isWIP = status === 'work in progress';
  const isEIP = status === 'estimate in progress';
  const version = r['Version'];
  const isNotRevision = !version || String(version).trim() === '1' || String(version).trim() === '1.0' || String(version).trim() === '';
  
  if (isHold || isProposal || isWIP) return false;
  if (isEIP && isNotRevision) return false;
  if (isEIP && !isNotRevision) {
    const pipeline = (r['Sales Pipeline Status'] || '').toString().trim().toLowerCase();
    const price = parseFloat(r['Total Price'] || r['Total Price With Tax'] || 0);
    if (pipeline === 'pending' && price > 0 && price < 500) return false;
  }
  return true;
});

const won = filtered.filter(r => isWonStatus(r['Status']));

console.log('Deep Investigation: Finding the Remaining $1.71M\n');
console.log('═══════════════════════════════════════════════════════════════\n');

// Exclude the 14 suspicious estimates first
const wonExcludingSuspicious = won.filter(r => {
  const price = parseFloat(r['Total Price'] || 0);
  const hours = parseFloat(r['Labor Hours'] || r['Total Labor Hours'] || r['Hours'] || 0);
  if (isNaN(hours) || hours === 0) return true; // Keep if no hours data
  return !(price > 100000 && hours < 10);
});

const currentDollar = wonExcludingSuspicious.reduce((sum, r) => sum + (parseFloat(r['Total Price'] || 0)), 0);
const lmnSold = 11050000;

console.log('After excluding > $100K and < 10 hours:');
console.log('  Count: ' + wonExcludingSuspicious.length);
console.log('  Dollar: $' + (currentDollar / 1000000).toFixed(2) + 'M');
console.log('  LMN: $11.05M');
console.log('  Difference: $' + ((currentDollar - lmnSold) / 1000000).toFixed(2) + 'M\n');

// Test 1: Exclude all estimates with < 10 hours (regardless of price)
const wonExcludingLowHours = won.filter(r => {
  const hours = parseFloat(r['Labor Hours'] || r['Total Labor Hours'] || r['Hours'] || 0);
  if (isNaN(hours) || hours === 0) return true; // Keep if no hours data
  return hours >= 10;
});

const lowHoursDollar = wonExcludingLowHours.reduce((sum, r) => sum + (parseFloat(r['Total Price'] || 0)), 0);
const lowHoursExcluded = won.length - wonExcludingLowHours.length;
const lowHoursExcludedValue = won
  .filter(r => {
    const hours = parseFloat(r['Labor Hours'] || r['Total Labor Hours'] || r['Hours'] || 0);
    return !isNaN(hours) && hours > 0 && hours < 10;
  })
  .reduce((sum, r) => sum + (parseFloat(r['Total Price'] || 0)), 0);

console.log('Test 1: Exclude ALL won estimates with < 10 hours');
console.log('  Excluded: ' + lowHoursExcluded + ' estimates, $' + (lowHoursExcludedValue / 1000000).toFixed(2) + 'M');
console.log('  Count: ' + wonExcludingLowHours.length);
console.log('  Dollar: $' + (lowHoursDollar / 1000000).toFixed(2) + 'M');
console.log('  Difference: $' + ((lowHoursDollar - lmnSold) / 1000000).toFixed(2) + 'M');
if (Math.abs(lowHoursDollar - lmnSold) < Math.abs(currentDollar - lmnSold)) {
  console.log('  ✅ CLOSER!\n');
} else {
  console.log('  ❌ Not closer\n');
}

// Test 2: Exclude Email/Verbal Contract Award from dollar calculations
const wonExcludingAwards = wonExcludingSuspicious.filter(r => {
  const status = (r['Status'] || '').toString().toLowerCase().trim();
  return status !== 'email contract award' && status !== 'verbal contract award';
});

const awardsDollar = wonExcludingAwards.reduce((sum, r) => sum + (parseFloat(r['Total Price'] || 0)), 0);
const awardsCount = wonExcludingSuspicious.length - wonExcludingAwards.length;
const awardsValue = wonExcludingSuspicious
  .filter(r => {
    const status = (r['Status'] || '').toString().toLowerCase().trim();
    return status === 'email contract award' || status === 'verbal contract award';
  })
  .reduce((sum, r) => sum + (parseFloat(r['Total Price'] || 0)), 0);

console.log('Test 2: Exclude Email/Verbal Contract Award from dollars');
console.log('  Excluded: ' + awardsCount + ' estimates, $' + (awardsValue / 1000000).toFixed(2) + 'M');
console.log('  Count: ' + wonExcludingAwards.length);
console.log('  Dollar: $' + (awardsDollar / 1000000).toFixed(2) + 'M');
console.log('  Difference: $' + ((awardsDollar - lmnSold) / 1000000).toFixed(2) + 'M');
if (Math.abs(awardsDollar - lmnSold) < Math.abs(currentDollar - lmnSold)) {
  console.log('  ✅ CLOSER!\n');
} else {
  console.log('  ❌ Not closer\n');
}

// Test 3: Exclude estimates with zero hours
const wonExcludingZeroHours = wonExcludingSuspicious.filter(r => {
  const hours = parseFloat(r['Labor Hours'] || r['Total Labor Hours'] || r['Hours'] || 0);
  return !isNaN(hours) && hours > 0;
});

const zeroHoursDollar = wonExcludingZeroHours.reduce((sum, r) => sum + (parseFloat(r['Total Price'] || 0)), 0);
const zeroHoursCount = wonExcludingSuspicious.length - wonExcludingZeroHours.length;
const zeroHoursValue = wonExcludingSuspicious
  .filter(r => {
    const hours = parseFloat(r['Labor Hours'] || r['Total Labor Hours'] || r['Hours'] || 0);
    return isNaN(hours) || hours === 0;
  })
  .reduce((sum, r) => sum + (parseFloat(r['Total Price'] || 0)), 0);

console.log('Test 3: Exclude won estimates with zero/missing hours');
console.log('  Excluded: ' + zeroHoursCount + ' estimates, $' + (zeroHoursValue / 1000000).toFixed(2) + 'M');
console.log('  Count: ' + wonExcludingZeroHours.length);
console.log('  Dollar: $' + (zeroHoursDollar / 1000000).toFixed(2) + 'M');
console.log('  Difference: $' + ((zeroHoursDollar - lmnSold) / 1000000).toFixed(2) + 'M');
if (Math.abs(zeroHoursDollar - lmnSold) < Math.abs(currentDollar - lmnSold)) {
  console.log('  ✅ CLOSER!\n');
} else {
  console.log('  ❌ Not closer\n');
}

// Test 4: Combination - exclude suspicious + zero hours
const wonExcludingBoth = won.filter(r => {
  const price = parseFloat(r['Total Price'] || 0);
  const hours = parseFloat(r['Labor Hours'] || r['Total Labor Hours'] || r['Hours'] || 0);
  // Exclude: > $100K and < 10 hours, OR zero/missing hours
  if (isNaN(hours) || hours === 0) return false;
  if (price > 100000 && hours < 10) return false;
  return true;
});

const bothDollar = wonExcludingBoth.reduce((sum, r) => sum + (parseFloat(r['Total Price'] || 0)), 0);
const bothCount = won.length - wonExcludingBoth.length;
const bothValue = won
  .filter(r => {
    const price = parseFloat(r['Total Price'] || 0);
    const hours = parseFloat(r['Labor Hours'] || r['Total Labor Hours'] || r['Hours'] || 0);
    return (isNaN(hours) || hours === 0) || (price > 100000 && hours < 10);
  })
  .reduce((sum, r) => sum + (parseFloat(r['Total Price'] || 0)), 0);

console.log('Test 4: Exclude suspicious (> $100K, < 10h) + zero hours');
console.log('  Excluded: ' + bothCount + ' estimates, $' + (bothValue / 1000000).toFixed(2) + 'M');
console.log('  Count: ' + wonExcludingBoth.length);
console.log('  Dollar: $' + (bothDollar / 1000000).toFixed(2) + 'M');
console.log('  Difference: $' + ((bothDollar - lmnSold) / 1000000).toFixed(2) + 'M');
if (Math.abs(bothDollar - lmnSold) < Math.abs(currentDollar - lmnSold)) {
  console.log('  ✅ CLOSER!\n');
} else {
  console.log('  ❌ Not closer\n');
}

// Test 5: Check for very high dollar estimates that might be excluded
const sortedByPrice = wonExcludingSuspicious.sort((a, b) => {
  const priceA = parseFloat(a['Total Price'] || 0);
  const priceB = parseFloat(b['Total Price'] || 0);
  return priceB - priceA;
});

console.log('Test 5: Top 30 estimates by dollar value (after excluding suspicious)');
console.log('  (Looking for patterns in high-value estimates)\n');
sortedByPrice.slice(0, 30).forEach((r, i) => {
  const price = parseFloat(r['Total Price'] || 0);
  const hours = parseFloat(r['Labor Hours'] || r['Total Labor Hours'] || r['Hours'] || 0);
  const status = (r['Status'] || '').toString().trim();
  const div = r['Division'] || 'Unknown';
  console.log('  ' + (i + 1) + '. ' + r['Estimate ID'] + ': $' + (price / 1000).toFixed(0) + 'K - ' + status + ' - ' + div + ' - Hours: ' + (hours || 'N/A'));
});

// Test 6: Check if there's a pattern with specific statuses
console.log('\n═══════════════════════════════════════════════════════════════');
console.log('Status Breakdown Analysis:\n');
console.log('═══════════════════════════════════════════════════════════════\n');

const statusBreakdown = {};
wonExcludingSuspicious.forEach(r => {
  const s = (r['Status'] || 'unknown').toString().trim();
  if (!statusBreakdown[s]) {
    statusBreakdown[s] = { count: 0, dollar: 0 };
  }
  statusBreakdown[s].count++;
  statusBreakdown[s].dollar += parseFloat(r['Total Price'] || 0);
});

Object.entries(statusBreakdown).sort((a, b) => b[1].dollar - a[1].dollar).forEach(([s, stats]) => {
  console.log(s + ':');
  console.log('  Count: ' + stats.count);
  console.log('  Dollar: $' + (stats.dollar / 1000000).toFixed(2) + 'M');
  console.log('  Avg per estimate: $' + (stats.dollar / stats.count / 1000).toFixed(0) + 'K');
  console.log('');
});

