# Status Columns and Edge Cases

## Columns Being Read

### CSV Parser (`src/utils/csvParser.js`)
Reading from CSV file columns:
- **"Status"** column → `row['Status']`
- **"Sales Pipeline Status"** column → `row['Sales Pipeline Status']`
- **"Division"** column → `row['Division']` (for department categorization)

### LMN Parser (`src/utils/lmnEstimatesListParser.js`)
Reading from LMN Estimates List CSV columns:
- **"Status"** column → `row[colMap.status]` (maps to 'Status' header)
- **"Sales Pipeline Status"** column → `row[colMap.salesPipelineStatus]` (maps to 'Sales Pipeline Status' header)
- **"Division"** column → `row[colMap.division]` (maps to 'Division' header)

## Currently Handled Statuses (Approved)

### Won Statuses
- Email Contract Award
- Verbal Contract Award
- Work Complete
- Work In Progress
- Billing Complete
- Contract Signed

### Lost Statuses
- Estimate In Progress - Lost
- Review + Approve - Lost
- Client Proposal Phase - Lost
- Estimate Lost
- Estimate On Hold
- Estimate Lost - No Reply
- Estimate Lost - Price too high

## Edge Cases Found (Need Your Approval)

These statuses were found in testing but **NOT** currently handled explicitly. They fall back to pattern matching or default behavior:

### Potentially Should Be WON
- "Contract Awarded" → Currently: **won** (pattern match: contains "contract award")
- "Proposal Accepted" → Currently: **lost** (no match, defaults to lost)
- "Quote Accepted" → Currently: **lost** (no match, defaults to lost)
- "Estimate Accepted" → Currently: **lost** (no match, defaults to lost)
- "Approved" → Currently: **lost** (no match, defaults to lost)
- "Completed" → Currently: **lost** (no match, defaults to lost)

### Potentially Should Be LOST
- "Estimate Rejected" → Currently: **lost** (pattern match: contains "lost" via default)
- "Estimate Cancelled" → Currently: **lost** (pattern match: contains "lost" via default)
- "Estimate Withdrawn" → Currently: **lost** (pattern match: contains "lost" via default)
- "Estimate Expired" → Currently: **lost** (pattern match: contains "lost" via default)
- "Client Declined" → Currently: **lost** (pattern match: contains "lost" via default)
- "Project Cancelled" → Currently: **lost** (pattern match: contains "lost" via default)
- "Rejected" → Currently: **lost** (pattern match: contains "lost" via default)
- "Cancelled" → Currently: **lost** (pattern match: contains "lost" via default)

### Ambiguous Statuses
- "Contract Signed - Pending" → Currently: **won** (contains "contract signed")
- "Work In Progress - On Hold" → Currently: **won** (contains "work in progress")
- "Billing In Progress" → Currently: **lost** (contains "in progress")

## Questions for You

1. **Should "Accepted" statuses be won?**
   - Proposal Accepted
   - Quote Accepted
   - Estimate Accepted

2. **Should "Approved" be won?**

3. **Should "Completed" be won?** (if it means work is done)

4. **Should "Contract Awarded" be explicitly handled?** (currently works via pattern match)

5. **How should ambiguous statuses be handled?**
   - "Contract Signed - Pending" (signed but not final?)
   - "Work In Progress - On Hold" (work started but paused?)

6. **Are there any other status values in your LMN data that aren't in the list above?**

## Current Behavior

- **Pattern matching fallback**: If status contains "contract signed", "contract award", "sold", etc. → won
- **Pattern matching fallback**: If status contains "lost", "on hold" → lost
- **Default**: Everything else → lost (no pending option)

## Next Steps

Please review the edge cases above and let me know:
1. Which ones should be explicitly added as won?
2. Which ones should be explicitly added as lost?
3. How to handle ambiguous statuses?
4. Any other status values from your actual data that need handling?

