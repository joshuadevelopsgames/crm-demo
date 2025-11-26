# Google Sheet Tab to CRM Mapping

This document shows where each tab from your Google Sheet maps to in the CRM system.

## ✅ Already Implemented

### 1. **Scorecard** Tab → `AccountDetail` → **Scoring** Tab
- **Location**: Account Detail page → Scoring tab
- **Entity**: `ScorecardResponse`
- **Parsed From**: "Scorecard" tab
- **Displays**:
  - Historical scorecard entries
  - Current organization score
  - Pass/Fail status
  - Section sub-totals
- **Status**: ✅ Fully integrated

### 2. **Sales Insights** Tab → `AccountDetail` → **Sales Insights** Tab
- **Location**: Account Detail page → Sales Insights tab
- **Entity**: `SalesInsight`
- **Parsed From**: "Sales Insights" tab
- **Displays**:
  - All sales insights for the account
  - Filter by insight type (opportunity, pain_point, risk, etc.)
  - Tags and related interactions
- **Status**: ✅ Fully integrated

### 3. **Company Contacts** Tab → Multiple Locations
- **Primary Location**: `AccountDetail` → **Contacts** Tab
- **Secondary Location**: `Contacts` page (all contacts)
- **Entity**: `Contact`
- **Parsed From**: "Company Contacts" tab
- **Also Creates**: `Account` records (extracted from contacts)
- **Displays**:
  - Contact information (name, email, phone, title)
  - Role, LinkedIn, preferences
  - Associated account
- **Status**: ✅ Fully integrated

### 4. **Research Notes** Tab → `AccountDetail` → **Research Notes** Tab
- **Location**: Account Detail page → Research Notes tab
- **Entity**: `ResearchNote`
- **Parsed From**: "Research Notes" tab
- **Displays**:
  - Research notes with source URLs
  - Filter by note type
  - Rich content support
- **Status**: ✅ Fully integrated

---

## ⚠️ Needs Implementation

### 5. **Contact Cadence** Tab → `Sequences` Page
- **Current Location**: `Sequences` page (`/sequences`)
- **Entity**: `Sequence` and `SequenceEnrollment`
- **Needs**: Parser function to read from "Contact Cadence" tab
- **Should Map**:
  - Cadence rules → `Sequence` with steps
  - Account-specific cadences → `SequenceEnrollment`
  - Different cadences for prospect/high-value/renewal → Different sequences
- **Status**: ⚠️ Structure exists, needs Google Sheets parser
- **Action Needed**: Add `parseContactCadence()` function

### 6. **Lookup Legend** Tab → Configuration/Reference Data
- **Current Location**: None (new feature needed)
- **Entity**: Could be `LookupValue` or configuration object
- **Needs**: New entity and parser
- **Should Map**:
  - Regions (e.g., "Calgary/Surrounding") → Dropdown options
  - Industries (e.g., "Retail, Industrial") → Dropdown options
  - Building Quality ("Good", "Fair", "Poor") → Dropdown options
  - Aesthetics ("Good", "Fair", "Poor") → Dropdown options
  - Any other reference/lookup values
- **Status**: ❌ Not implemented
- **Action Needed**: 
  - Create `LookupValue` entity
  - Add parser for "Lookup Legend" tab
  - Use in scorecard question options
  - Use in contact/account forms

---

## Summary Table

| Sheet Tab | CRM Location | Entity | Status | Parser Function |
|-----------|--------------|--------|--------|-----------------|
| **Scorecard** | AccountDetail → Scoring tab | `ScorecardResponse` | ✅ Done | `parseScorecards()` ✅ |
| **Sales Insights** | AccountDetail → Sales Insights tab | `SalesInsight` | ✅ Done | `parseSalesInsights()` ✅ |
| **Company Contacts** | AccountDetail → Contacts tab<br>+ Contacts page | `Contact`, `Account` | ✅ Done | `parseContacts()` ✅<br>`parseAccounts()` ✅ |
| **Research Notes** | AccountDetail → Research Notes tab | `ResearchNote` | ✅ Done | `parseResearchNotes()` ✅ |
| **Contact Cadence** | Sequences page | `Sequence`, `SequenceEnrollment` | ⚠️ Partial | `parseContactCadence()` ❌ |
| **Lookup Legend** | Configuration/Reference | `LookupValue` (new) | ❌ Not done | `parseLookupLegend()` ❌ |

---

## Next Steps

### Priority 1: Contact Cadence Parser
The Sequences feature exists but needs to read from your Google Sheet. We need to:
1. Understand the "Contact Cadence" tab structure
2. Create `parseContactCadence()` function
3. Map cadence rules to `Sequence` entities
4. Link accounts to sequences via `SequenceEnrollment`

### Priority 2: Lookup Legend System
Create a reference data system:
1. Create `LookupValue` entity schema
2. Create `parseLookupLegend()` function
3. Create configuration page/component to view/edit
4. Use lookup values in scorecard question options
5. Use lookup values in contact/account forms

---

## Questions to Clarify

1. **Contact Cadence Tab Structure**:
   - What columns does it have?
   - How are different cadences defined (prospect vs renewal)?
   - Is it account-specific or rule-based?

2. **Lookup Legend Tab Structure**:
   - What's the format? (Category | Key | Value?)
   - Which categories need to be lookup values?
   - Should these be editable in the CRM or only in the sheet?

3. **Accounts Tab**:
   - Do you have a dedicated "Accounts" tab, or should we extract accounts from "Company Contacts"?
   - (Currently extracting from contacts)





