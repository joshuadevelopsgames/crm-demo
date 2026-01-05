#!/bin/bash
# Debug script to trace git operations and identify where it stops

LOG_FILE="/Users/joshua/LECRM/.cursor/debug.log"
SESSION_ID="debug-session-$(date +%s)"
RUN_ID="run1"

log_event() {
    local location="$1"
    local message="$2"
    local data="$3"
    local hypothesis_id="$4"
    
    local timestamp=$(date +%s%3N)
    local log_entry=$(cat <<EOF
{"id":"log_${timestamp}_$$","timestamp":${timestamp},"location":"${location}","message":"${message}","data":${data},"sessionId":"${SESSION_ID}","runId":"${RUN_ID}","hypothesisId":"${hypothesis_id}"}
EOF
)
    echo "$log_entry" >> "$LOG_FILE"
}

cd /Users/joshua/LECRM || exit 1

# Stash any changes to test rebase without interference
git stash -q 2>/dev/null || true

log_event "debug_git.sh:start" "Starting git debug session" "{\"pwd\":\"$(pwd)\"}" "ALL"

# Hypothesis A: Git fetch completes but rebase hangs waiting for input
log_event "debug_git.sh:before_fetch" "About to fetch from production" "{\"remote\":\"production\",\"branch\":\"main\"}" "A"
git fetch production main 2>&1 | while IFS= read -r line; do
    log_event "debug_git.sh:fetch_output" "Fetch output line" "{\"line\":\"${line}\"}" "A"
done
FETCH_EXIT=$?
log_event "debug_git.sh:after_fetch" "Fetch completed" "{\"exit_code\":${FETCH_EXIT}}" "A"

# Hypothesis B: FETCH_HEAD file exists but rebase fails to read it
if [ -f .git/FETCH_HEAD ]; then
    FETCH_HEAD_CONTENT=$(head -1 .git/FETCH_HEAD 2>/dev/null || echo "read_failed")
    log_event "debug_git.sh:fetch_head_exists" "FETCH_HEAD file exists" "{\"first_line\":\"${FETCH_HEAD_CONTENT:0:100}\"}" "B"
else
    log_event "debug_git.sh:fetch_head_missing" "FETCH_HEAD file missing" "{}" "B"
fi

# Hypothesis C: Rebase hangs due to large number of commits
COMMIT_COUNT=$(git rev-list --count HEAD ^production/main 2>/dev/null || echo "unknown")
log_event "debug_git.sh:commit_count" "Local commits ahead" "{\"count\":\"${COMMIT_COUNT}\"}" "C"

# Hypothesis D: Rebase stops waiting for merge conflict resolution
log_event "debug_git.sh:before_rebase" "About to start rebase" "{\"onto\":\"production/main\"}" "D"
# Use gtimeout if available (macOS via brew), otherwise run directly with background process
if command -v gtimeout >/dev/null 2>&1; then
    gtimeout 10 git rebase production/main 2>&1 | while IFS= read -r line; do
        log_event "debug_git.sh:rebase_output" "Rebase output line" "{\"line\":\"${line}\"}" "D"
    done
    REBASE_EXIT=$?
    log_event "debug_git.sh:after_rebase" "Rebase attempt completed" "{\"exit_code\":${REBASE_EXIT},\"timeout\":10}" "D"
else
    # Run rebase in background and kill after 10 seconds
    (git rebase production/main 2>&1 | while IFS= read -r line; do
        log_event "debug_git.sh:rebase_output" "Rebase output line" "{\"line\":\"${line}\"}" "D"
    done) &
    REBASE_PID=$!
    sleep 10
    if kill -0 $REBASE_PID 2>/dev/null; then
        log_event "debug_git.sh:rebase_hanging" "Rebase still running after 10s, killing" "{\"pid\":${REBASE_PID}}" "D"
        kill $REBASE_PID 2>/dev/null
        REBASE_EXIT=124
    else
        wait $REBASE_PID
        REBASE_EXIT=$?
    fi
    log_event "debug_git.sh:after_rebase" "Rebase attempt completed" "{\"exit_code\":${REBASE_EXIT},\"timeout\":10}" "D"
fi

# Hypothesis E: Rebase state directory causes issues
if [ -d .git/rebase-merge ]; then
    REBASE_STATE=$(ls -la .git/rebase-merge 2>/dev/null | head -5 || echo "list_failed")
    log_event "debug_git.sh:rebase_state_exists" "Rebase state directory exists" "{\"contents\":\"${REBASE_STATE}\"}" "E"
fi

log_event "debug_git.sh:end" "Git debug session complete" "{\"final_status\":\"done\"}" "ALL"

