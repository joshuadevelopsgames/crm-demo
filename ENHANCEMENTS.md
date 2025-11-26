# System Enhancements Based on Google Sheet Analysis

## Current vs. Desired State

### 1. **Enhanced Scorecard Structure** ⚠️ **HIGH PRIORITY**

**Current**: Simple weighted questions with flat structure
**Needed**: Category-based scorecard with sections and sub-totals

**From Google Sheet**:
- Sections like "Corporate Demographic Information", "Non-Negotiables", "Red Flags"
- Each section has sub-totals
- Questions grouped logically by category
- Total score with Pass/Fail thresholds (e.g., 25 = FAIL, 90 = PASS)

**Implementation**:
- Add `category` field to questions (already exists, but needs to be used for grouping)
- Display questions grouped by category/section
- Show sub-totals for each category
- Add `pass_threshold` to ScorecardTemplate entity (e.g., 70)
- Display Pass/Fail status on completed scorecards

### 2. **Historical Scorecard Tracking** ⚠️ **HIGH PRIORITY**

**From Google Sheet**: Multiple dated entries (Jan 1, 2025, Oct 2, 2025)

**Current**: Stores scorecard responses with dates
**Needed**: 
- View scorecard history timeline
- Compare scores over time
- Show score trends (improving/degrading)

### 3. **Sales Insights Page/Entity** ⚠️ **HIGH PRIORITY**

**From Google Sheet**: Separate "Sales Insights" tab

**Implementation**:
- New entity: `SalesInsight` with fields:
  - `account_id` (reference)
  - `insight_type` (e.g., "pain_point", "opportunity", "risk", "competitive_intel")
  - `title`
  - `content`
  - `tags` (array)
  - `recorded_by`
  - `recorded_date`
- New page: `SalesInsights` or integrate into AccountDetail as a tab
- Link insights to interactions for context

### 4. **Research Notes Page/Entity** ⚠️ **HIGH PRIORITY**

**From Google Sheet**: Separate "Research Notes" tab

**Implementation**:
- New entity: `ResearchNote` with fields:
  - `account_id` (reference)
  - `note_type` (e.g., "market_research", "company_info", "key_person", "industry_trends")
  - `title`
  - `content`
  - `source_url` (optional)
  - `recorded_by`
  - `recorded_date`
- New page: `ResearchNotes` or integrate into AccountDetail as a tab
- Rich text editor for formatting

### 5. **Contact Cadence Enhancement** ✅ **ALREADY EXISTS**

**From Google Sheet**: "Contact Cadence" tab

**Current**: Sequences with steps (email, call, LinkedIn, meeting)
**Status**: Already implemented! Just needs better UI to match spreadsheet view

**Enhancement**:
- Visual timeline view of cadence
- Show expected dates vs. actual dates
- Calendar view of scheduled interactions

### 6. **Lookup Legend/Reference Data** ⚠️ **MEDIUM PRIORITY**

**From Google Sheet**: "Lookup Legend" tab for reference values

**Implementation**:
- New entity: `LookupValue` or configuration system
- Fields: `category`, `key`, `value`, `display_order`
- Used for dropdowns and standardized values
- Examples from sheet:
  - Regions: "Calgary/Surrounding", etc.
  - Industries: "Retail, Industrial", etc.
  - Building Quality: "Good", "Fair", "Poor"
  - Aesthetics: "Good", "Fair", "Poor"

### 7. **Enhanced Scoring Logic** ⚠️ **HIGH PRIORITY**

**From Google Sheet**: Variable point values (not just weight × answer)

**Examples**:
- "Client Operations Region: Calgary/Surrounding" = 2 points (not 0/1)
- "Industry: Retail, Industrial" = 4 points
- "Located in Service Area: Yes" = 20 points

**Current**: Simple `answer × weight`
**Needed**: 
- Support multiple answer types with different scoring:
  - Yes/No questions
  - Multi-select (e.g., multiple industries)
  - Categorical (dropdown with point values)
  - Numeric ranges
- Add `scoring_rules` to questions:
  ```javascript
  {
    answer_type: "categorical",
    scoring_rules: {
      "Calgary/Surrounding": 2,
      "Edmonton": 1,
      "Other": 0
    }
  }
  ```

### 8. **Account Scoring Display** ⚠️ **MEDIUM PRIORITY**

**Enhancement**:
- Score history chart/graph
- Score breakdown by category
- Visual comparison to ideal score
- Score trends over time

### 9. **Company Contacts Enhancement** ✅ **MOSTLY DONE**

**From Google Sheet**: "Company Contacts" tab

**Current**: Contacts with roles, preferences, LinkedIn
**Enhancement**:
- Contact hierarchy/organization chart view
- Relationship mapping between contacts
- Contact engagement scores

## Recommended Implementation Order

1. **Phase 1**: Enhanced Scorecard Structure (categories, sub-totals, pass/fail)
2. **Phase 2**: Sales Insights & Research Notes entities and pages
3. **Phase 3**: Historical scorecard tracking and trends
4. **Phase 4**: Enhanced scoring logic (variable points, categorical)
5. **Phase 5**: Lookup legend/reference data system

## Entity Schema Updates Needed

### ScorecardTemplate
```javascript
{
  // ... existing fields
  pass_threshold: number,  // e.g., 70
  sections: [              // NEW: Explicit sections
    {
      section_name: string,
      order: number,
      questions: [question_ids]
    }
  ]
}
```

### Question (in template)
```javascript
{
  // ... existing fields
  category: string,        // Already exists, use for grouping
  scoring_type: "weighted" | "categorical" | "numeric_range",
  scoring_rules: {         // For categorical/numeric
    "option1": points,
    "option2": points
  },
  max_points: number       // For numeric ranges
}
```

### New: SalesInsight
```javascript
{
  account_id: string,
  insight_type: "pain_point" | "opportunity" | "risk" | "competitive_intel" | "other",
  title: string,
  content: string,
  tags: [string],
  recorded_by: string,
  recorded_date: date-time,
  related_interaction_id: string (optional)
}
```

### New: ResearchNote
```javascript
{
  account_id: string,
  note_type: "market_research" | "company_info" | "key_person" | "industry_trends" | "other",
  title: string,
  content: string,
  source_url: string (optional),
  recorded_by: string,
  recorded_date: date-time
}
```





