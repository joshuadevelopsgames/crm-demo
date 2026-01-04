# Section Specifications - Governance and Enforcement

## Purpose

This directory contains Markdown-based specifications that act as the **single source of truth** for behavior in each major application section. These specs protect against behavioral drift and ensure AI-driven changes maintain consistency.

## Change Control

### Classification Rules

#### Behavior Change
- **Definition**: Any change that modifies what the application does, how it calculates results, or what data is displayed
- **Requirement**: Spec approval required **BEFORE** making code changes
- **Process**:
  1. Identify which spec(s) are affected
  2. Propose spec changes with clear rationale
  3. Wait for explicit product owner approval
  4. Update spec file
  5. Implement code changes citing rule IDs (R#, AC#)

#### Refactor Only
- **Definition**: Code changes that improve structure, performance, or maintainability without changing behavior
- **Requirement**: Must explicitly declare "no behavior change" in commit/PR
- **Process**:
  1. Confirm no spec rules are violated
  2. Make code changes
  3. Add comment: `// Refactor: No behavior change per spec <section-slug>.md`

#### Bug Fix
- **Definition**: Fixing code that doesn't match the spec, or fixing the spec if it was wrong
- **Requirement**: Clarify whether code or spec was wrong
- **Process**:
  1. If code was wrong: Fix code to match spec
  2. If spec was wrong: Get approval to update spec first, then fix code
  3. Document in commit: `Bug fix: <description> - Code was wrong | Spec was wrong`

## Spec Structure

Each spec file (`docs/sections/<section-slug>.md`) must include:

1. **Purpose** - What this section does
2. **Data contract** - Sources, entities, fields, types
3. **Logic** - Ordered flow, transformations, computations
4. **Rules** - Numbered, testable rules (R1, R2, etc.)
5. **Precedence and conflict resolution** - Explicit precedence order
6. **Examples** - 3-8 concrete examples with inputs/outputs
7. **Acceptance criteria** - Numbered ACs referencing rule IDs
8. **Special considerations** - Edge cases, exceptions
9. **Telemetry** - Key events to log
10. **Open questions** - Ambiguities for product owner

## Enforcement

### For Every Prompt/Task

1. **Spec Acknowledgment** (REQUIRED at start of every response):
   ```
   Spec check:
   - Specs referenced: <list paths> OR none
   - Spec status: authoritative | missing | clarification required
   ```

2. **Before Code Changes**:
   - Read the relevant section spec
   - Cite specific rule IDs (R#, AC#) when implementing
   - If change violates spec, STOP and ask for approval

3. **In Commits/PRs**:
   - Reference spec file: `Per spec: docs/sections/<section-slug>.md`
   - Cite rule IDs: `Implements R5, R7, AC3`
   - If spec changed: `Spec updated: <section-slug>.md (approved by <owner>)`

### CODEOWNERS (Recommended)

Add to `.github/CODEOWNERS` or equivalent:
```
docs/sections/*.md @product-owner
```

### PR Checklist (Recommended)

- [ ] Spec referenced (or "No spec exists for this section")
- [ ] Spec change approval status (if applicable)
- [ ] Rule IDs cited in code comments
- [ ] Behavior change classification declared

## Spec Maintenance

- Specs are tracked in Git
- Spec changes are reviewable and auditable
- Specs cannot be modified without explicit product owner approval
- Each spec file includes a "Change control" section stating this requirement

## Questions?

If you're unsure which spec applies or if a change requires spec approval, **STOP and ask the product owner for clarification**.

