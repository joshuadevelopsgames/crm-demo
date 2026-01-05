# Spec-as-Code Implementation Plan

## Overview

Convert specifications from Markdown to structured format (YAML/JSON) to enable:
- Programmatic validation of rules
- Automatic documentation generation
- Test stub generation from rules
- Code validation against specs
- Spec-driven code changes

## Phase 1: Structure Definition

### Spec Schema (YAML)

```yaml
spec:
  name: "Accounts"
  slug: "accounts"
  version: "2.0.0"
  status: "authoritative"
  last_updated: "2025-01-XX"
  
  purpose: "The Accounts section provides..."
  
  data_contract:
    sources:
      - name: "accounts"
        table: "accounts"
        fields:
          - name: "id"
            type: "string"
            required: true
            description: "Primary key"
          - name: "revenue_by_year"
            type: "jsonb"
            required: false
            description: "Historical revenue by year"
    
  rules:
    - id: "ACC-R1"
      description: "Account is archived if account.archived === true OR account.status === 'archived'"
      type: "archive_status"
      testable: true
      code_locations:
        - "src/pages/Accounts.jsx"
    
  acceptance_criteria:
    - id: "ACC-AC1"
      description: "Archived accounts are excluded from active list"
      rules: ["ACC-R1"]
      testable: true
  
  dependencies:
    - spec: "revenue-logic"
      rules: ["REV-R11", "REV-R12"]
    - spec: "segmentation"
      rules: ["SEG-R5"]
  
  examples:
    - name: "Basic Account Display"
      input: {...}
      output: {...}
      rules: ["ACC-R5", "ACC-R6"]
```

## Phase 2: Conversion Tools

### 1. Markdown Parser

**File**: `scripts/parse-spec-markdown.js`

**Function**: Parse existing Markdown specs and convert to YAML

**Features**:
- Extract rules (R1, R2, etc.)
- Extract acceptance criteria (AC1, AC2, etc.)
- Extract examples
- Extract data contracts
- Extract dependencies

### 2. YAML Validator

**File**: `scripts/validate-spec-yaml.js`

**Function**: Validate YAML specs against schema

**Features**:
- Schema validation
- Rule reference validation
- Dependency validation
- Required fields check

### 3. Documentation Generator

**File**: `scripts/generate-spec-docs.js`

**Function**: Generate Markdown documentation from YAML specs

**Features**:
- Generate formatted Markdown
- Include all sections (Purpose, Data Contract, Rules, etc.)
- Generate cross-references
- Generate examples

## Phase 3: Code Validation

### Enhanced Code Validator

**File**: `scripts/validate-code-against-specs.js`

**Function**: Validate code matches YAML spec rules

**Features**:
- Parse YAML specs
- Check code files match rule implementations
- Generate violation reports
- Suggest code changes based on spec updates

## Phase 4: Test Generation

### Test Generator

**File**: `scripts/generate-tests-from-specs.js`

**Function**: Generate test files from YAML spec rules

**Features**:
- Generate test stubs for each rule
- Include test data from examples
- Generate test descriptions from rule descriptions
- Support multiple test frameworks (Jest, Vitest, etc.)

## Phase 5: Spec-Driven Code Changes

### Code Update Generator

**File**: `scripts/update-code-from-specs.js`

**Function**: Suggest or auto-apply code changes based on spec updates

**Features**:
- Detect spec changes (via git diff)
- Identify affected code files
- Suggest code updates
- Auto-update comments referencing rules
- Generate migration guide

## Implementation Steps

### Step 1: Create Schema (Week 1)
- [ ] Define YAML schema for specs
- [ ] Create schema validation
- [ ] Document schema structure

### Step 2: Convert One Spec (Week 2)
- [ ] Convert `accounts.md` to `accounts.yaml`
- [ ] Validate conversion
- [ ] Generate Markdown from YAML (verify it matches)
- [ ] Test round-trip conversion

### Step 3: Build Tools (Week 3-4)
- [ ] Build Markdown parser
- [ ] Build YAML validator
- [ ] Build documentation generator
- [ ] Build code validator
- [ ] Build test generator

### Step 4: Convert All Specs (Week 5-6)
- [ ] Convert all remaining specs to YAML
- [ ] Validate all conversions
- [ ] Update references
- [ ] Update documentation

### Step 5: Integration (Week 7)
- [ ] Integrate into CI/CD
- [ ] Set up automated validation
- [ ] Set up automated test generation
- [ ] Document workflow

## File Structure

```
docs/
  sections/
    accounts.yaml          # Structured spec
    accounts.md            # Generated (gitignored)
    revenue-logic.yaml
    revenue-logic.md       # Generated
    ...

scripts/
  parse-spec-markdown.js
  validate-spec-yaml.js
  generate-spec-docs.js
  validate-code-against-specs.js
  generate-tests-from-specs.js
  update-code-from-specs.js

schemas/
  spec-schema.json        # JSON Schema for validation
  spec-schema.yaml        # YAML Schema definition
```

## Benefits

1. **Programmatic Validation**: Rules can be validated automatically
2. **Test Generation**: Tests generated from rules, not manually written
3. **Code Alignment**: Code validated against specs automatically
4. **Spec-Driven Changes**: Spec changes drive code updates
5. **Documentation**: Always up-to-date (generated from source)
6. **Version Control**: Track spec changes in structured format

## Example Workflow

### Current (Markdown)
1. Update `accounts.md` manually
2. Manually check code matches
3. Manually write tests
4. Hope nothing breaks

### Future (YAML)
1. Update `accounts.yaml` (structured)
2. Run `validate-code-against-specs.js` → see what needs updating
3. Run `generate-tests-from-specs.js` → get test stubs
4. Run `update-code-from-specs.js` → get code suggestions
5. Run `generate-spec-docs.js` → update Markdown docs
6. All automated, all validated

## Migration Strategy

1. **Parallel Run**: Keep both Markdown and YAML during transition
2. **Gradual Conversion**: Convert one spec at a time
3. **Validation**: Ensure generated Markdown matches original
4. **Team Training**: Document new workflow
5. **Full Cutover**: Once all specs converted, switch to YAML as source

## Questions to Resolve

1. **YAML vs JSON**: YAML is more human-readable, JSON is more programmatic
2. **Git Strategy**: Should generated Markdown be in git or gitignored?
3. **CI Integration**: When to run validation/generation?
4. **Backward Compatibility**: How to handle existing Markdown-only workflows?

## Next Steps

1. Review and approve this plan
2. Create YAML schema
3. Convert one spec as proof of concept
4. Build tools incrementally
5. Convert remaining specs

