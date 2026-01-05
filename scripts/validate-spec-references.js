#!/usr/bin/env node

/**
 * Spec Reference Validation Script
 * 
 * Validates that all rule references (R#, AC#) in spec files actually exist
 * in the referenced spec files. Also checks for broken file references.
 * 
 * Usage: node scripts/validate-spec-references.js
 */

const fs = require('fs');
const path = require('path');

const SPECS_DIR = path.join(__dirname, '..', 'docs', 'sections');

// Extract all rules and ACs from a spec file
function extractRulesAndACs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rules = new Set();
  const acs = new Set();
  
  // Match rules: **R1**, **R2**, etc. or - **R1**:, - **R2**:
  const ruleRegex = /(?:^|\n)[\s\*]*(?:- )?\*\*R(\d+)\*\*/gm;
  let match;
  while ((match = ruleRegex.exec(content)) !== null) {
    rules.add(parseInt(match[1]));
  }
  
  // Match ACs: **AC1**, **AC2**, etc.
  const acRegex = /(?:^|\n)[\s\*]*(?:- )?\*\*AC(\d+)\*\*/gm;
  while ((match = acRegex.exec(content)) !== null) {
    acs.add(parseInt(match[1]));
  }
  
  return { rules, acs };
}

// Extract all spec references from a file
function extractSpecReferences(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const references = [];
  
  // Match references like: (per Estimates spec R2), (per Revenue Logic spec R21, R23)
  const refRegex = /(?:per|from|see|references?)\s+([A-Za-z\s-]+)\s+spec\s+(?:R(\d+)|AC(\d+)|R(\d+),\s*R(\d+)|R(\d+),\s*R(\d+),\s*R(\d+)|AC(\d+),\s*AC(\d+))/gi;
  let match;
  while ((match = refRegex.exec(content)) !== null) {
    const specName = match[1].trim().toLowerCase().replace(/\s+/g, '-');
    const ruleIds = [];
    
    // Extract all rule/AC numbers from the match
    for (let i = 2; i < match.length; i++) {
      if (match[i]) {
        ruleIds.push({ type: i <= 3 ? 'R' : 'AC', number: parseInt(match[i]) });
      }
    }
    
    references.push({ specName, ruleIds });
  }
  
  // Also match file references: `docs/sections/estimates.md` (R2, R12)
  const fileRefRegex = /`docs\/sections\/([a-z-]+)\.md`\s*(?:\(([^)]+)\))?/g;
  while ((match = fileRefRegex.exec(content)) !== null) {
    const specName = match[1];
    const ruleList = match[2] || '';
    const ruleIds = [];
    
    // Parse rule list like "R2, R12" or "R21, R23"
    const ruleMatches = ruleList.match(/([RAC])(\d+)/g);
    if (ruleMatches) {
      ruleMatches.forEach(rm => {
        const type = rm[0];
        const num = parseInt(rm.substring(1));
        ruleIds.push({ type, number: num });
      });
    }
    
    references.push({ specName, ruleIds });
  }
  
  return references;
}

// Get spec file path from spec name
function getSpecFilePath(specName) {
  // Handle variations: "year-selector" -> "year-selector.md" or "year-selection-system.md"
  const possibleNames = [
    specName,
    specName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).replace(/\s+/g, ''),
  ];
  
  for (const name of possibleNames) {
    const filePath = path.join(SPECS_DIR, `${name}.md`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  
  // Try direct match
  const directPath = path.join(SPECS_DIR, `${specName}.md`);
  if (fs.existsSync(directPath)) {
    return directPath;
  }
  
  return null;
}

// Main validation function
function validateSpecs() {
  const specFiles = fs.readdirSync(SPECS_DIR)
    .filter(f => f.endsWith('.md') && f !== 'README.md' && f !== 'index.md' && f !== 'YEAR_SELECTOR_COMPARISON.md');
  
  const specData = new Map();
  const errors = [];
  const warnings = [];
  
  // First pass: extract all rules and ACs from each spec
  for (const specFile of specFiles) {
    const filePath = path.join(SPECS_DIR, specFile);
    const specName = specFile.replace('.md', '');
    const { rules, acs } = extractRulesAndACs(filePath);
    specData.set(specName, { rules, acs, filePath });
  }
  
  // Second pass: validate references
  for (const specFile of specFiles) {
    const filePath = path.join(SPECS_DIR, specFile);
    const specName = specFile.replace('.md', '');
    const references = extractSpecReferences(filePath);
    
    for (const ref of references) {
      const targetSpec = specData.get(ref.specName);
      
      if (!targetSpec) {
        const targetPath = getSpecFilePath(ref.specName);
        if (!targetPath) {
          errors.push({
            file: specName,
            issue: `References non-existent spec: "${ref.specName}"`,
            line: 'unknown'
          });
          continue;
        }
        // Spec exists but not loaded, load it now
        const { rules, acs } = extractRulesAndACs(targetPath);
        specData.set(ref.specName, { rules, acs, filePath: targetPath });
        const targetSpec = specData.get(ref.specName);
      }
      
      // Validate each referenced rule/AC exists
      for (const ruleId of ref.ruleIds) {
        const exists = ruleId.type === 'R' 
          ? targetSpec.rules.has(ruleId.number)
          : targetSpec.acs.has(ruleId.number);
        
        if (!exists) {
          errors.push({
            file: specName,
            issue: `References ${ruleId.type}${ruleId.number} in "${ref.specName}" but it doesn't exist`,
            line: 'unknown'
          });
        }
      }
    }
  }
  
  // Report results
  console.log('\n📋 Spec Reference Validation Report\n');
  console.log(`Scanned ${specFiles.length} spec files\n`);
  
  if (errors.length === 0) {
    console.log('✅ All spec references are valid!\n');
    return 0;
  }
  
  console.log(`❌ Found ${errors.length} error(s):\n`);
  errors.forEach((error, i) => {
    console.log(`${i + 1}. ${error.file}: ${error.issue}`);
  });
  console.log('');
  
  return 1;
}

// Run validation
if (require.main === module) {
  process.exit(validateSpecs());
}

module.exports = { validateSpecs, extractRulesAndACs, extractSpecReferences };

