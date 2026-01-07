# Improving Commit Tracking

## The Problem

When bugs are introduced, it's hard to track down which commit caused them. This document outlines strategies to improve commit tracking and debugging.

## Current Issue: Notification Bug

**The Bug:** Notifications disappeared when cache expired in `type=all` endpoint.

**Root Cause:** Commit `b9b7cad` introduced `type=all` endpoint with expiration check that returned empty arrays. Commit `0b98765` fixed individual endpoints but missed `type=all`.

**Why It Was Hard to Find:**
- The bug was in a specific code path (`type=all`) that wasn't obvious
- The fix (`0b98765`) only partially addressed the issue
- No tests caught the regression

## Strategies to Improve Commit Tracking

### 1. Better Commit Messages

**Bad:**
```
FLASH25
Fix bug
Update code
```

**Good:**
```
Fix notification cache: return stale data for type=all endpoint

- Updated type=all endpoint to return stale cache data instead of empty arrays
- Matches behavior of individual cache endpoints (at-risk-accounts, neglected-accounts)
- Prevents notifications from disappearing when cache expires
- Related: commit 0b98765 (which fixed individual endpoints but missed this one)
```

**Template:**
```
<Action>: <What> <Why>

- <Specific change 1>
- <Specific change 2>
- <Related commits or context>
- <Breaking changes or migration notes>
```

### 2. Atomic Commits

**Problem:** One commit changes multiple unrelated things, making it hard to identify what broke.

**Solution:** 
- One logical change per commit
- If you must change multiple files, group related changes
- Use `git add -p` to stage specific hunks

**Example:**
```
# Bad: One commit with multiple changes
git commit -m "Fix notifications and add Gmail feature"

# Good: Separate commits
git commit -m "Fix notification cache expiration check"
git commit -m "Add Gmail connection button functionality"
```

### 3. Test Coverage

**Problem:** Bugs slip through because there are no tests.

**Solution:**
- Add unit tests for critical paths
- Add integration tests for API endpoints
- Test edge cases (expired cache, missing data, etc.)

**Example Test:**
```javascript
describe('Notification API - type=all', () => {
  it('should return stale data when cache is expired', async () => {
    // Set up expired cache
    // Call API
    // Assert stale data is returned, not empty array
  });
});
```

### 4. Code Review Checklist

Before merging, check:
- [ ] All code paths tested (including edge cases)
- [ ] Related endpoints updated consistently
- [ ] Error handling added
- [ ] Breaking changes documented
- [ ] Commit message explains what and why

### 5. Git Bisect for Finding Bugs

When a bug is discovered:

```bash
# Start bisect
git bisect start

# Mark current commit as bad
git bisect bad

# Mark a known good commit
git bisect good <commit-hash>

# Git will checkout middle commit
# Test the bug
git bisect bad  # if bug exists
git bisect good # if bug doesn't exist

# Repeat until git identifies the exact commit
```

### 6. Changelog/Release Notes

Keep a CHANGELOG.md that tracks:
- Breaking changes
- Bug fixes
- New features
- Known issues

**Example:**
```markdown
## [Unreleased]

### Fixed
- Notifications disappearing when cache expires (type=all endpoint)
  - Related: commit 0b98765 partially fixed this for individual endpoints
  - Fix: commit c0a3881

### Changed
- Gmail connection now checks for tokens from initial Google login
```

### 7. Branch Naming Conventions

Use descriptive branch names:
- `fix/notification-cache-expiration`
- `feature/gmail-oauth-integration`
- `refactor/notification-api-consistency`

### 8. Pre-commit Hooks

Add hooks to catch issues before commit:
- Linting
- Type checking
- Test running
- Commit message format checking

**Example `.husky/pre-commit`:**
```bash
#!/bin/sh
npm run lint
npm run type-check
npm run test
```

### 9. Post-mortem Documentation

When bugs are found, document:
- What broke
- Which commit introduced it
- Why it wasn't caught
- How to prevent similar issues

**Example:**
```markdown
# Bug: Notifications Disappearing

**Date:** 2026-01-07
**Commit:** b9b7cad (introduced), 0b98765 (partial fix), c0a3881 (complete fix)
**Impact:** High - users couldn't see notifications
**Root Cause:** Inconsistent cache expiration handling between endpoints
**Prevention:** Add integration tests for all API endpoints
```

### 10. Use Git Tags for Releases

Tag releases so you can easily identify what's in production:
```bash
git tag -a v1.2.3 -m "Release 1.2.3 - Gmail integration and notification fixes"
```

### 11. Automated Testing in CI/CD

Set up CI/CD to:
- Run tests on every commit
- Run tests on every PR
- Block merges if tests fail
- Run integration tests before deployment

### 12. Code Coverage Reports

Track which code paths are tested:
- Aim for >80% coverage on critical paths
- Use tools like `nyc` or `jest --coverage`
- Review coverage reports in PRs

## Quick Reference: Finding Bug Introductions

```bash
# Find when a specific line was added
git log -S "specific code pattern" -- path/to/file

# Find when a function was added
git log -S "functionName" -- path/to/file

# Find commits that touched a specific file
git log --oneline -- path/to/file

# Find commits by message
git log --grep="notification" --oneline

# Use bisect to find exact commit
git bisect start
git bisect bad
git bisect good <known-good-commit>
# Test and mark bad/good until found
```

## Action Items

1. ✅ Document this bug and its fix
2. ⬜ Add integration tests for notification API endpoints
3. ⬜ Set up pre-commit hooks for linting/testing
4. ⬜ Create CHANGELOG.md
5. ⬜ Review commit message quality in recent commits
6. ⬜ Set up CI/CD testing pipeline

