# Pre-Push Hook

The pre-push hook (`.git/hooks/pre-push`) performs two checks:

## 1. Duplicate Line Checking

- Checks all files being pushed for duplicate lines
- Skips empty lines and whitespace-only lines
- Skips binary files
- Reports duplicate lines with line numbers and content
- **Blocks push if duplicates are found**

## 2. Branch Creation Protection

- Prevents accidental branch creation in non-interactive mode
- Prompts for confirmation when creating new branches interactively

## Installation

The hook is automatically installed when you clone the repository. To manually install or update:

```bash
# Copy the hook from this repo
cp .git/hooks/pre-push /path/to/other/repo/.git/hooks/pre-push
chmod +x /path/to/other/repo/.git/hooks/pre-push
```

Or use the install script:
```bash
./scripts/install-production-hook.sh
```

Note: The install script may need to be updated to include duplicate checking functionality.
