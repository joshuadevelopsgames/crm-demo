#!/usr/bin/env node

/**
 * Code-to-Spec Validation Script
 * 
 * Validates that code implementations match spec rules. This allows us to:
 * 1. Check that code aligns with spec rules
 * 2. Generate test stubs from rules
 * 3. Ensure code changes don't violate specs
 * 
 * Usage: node scripts/validate-code-matches-specs.js [--generate-tests]
 */

const fs = require('fs');
const path = require('path');

const SPECS_DIR = path.join(__dirname, '..', 'docs', 'sections');
const SRC_DIR = path.join(__dirname, '..', 'src');

// Extract rules from spec file
function extractRules(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rules = [];
  
  // Match rules: **R1**: description
  const ruleRegex = /\*\*R(\d+)\*\*:\s*(.+?)(?=\n\*\*R\d+\*\*|\n##|\n\*\*AC|\n$)/gs;
  let match;
  while ((match = ruleRegex.exec(content)) !== null) {
    rules.push({
      number: parseInt(match[1]),
      description: match[2].trim(),
      fullText: match[0].trim()
    });
  }
  
  return rules;
}

// Find code files that should implement a spec
function findCodeFiles(specName) {
  const codeFiles = [];
  
  // Map spec names to expected code locations
  const specToCodeMap = {
    'accounts': ['src/pages/Accounts.jsx', 'src/pages/AccountDetail.jsx', 'api/data/accounts.js'],
    'revenue-logic': ['src/utils/revenueSegmentCalculator.js', 'src/pages/Accounts.jsx'],
    'segmentation': ['src/utils/revenueSegmentCalculator.js', 'src/pages/Accounts.jsx'],
    'estimates': ['api/data/estimates.js', 'src/utils/lmnEstimatesListParser.js'],
    'year-selection-system': ['src/contexts/YearSelectorContext.jsx'],
    'at-risk-accounts': ['src/utils/atRiskCalculator.js', 'api/cron/refresh-notifications.js'],
    'neglected-accounts': ['src/utils/atRiskCalculator.js', 'api/cron/refresh-notifications.js'],
    'notification-caching': ['api/cron/refresh-notifications.js', 'api/notifications.js'],
    'won-loss-ratio': ['src/utils/reportCalculations.js'],
    'import-process': ['src/components/ImportLeadsDialog.jsx']
  };
  
  const files = specToCodeMap[specName] || [];
  return files.filter(f => {
    const filePath = path.join(__dirname, '..', f);
    return fs.existsSync(filePath);
  });
}

// Check if code file contains rule implementation
function checkRuleImplementation(codeFilePath, rule) {
  const content = fs.readFileSync(codeFilePath, 'utf8');
  
  // Look for rule references in comments
  const ruleRefRegex = new RegExp(`(?:R${rule.number}|rule ${rule.number}|spec.*R${rule.number})`, 'i');
  const hasReference = ruleRefRegex.test(content);
  
  // Look for keywords from rule description
  const keywords = rule.description.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 5); // Take first 5 keywords
  
  const keywordMatches = keywords.filter(kw => 
    content.toLowerCase().includes(kw)
  ).length;
  
  return {
    hasReference,
    keywordMatches,
    keywordCount: keywords.length,
    confidence: hasReference ? 'high' : (keywordMatches >= 2 ? 'medium' : 'low')
  };
}

// Generate test stub from rule
function generateTestStub(specName, rule) {
  const testName = `${specName}-R${rule.number}`.replace(/-/g, '_');
  
  return `/**
 * Test: ${specName} - Rule R${rule.number}
 * 
 * ${rule.description}
 * 
 * Spec: docs/sections/${specName}.md
 */
test('${specName} R${rule.number}: ${rule.description.substring(0, 60)}...', () => {
  // TODO: Implement test based on rule
  // Rule: ${rule.description}
  
  // Example test structure:
  // const input = { /* test input */ };
  // const expected = { /* expected output */ };
  // const result = functionUnderTest(input);
  // expect(result).toEqual(expected);
});
`;
}

// Main validation function
function validateCodeMatchesSpecs(generateTests = false) {
  const specFiles = fs.readdirSync(SPECS_DIR)
    .filter(f => f.endsWith('.md') && f !== 'README.md' && f !== 'index.md' && 
                 f !== 'shared-data-contracts.md' && f !== 'YEAR_SELECTOR_COMPARISON.md' &&
                 f !== 'import-process.md' && f !== 'cache-invalidation.md');
  
  const results = [];
  const testStubs = [];
  
  for (const specFile of specFiles) {
    const specName = specFile.replace('.md', '');
    const specPath = path.join(SPECS_DIR, specFile);
    const rules = extractRules(specPath);
    const codeFiles = findCodeFiles(specName);
    
    if (codeFiles.length === 0) {
      results.push({
        spec: specName,
        status: 'warning',
        message: `No code files found for spec ${specName}`
      });
      continue;
    }
    
    for (const rule of rules) {
      let found = false;
      const implementations = [];
      
      for (const codeFile of codeFiles) {
        const check = checkRuleImplementation(codeFile, rule);
        if (check.hasReference || check.confidence === 'high') {
          found = true;
          implementations.push({
            file: codeFile,
            confidence: check.confidence,
            hasReference: check.hasReference
          });
        }
      }
      
      if (!found && generateTests) {
        testStubs.push(generateTestStub(specName, rule));
      }
      
      results.push({
        spec: specName,
        rule: `R${rule.number}`,
        description: rule.description.substring(0, 60) + '...',
        found,
        implementations
      });
    }
  }
  
  // Report results
  console.log('\n📋 Code-to-Spec Validation Report\n');
  
  const foundCount = results.filter(r => r.found).length;
  const notFoundCount = results.filter(r => !r.found).length;
  
  console.log(`Scanned ${specFiles.length} specs, ${results.length} rules\n`);
  console.log(`✅ Rules with code references: ${foundCount}`);
  console.log(`⚠️  Rules without code references: ${notFoundCount}\n`);
  
  if (notFoundCount > 0) {
    console.log('Rules without code references:\n');
    results.filter(r => !r.found).forEach((result, i) => {
      console.log(`${i + 1}. ${result.spec} R${result.rule}: ${result.description}`);
    });
    console.log('');
  }
  
  if (generateTests && testStubs.length > 0) {
    const testFile = path.join(__dirname, '..', 'tests', 'spec-generated-tests.js');
    const testDir = path.dirname(testFile);
    
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    fs.writeFileSync(testFile, `/**
 * Auto-generated test stubs from spec rules
 * 
 * Generated: ${new Date().toISOString()}
 * 
 * These are test stubs that need to be implemented based on spec rules.
 * Each test corresponds to a rule in the spec files.
 */

${testStubs.join('\n\n')}
`);
    
    console.log(`📝 Generated ${testStubs.length} test stubs in ${testFile}\n`);
  }
  
  return notFoundCount === 0 ? 0 : 1;
}

// Run validation
if (require.main === module) {
  const generateTests = process.argv.includes('--generate-tests');
  process.exit(validateCodeMatchesSpecs(generateTests));
}

module.exports = { validateCodeMatchesSpecs, extractRules, generateTestStub };

