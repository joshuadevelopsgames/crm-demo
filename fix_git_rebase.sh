#!/bin/bash
# Fix script to properly handle git pull with rebase

cd /Users/joshua/LECRM || exit 1

echo "Step 1: Checking git status..."
git status --short

echo "Step 2: Stashing all changes (including debug.log)..."
git stash push -m "Auto-stash before rebase $(date +%Y%m%d-%H%M%S)" --include-untracked

echo "Step 3: Fetching from production..."
git fetch production main

if [ $? -ne 0 ]; then
    echo "ERROR: Fetch failed"
    git stash pop 2>/dev/null || true
    exit 1
fi

echo "Step 4: FETCH_HEAD created successfully"
echo "Step 5: Starting rebase (this may take a while with 1143 commits)..."

# Use GIT_EDITOR=true to avoid interactive prompts
GIT_EDITOR=true git rebase production/main

REBASE_EXIT=$?

if [ $REBASE_EXIT -eq 0 ]; then
    echo "SUCCESS: Rebase completed successfully"
    echo "Step 6: Restoring stashed changes..."
    git stash pop 2>/dev/null || true
    echo "Done!"
elif [ $REBASE_EXIT -eq 1 ]; then
    echo "ERROR: Rebase failed (likely conflicts or errors)"
    echo "Current status:"
    git status
    echo "To continue: git rebase --continue"
    echo "To abort: git rebase --abort"
else
    echo "Rebase exited with code: $REBASE_EXIT"
    git status
fi

exit $REBASE_EXIT


