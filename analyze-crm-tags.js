#!/usr/bin/env node

import XLSX from 'xlsx';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

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
const crmTagsIndex = headers.findIndex(h => h === 'CRM Tags');
const estimateIdIndex = headers.findIndex(h => h === 'Estimate ID');

if (crmTagsIndex < 0) {
  console.log('❌ CRM Tags column not found in Excel file');
  process.exit(1);
}

// Collect all CRM tags
const tagCounts = new Map();
const tagExamples = new Map(); // Store example estimate IDs for each tag

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;

  const crmTags = row[crmTagsIndex];
  const estimateId = row[estimateIdIndex]?.toString().trim();

  if (!crmTags) continue;

  // CRM tags might be comma-separated or space-separated
  const tags = String(crmTags)
    .split(/[,;]/)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  tags.forEach(tag => {
    const currentCount = tagCounts.get(tag) || 0;
    tagCounts.set(tag, currentCount + 1);
    
    // Store example estimate ID (keep first 3 examples)
    if (!tagExamples.has(tag)) {
      tagExamples.set(tag, []);
    }
    if (tagExamples.get(tag).length < 3 && estimateId) {
      tagExamples.get(tag).push(estimateId);
    }
  });
}

// Sort by count (most common first)
const sortedTags = Array.from(tagCounts.entries())
  .sort((a, b) => b[1] - a[1]);

console.log('══════════════════════════════════════════════════');
console.log('📊 CRM TAGS ANALYSIS');
console.log('══════════════════════════════════════════════════\n');
console.log(`Total unique CRM tags: ${tagCounts.size}`);
console.log(`Total estimates with CRM tags: ${Array.from(tagCounts.values()).reduce((a, b) => a + b, 0)}\n`);

console.log('══════════════════════════════════════════════════');
console.log('🏷️  TOP 20 MOST COMMON CRM TAGS');
console.log('══════════════════════════════════════════════════\n');

sortedTags.slice(0, 20).forEach(([tag, count], index) => {
  const examples = tagExamples.get(tag);
  console.log(`${(index + 1).toString().padStart(2)}. "${tag}"`);
  console.log(`    Count: ${count} estimates`);
  if (examples && examples.length > 0) {
    console.log(`    Examples: ${examples.join(', ')}`);
  }
  console.log('');
});

// Show some sample rows with CRM tags
console.log('══════════════════════════════════════════════════');
console.log('📋 SAMPLE ESTIMATES WITH CRM TAGS');
console.log('══════════════════════════════════════════════════\n');

let sampleCount = 0;
for (let i = 1; i < rows.length && sampleCount < 10; i++) {
  const row = rows[i];
  if (!row || row.length === 0) continue;

  const crmTags = row[crmTagsIndex];
  const estimateId = row[estimateIdIndex]?.toString().trim();
  const projectName = row[headers.findIndex(h => h === 'Project Name')]?.toString().trim();

  if (crmTags && estimateId) {
    sampleCount++;
    console.log(`${sampleCount}. Estimate ID: ${estimateId}`);
    console.log(`   Project: ${projectName || 'N/A'}`);
    console.log(`   CRM Tags: "${crmTags}"`);
    console.log('');
  }
}

