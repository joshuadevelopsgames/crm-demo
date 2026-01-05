#!/bin/bash
# Push to production using merge (no rebase)

cd /Users/joshua/LECRM || exit 1

echo "Step 1: Stashing any uncommitted changes..."
git stash push -m "Auto-stash before production push $(date +%Y%m%d-%H%M%S)" --include-untracked

echo "Step 2: Fetching latest from production..."
git fetch production main

if [ $? -ne 0 ]; then
    echo "ERROR: Fetch failed"
    git stash pop 2>/dev/null || true
    exit 1
fi

echo "Step 3: Merging production/main into local main..."
git merge production/main --no-edit

MERGE_EXIT=$?

if [ $MERGE_EXIT -eq 0 ]; then
    echo "SUCCESS: Merge completed successfully"
    echo "Step 4: Pushing to production..."
    git push production main:main
    
    if [ $? -eq 0 ]; then
        echo "SUCCESS: Pushed to production"
        echo "Step 5: Restoring stashed changes..."
        git stash pop 2>/dev/null || true
        echo "Done!"
    else
        echo "ERROR: Push failed"
        git stash pop 2>/dev/null || true
        exit 1
    fi
elif [ $MERGE_EXIT -eq 1 ]; then
    echo "MERGE CONFLICTS: Please resolve conflicts manually"
    echo "Current status:"
    git status
    echo ""
    echo "To resolve:"
    echo "  1. Fix conflicts in the files listed above"
    echo "  2. git add <resolved-files>"
    echo "  3. git commit"
    echo "  4. git push production main:main"
    echo ""
    echo "To abort merge: git merge --abort"
    git stash pop 2>/dev/null || true
    exit 1
else
    echo "Merge exited with code: $MERGE_EXIT"
    git status
    git stash pop 2>/dev/null || true
    exit $MERGE_EXIT
fi


