# Won/Loss/Pending Algorithm Analysis

## Overview

The system uses a **two-tier status mapping algorithm** to determine if an estimate is **won**, **lost**, or **pending**. This algorithm processes data from CSV imports and LMN exports.

## How It Works

### Algorithm Flow

```
1. Check "Sales Pipeline Status" field first (more reliable)
   ├─ "sold" → WON
   ├─ "lost" → LOST
   └─ "pending" → PENDING

2. If Pipeline Status is empty/unclear, check "Status" field
   ├─ Contains "contract signed", "contract award", "sold", "email contract", "verbal contract" → WON
   ├─ Contains "lost" or "estimate lost" → LOST
   └─ Contains "in progress", "pending", or empty → PENDING

3. Default: PENDING (if no clear match)
```

### Implementation Details

#### CSV Parser (`src/utils/csvParser.js`)
```javascript
function mapStatus(status, pipelineStatus) {
  // Priority 1: Pipeline Status (more reliable)
  const pipeline = (pipelineStatus || '').toLowerCase();
  if (pipeline === 'sold') return 'won';
  if (pipeline === 'lost') return 'lost';
  if (pipeline === 'pending') return 'pending';
  
  // Priority 2: Status field (fallback)
  const stat = (status || '').toLowerCase();
  
  // Won patterns
  if (stat.includes('contract signed') || 
      stat.includes('contract award') || 
      stat.includes('sold') ||
      stat.includes('email contract') ||
      stat.includes('verbal contract')) {
    return 'won';
  }
  
  // Lost patterns
  if (stat.includes('lost') || stat.includes('estimate lost')) {
    return 'lost';
  }
  
  // Pending patterns
  if (stat.includes('in progress') || 
      stat.includes('pending') || 
      stat === '') {
    return 'pending';
  }
  
  return 'pending'; // Default
}
```

#### LMN Parser (`src/utils/lmnEstimatesListParser.js`)
```javascript
// Simpler logic - checks both fields simultaneously
if (pipelineStatus.toLowerCase().includes('sold') || 
    pipelineStatus.toLowerCase().includes('contract') ||
    status.toLowerCase().includes('won')) {
  estimateStatus = 'won';
} else if (pipelineStatus.toLowerCase().includes('lost') ||
           status.toLowerCase().includes('lost')) {
  estimateStatus = 'lost';
} else {
  estimateStatus = 'pending'; // Default
}
```

## Accuracy Assessment

### ✅ Strengths

1. **Two-tier priority system**: Pipeline Status is checked first (more reliable field)
2. **Flexible pattern matching**: Uses `includes()` to catch variations:
   - "Contract Signed" → won
   - "Email Contract Award" → won
   - "Estimate Lost - Price too high" → lost
   - "Estimate In Progress" → pending
3. **Safe defaults**: Defaults to "pending" rather than misclassifying
4. **Case-insensitive**: Handles "SOLD", "Sold", "sold" equally

### ⚠️ Potential Issues

1. **False positives for "WON"**:
   - Status: "Contract Signed - Pending Approval" → Would be marked as "won" (contains "contract signed")
   - Status: "Sold Equipment" (unrelated) → Would be marked as "won" (contains "sold")
   
2. **False positives for "LOST"**:
   - Status: "Lost Contact" → Would be marked as "lost" (contains "lost")
   - Status: "Lost in Translation" → Would be marked as "lost"

3. **Inconsistent logic between parsers**:
   - CSV parser: Checks Pipeline Status first, then Status field
   - LMN parser: Checks both simultaneously with OR logic
   - This could produce different results for the same data

4. **Missing edge cases**:
   - No handling for "cancelled", "on hold", "deferred"
   - No handling for partial wins (e.g., "Partially Won")
   - No handling for statuses like "quoted", "proposed", "negotiating"

5. **No validation**:
   - Doesn't verify that won estimates have a close date
   - Doesn't check for logical inconsistencies (e.g., won but no revenue)

## Test Strategy

### 1. Unit Tests

Test individual status mappings:

