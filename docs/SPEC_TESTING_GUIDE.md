# Spec Testing Guide

## Purpose

This guide explains how the spec testing system works and how it differs from traditional unit tests.

## What is Spec Testing?

Spec testing is **not** just unit tests. It's a comprehensive system that:

1. **Validates Code Matches Specs**: Ensures code implementations align with spec rules
2. **Generates Test Stubs**: Creates test templates from spec rules
3. **Enables Spec-Driven Development**: Allows changing specs to drive code changes

## How It Works

### 1. Code-to-Spec Validation

The `validate-code-matches-specs.js` script checks that:
- Code files reference spec rules (via comments like `// Per spec R5`)
- Code contains keywords from rule descriptions
- Code files exist for each spec

**Usage:**
```bash
node scripts/validate-code-matches-specs.js
```

**Output:**
- Lists rules with code references ✅
- Lists rules without code references ⚠️
- Helps identify missing implementations

### 2. Test Stub Generation

The script can generate test stubs from spec rules:

**Usage:**
```bash
node scripts/validate-code-matches-specs.js --generate-tests
```

**Output:**
- Creates `tests/spec-generated-tests.js` with test stubs
- Each stub corresponds to a spec rule
- Tests need to be implemented based on rule descriptions

### 3. Spec-Driven Code Changes

When you change a spec:
1. Update the spec file (with approval)
2. Run validation: `node scripts/validate-code-matches-specs.js`
3. See which code needs updating
4. Update code to match new spec
5. Generate/update tests: `node scripts/validate-code-matches-specs.js --generate-tests`
6. Implement tests based on new rules

## Example Workflow

### Scenario: Update Revenue Calculation Rule

1. **Update Spec** (`docs/sections/revenue-logic.md`):
   ```markdown
   **R5**: Revenue calculation now includes tax in all cases.
   ```

2. **Run Validation**:
   ```bash
   node scripts/validate-code-matches-specs.js
   ```
   Output: "R5 needs code update in revenueSegmentCalculator.js"

3. **Update Code**:
   ```javascript
   // Per spec: revenue-logic.md R5
   function calculateRevenue(estimate) {
     // Now includes tax in all cases (R5)
     return estimate.total_price || estimate.total_price_with_tax;
   }
   ```

4. **Generate Tests**:
   ```bash
   node scripts/validate-code-matches-specs.js --generate-tests
   ```

5. **Implement Test**:
   ```javascript
   test('revenue-logic R5: Revenue calculation includes tax in all cases', () => {
     const estimate = { total_price_with_tax: 100, total_price: 90 };
     const result = calculateRevenue(estimate);
     expect(result).toBe(100); // Uses tax-inclusive price
   });
   ```

## Differences from Unit Tests

| Aspect | Unit Tests | Spec Testing |
|--------|-----------|--------------|
| **Purpose** | Test code functionality | Validate code matches specs |
| **Source** | Code requirements | Spec rules |
| **Generation** | Manual | Auto-generated stubs |
| **Validation** | Test passes/fails | Code matches spec |
| **Change Driver** | Code changes | Spec changes |

## Benefits

1. **Spec as Source of Truth**: Specs drive code, not the other way around
2. **Automatic Validation**: Catch when code drifts from specs
3. **Test Generation**: Auto-generate test stubs from rules
4. **Change Tracking**: See what code needs updating when specs change

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/spec-validation.yml
- name: Validate Spec References
  run: node scripts/validate-spec-references.js

- name: Validate Code Matches Specs
  run: node scripts/validate-code-matches-specs.js
```

## Future Enhancements

1. **Auto-fix**: Automatically update code comments when specs change
2. **Rule Coverage**: Track which rules have tests vs. which don't
3. **Spec Diff**: Show what changed between spec versions
4. **Code Suggestions**: Suggest code changes based on spec updates

## References

- **Validation Script**: `scripts/validate-code-matches-specs.js`
- **Spec Reference Validation**: `scripts/validate-spec-references.js`
- **Spec Files**: `docs/sections/*.md`

