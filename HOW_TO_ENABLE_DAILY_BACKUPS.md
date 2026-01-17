# How to Enable Daily Backups in Supabase

## Quick Answer

**Daily backups are automatically included on Supabase Pro plan ($25/month) or higher.**

---

## Step-by-Step: Check & Enable Daily Backups

### Step 1: Check Your Current Plan

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Sign in to your account

2. **Select Your Project**
   - Click on your project (e.g., `nyyukbaodgzyvcccpojn`)

3. **Check Your Plan**
   - Go to **Settings** → **Billing** (or **Project Settings** → **Billing**)
   - Look for your current plan:
     - **Free** = No automatic backups
     - **Pro** ($25/month) = Daily backups included ✅
     - **Team** = Daily backups + more features

### Step 2: Verify Backup Status

1. **Go to Database → Backups**
   - In your Supabase project dashboard
   - Navigate to: **Database** → **Backups** (in left sidebar)

2. **Check What You See**:
   - **If you see "Daily backups" section** → ✅ You have daily backups!
   - **If you see "No backups available"** → ❌ You need to upgrade

3. **Look for**:
   - List of recent backups (should show daily backups)
   - Backup dates and times
   - "Restore" buttons next to each backup

### Step 3: Enable Daily Backups (If Not Already Enabled)

#### Option A: Upgrade to Pro Plan (Recommended)

1. **Go to Settings → Billing**
   - In your Supabase project dashboard

2. **Click "Upgrade to Pro"** or **"Change Plan"**

3. **Select Pro Plan**
   - Cost: $25/month
   - Includes:
     - ✅ Daily automatic backups
     - ✅ 7-day backup retention
     - ✅ Point-in-Time Recovery (PITR) option
     - ✅ More database storage
     - ✅ Better performance

4. **Complete Payment**
   - Enter payment information
   - Daily backups will start automatically within 24 hours

#### Option B: Enable Point-in-Time Recovery (PITR) - Maximum Protection

**PITR provides even better protection** (requires Pro plan):

1. **Go to Database → Backups**
2. **Click "Enable Point-in-Time Recovery"**
3. **Review costs** (additional fee, but worth it for critical data)
4. **Confirm activation**

**What PITR gives you**:
- Recover to any point in time (not just daily snapshots)
- Can recover from accidental deletions minutes ago
- Maximum data protection

---

## Verify Daily Backups Are Working

### Check Backup Status

1. **Go to Database → Backups**
2. **Look for**:
   - ✅ Recent backups listed (should see backups from last 7 days)
   - ✅ Backup timestamps (should be daily)
   - ✅ Backup sizes shown
   - ✅ "Restore" button available

### Test a Backup

1. **Click on a recent backup**
2. **Click "Restore"** (or "Create Restore Point")
3. **Verify** you can see restore options
   - You don't need to actually restore, just verify the option exists

### Monitor Backup Health

**Check regularly** (weekly):
- Go to **Database → Backups**
- Verify new backups appear daily
- Check backup sizes (should be consistent)
- Look for any error messages

---

## What Each Plan Includes

### Free Tier
- ❌ No automatic backups
- ✅ Manual backups only
- ✅ You can create backups manually anytime
- **Cost**: $0/month

### Pro Plan ($25/month)
- ✅ **Daily automatic backups**
- ✅ 7-day backup retention
- ✅ Point-in-Time Recovery (PITR) available (extra cost)
- ✅ More storage and better performance
- **Cost**: $25/month

### Team Plan
- ✅ Daily automatic backups
- ✅ Configurable backup retention
- ✅ Point-in-Time Recovery included
- ✅ More features
- **Cost**: Custom pricing

---

## Quick Checklist

- [ ] Check current Supabase plan (Settings → Billing)
- [ ] Verify backup status (Database → Backups)
- [ ] Upgrade to Pro if on Free tier
- [ ] Enable PITR for maximum protection (optional but recommended)
- [ ] Verify backups are running (check daily for first week)
- [ ] Set calendar reminder to check backups monthly

---

## Troubleshooting

### "I don't see Daily Backups option"

**Possible reasons**:
1. **You're on Free tier** → Upgrade to Pro plan
2. **Backups just started** → Wait 24 hours after upgrading
3. **Wrong project** → Make sure you're in the correct Supabase project

### "Backups aren't appearing daily"

**Check**:
1. Verify you're on Pro plan or higher
2. Check if there are any errors in Supabase dashboard
3. Contact Supabase support if backups don't appear after 48 hours

### "I want backups but can't afford Pro plan"

**Alternatives**:
1. **Use manual backups** (free):
   - Create backups weekly using the script: `scripts/backup-database.sh`
   - Store in cloud storage (S3, Google Cloud, etc.)
   - See `DATABASE_BACKUP_GUIDE.md` for details

2. **Consider the cost**:
   - $25/month = $0.83/day for daily backups
   - Much cheaper than losing data!

---

## Next Steps After Enabling

1. ✅ **Verify backups are running** (check daily for first week)
2. ✅ **Test a restore** (make sure backups actually work)
3. ✅ **Set up monitoring** (check backups monthly)
4. ✅ **Document recovery procedure** (know how to restore if needed)
5. ✅ **Consider PITR** (for maximum protection)

---

## Cost Breakdown

**Pro Plan**: $25/month
- Daily backups: Included
- 7-day retention: Included
- PITR: Additional cost (varies)

**Value**: 
- Protects all your data
- Automatic (no manual work)
- Peace of mind
- Much cheaper than data loss!

---

## Summary

**To get daily backups**:
1. ✅ Upgrade to Supabase Pro plan ($25/month)
2. ✅ Daily backups start automatically
3. ✅ Verify in Database → Backups section
4. ✅ Optional: Enable PITR for maximum protection

**Current status check**:
- Go to: https://supabase.com/dashboard
- Select your project
- Go to: **Database → Backups**
- If you see daily backups listed → ✅ You're protected!
- If not → Upgrade to Pro plan