```javascript
// Test cases
mapStatus('Contract Signed', '') → 'won'
mapStatus('', 'Sold') → 'won'
mapStatus('Estimate Lost', '') → 'lost'
mapStatus('', 'Lost') → 'lost'
mapStatus('In Progress', '') → 'pending'
mapStatus('', 'Pending') → 'pending'
mapStatus('', '') → 'pending' // Default
```

### 2. Edge Case Tests

```javascript
// False positive risks
mapStatus('Contract Signed - Pending', '') → Should be 'pending', but returns 'won'
mapStatus('Lost Contact', '') → Should be 'pending', but returns 'lost'
mapStatus('Sold Equipment', '') → Should be 'pending', but returns 'won'

// Case variations
mapStatus('CONTRACT SIGNED', '') → 'won' ✅
mapStatus('contract signed', '') → 'won' ✅
mapStatus('Contract Signed', '') → 'won' ✅
```

### 3. Real Data Validation

Compare algorithm results against manual review:
- Sample 50-100 estimates
- Manually classify each
- Compare with algorithm output
- Calculate accuracy percentage

### 4. Integration Tests

Test with actual CSV files:
- Load real CSV data
- Process through algorithm
- Verify counts match expectations
- Check for unexpected classifications

## Recommended Improvements

### 1. More Precise Pattern Matching

```javascript
// Instead of includes(), use exact matches or word boundaries
const wonPatterns = [
  /^contract signed$/i,
  /^contract award$/i,
  /^sold$/i,
  /^email contract$/i,
  /^verbal contract$/i
];

const lostPatterns = [
  /^lost$/i,
  /^estimate lost$/i
];
```

### 2. Add Status Validation

```javascript
// Validate won estimates have required data
if (status === 'won' && !closeDate) {
  console.warn('Won estimate missing close date:', estimate);
}

// Validate lost estimates
if (status === 'lost' && !closeDate) {
  console.warn('Lost estimate missing close date:', estimate);
}
```

### 3. Unify Parser Logic

Make CSV and LMN parsers use the same algorithm:

```javascript
// Create shared utility
export function determineEstimateStatus(status, pipelineStatus) {
  // Unified logic used by both parsers
}
```

### 4. Add Manual Override

Allow users to manually correct misclassifications:
- Add "Override Status" field
- Store original algorithm result
- Track manual corrections for algorithm improvement

### 5. Add Confidence Score

```javascript
{
  status: 'won',
  confidence: 0.95, // High confidence (exact match)
  // vs
  status: 'won',
  confidence: 0.60  // Low confidence (pattern match, might be wrong)
}
```

## Testing Tools

### 1. Automated Test Script

Run `test-csv-accuracy.js`:
```bash
node test-csv-accuracy.js
```

This script:
- Analyzes your CSV file
- Shows all unique status values
- Tests the mapping function
- Reports mapping accuracy

### 2. Win/Loss Test Page

Access `/win-loss-test` page:
- Upload CSV file
- View all estimates with their mapped statuses
- Filter by status
- Review per-customer statistics
- Manually verify classifications

### 3. Manual Validation Checklist

For each estimate, verify:
- [ ] Status matches expected classification
- [ ] Won estimates have close dates
- [ ] Lost estimates have close dates (if applicable)
- [ ] Pending estimates are truly pending
- [ ] No false positives (e.g., "Lost Contact" marked as lost)

## Current Accuracy Estimate

Based on the algorithm design:

- **High Confidence (>90%)**: 
  - Exact matches: "Sold" → won, "Lost" → lost
  - Clear patterns: "Contract Signed" → won
  
- **Medium Confidence (70-90%)**:
  - Pattern matches: "Email Contract Award" → won
  - Variations: "Estimate Lost - Price" → lost
  
- **Low Confidence (<70%)**:
  - Edge cases: "Contract Signed - Pending" → won (should be pending)
  - Ambiguous: "Lost Contact" → lost (should be pending)

**Overall Estimated Accuracy: 85-90%**

This assumes:
- Most data uses standard status values
- Pipeline Status field is more reliable (used first)
- Edge cases are relatively rare

## Next Steps

1. **Run test script** on your actual CSV data
2. **Manually review** a sample of 50-100 estimates
3. **Identify patterns** in misclassifications
4. **Update algorithm** based on findings
5. **Add validation** rules
6. **Create test suite** for regression testing

