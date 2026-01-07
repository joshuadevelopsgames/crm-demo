# Gmail Email Tracking System

## Overview

This system automatically tracks emails between users and contacts, identifies important client communications, and logs them as interactions in the CRM.

## Core Functionality

### 1. Email Detection & Filtering

**Goal**: Identify sales/important client communications, excluding marketing emails and spam.

**Process**:
- Monitor Gmail inbox for new emails
- Filter emails based on:
  - **Sender**: Must be from a contact in the CRM (matched by email address)
  - **Recipient**: Must be to a user's Gmail account that's connected
  - **Content Analysis**: Use AI to determine if email is:
    - Business/client communication (important)
    - Marketing/promotional (exclude)
    - Automated/system emails (exclude)
    - Personal/non-business (exclude)

**AI Analysis Criteria**:
- Check for business keywords (quotes, proposals, contracts, meetings, follow-ups)
- Analyze tone and context
- Check for signatures, company information
- Identify if it's a reply to a previous business email
- Check email headers (reply-to, in-reply-to) to link conversation threads

### 2. Contact Matching

**Process**:
- Extract sender email address from Gmail message
- Match against `contacts` table by `email` field
- If match found:
  - Get associated `account_id` from contact
  - Link email to that account
- If no match:
  - Optionally create new contact (with user approval)
  - Or flag for manual review

**Example**:
```
Email from: cvassell@royop.com
→ Find contact with email = "cvassell@royop.com"
→ Get contact.account_id
→ Link email to that account
```

### 3. Email Threading & Tracking

**Process**:
- Track all emails in a conversation thread
- Link emails by:
  - Gmail thread ID
  - In-Reply-To header
  - References header
- Store email metadata:
  - Subject
  - Sender/Recipient
  - Timestamp
  - Thread ID
  - Message ID
  - Snippet/preview
  - Full body (optional, for important emails)

### 4. Interaction Logging

**Process**:
- For each important email identified:
  - Create interaction record in `interactions` table
  - Link to account via contact's `account_id`
  - Link to contact via contact's `id`
  - Link to user via Gmail account owner
  - Store:
    - Type: "email"
    - Direction: "inbound" or "outbound"
    - Subject
    - Snippet/preview
    - Timestamp
    - Gmail message ID (for reference)
    - Thread ID (to link related emails)

## Technical Implementation

### Database Schema

**New Table: `gmail_messages`**
```sql
CREATE TABLE gmail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  gmail_thread_id text,
  contact_id uuid REFERENCES contacts(id),
  account_id uuid REFERENCES accounts(id),
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject text,
  snippet text,
  body text,
  sender_email text NOT NULL,
  recipient_email text NOT NULL,
  received_at timestamptz NOT NULL,
  is_important boolean DEFAULT false,
  ai_analysis jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, gmail_message_id)
);

CREATE INDEX idx_gmail_messages_user_id ON gmail_messages(user_id);
CREATE INDEX idx_gmail_messages_contact_id ON gmail_messages(contact_id);
CREATE INDEX idx_gmail_messages_account_id ON gmail_messages(account_id);
CREATE INDEX idx_gmail_messages_thread_id ON gmail_messages(gmail_thread_id);
CREATE INDEX idx_gmail_messages_received_at ON gmail_messages(received_at);
```

**Update `interactions` table** (if needed):
- Add `gmail_message_id` field to link to Gmail message
- Add `gmail_thread_id` to link conversation threads

### API Endpoints

**`/api/gmail/sync`** - Sync emails from Gmail
- Fetches new emails since last sync
- Processes and stores important emails
- Returns sync statistics

**`/api/gmail/analyze`** - AI analysis endpoint
- Takes email content
- Returns importance score and classification
- Uses AI service (OpenAI, Anthropic, etc.)

**`/api/gmail/messages`** - Get emails for an account/contact
- Returns email history for a specific account or contact
- Includes threading information

### Gmail API Integration

**Required Scopes**:
- `https://www.googleapis.com/auth/gmail.readonly` (already requested)

**API Calls**:
1. **List Messages**: `GET /gmail/v1/users/me/messages`
   - Query: `from:contact@example.com` or `to:user@example.com`
   - Get message IDs

2. **Get Message**: `GET /gmail/v1/users/me/messages/{id}`
   - Get full message details
   - Extract headers, body, thread ID

3. **List Threads**: `GET /gmail/v1/users/me/threads`
   - Get conversation threads

### Sync Process

**Background Job** (Vercel Cron or similar):
1. For each user with Gmail connected:
   - Get last sync timestamp from `gmail_integrations.last_sync`
   - Query Gmail API for messages since last sync
   - Process each message:
     - Extract sender/recipient
     - Match to contact
     - Analyze importance (AI)
     - If important: create interaction log
   - Update `last_sync` timestamp

**Manual Sync**:
- User clicks "Sync Now" button
- Triggers same process immediately
- Shows progress and results

### AI Analysis Service

**Options**:
1. **OpenAI GPT-4** - Best for understanding context
2. **Anthropic Claude** - Good for email analysis
3. **Google Gemini** - Cost-effective
4. **Local model** - Privacy-focused

**Prompt Example**:
```
Analyze this email and determine if it's an important business/client communication:

From: {sender}
To: {recipient}
Subject: {subject}
Body: {body}

Consider:
- Is this a sales/client communication?
- Is this marketing/promotional?
- Is this automated/system generated?
- Is this personal/non-business?

Return JSON:
{
  "is_important": boolean,
  "confidence": 0-1,
  "category": "business" | "marketing" | "automated" | "personal",
  "reasoning": "explanation"
}
```

## User Flow

1. **User connects Gmail** (already implemented)
2. **System syncs emails** (background job or manual)
3. **System identifies important emails** from contacts
4. **System creates interaction logs** automatically
5. **User views interactions** on account detail page

## Future Enhancements

1. **Email Templates**: Track which templates users send
2. **Response Time Tracking**: Measure time to respond
3. **Email Analytics**: Track email volume, response rates
4. **Smart Notifications**: Alert on important emails
5. **Email Search**: Search emails by account/contact
6. **Email Threading UI**: Show full conversation threads
7. **Auto-tagging**: Tag emails by account, project, etc.

## Security & Privacy

- Gmail tokens stored securely in Supabase (encrypted at rest)
- Only sync emails from/to connected user's account
- Respect Gmail API rate limits
- Store minimal email content (snippets, not full bodies unless important)
- Allow users to disconnect and delete stored emails
- Comply with GDPR/privacy regulations

## Implementation Phases

### Phase 1: Basic Email Sync ✅ COMPLETE
- [x] Create `gmail_messages` table
- [x] Implement Gmail API message fetching
- [x] Store messages in database
- [x] Manual sync button
- [x] Contact matching by email address
- [x] Simple keyword-based filtering (no AI)

### Phase 2: Contact Matching
- [ ] Match emails to contacts by email address
- [ ] Link emails to accounts via contacts
- [ ] Handle unmatched emails

### Phase 3: AI Analysis
- [ ] Integrate AI service
- [ ] Analyze email importance
- [ ] Filter out non-business emails

### Phase 4: Interaction Logging
- [ ] Create interactions from important emails
- [ ] Link to accounts and contacts
- [ ] Display in account detail page

### Phase 5: Threading & Advanced Features
- [ ] Email threading
- [ ] Conversation view
- [ ] Analytics and reporting

