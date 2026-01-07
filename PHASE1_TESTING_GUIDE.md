# Phase 1 Testing Guide

## Step 1: Test Gmail Sync

1. **Navigate to an Account Detail page** (any account with contacts)
2. **Go to the "Communication History" tab**
3. **Click "Connect Gmail"** (if not already connected)
4. **Click "Sync Now"** button

The sync will:
- Fetch emails from Gmail (last 30 days or since last sync)
- Match emails to contacts by email address
- Store messages in `gmail_messages` table
- Filter for business-related emails using keywords

## Step 2: Verify Sync Results

Check the browser console for:
- `📧 Fetching Gmail messages for user...`
- `📧 Fetched X messages from Gmail`
- Sync statistics (synced, skipped, errors)

## Step 3: Check Database

In Supabase SQL Editor, run:
```sql
SELECT 
  COUNT(*) as total_messages,
  COUNT(DISTINCT contact_id) as matched_contacts,
  COUNT(DISTINCT account_id) as matched_accounts,
  COUNT(*) FILTER (WHERE is_important = true) as important_emails
FROM gmail_messages
WHERE user_id = 'YOUR_USER_ID';
```

## What to Expect

- **Synced**: Number of new emails stored
- **Skipped**: Duplicate emails (already synced)
- **Errors**: Any issues during processing

## Next Steps After Testing

Once sync is working:
1. ✅ View synced emails in UI
2. ✅ Convert important emails to interactions (Phase 4)
3. ✅ Add AI analysis (Phase 3)

