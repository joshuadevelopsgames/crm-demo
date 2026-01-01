# Supabase Keys Explained - CRITICAL DIFFERENCE

## ⚠️ IMPORTANT: These Are DIFFERENT Keys!

### 1. Anon Key (Public Key) - `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`
- **Purpose:** Client-side authentication and database access
- **Security:** Safe to expose in frontend code (it's public)
- **Permissions:** Limited by Row Level Security (RLS) policies
- **Where to get:** Supabase Dashboard → Settings → API → **"anon public"** key
- **Looks like:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eXVrYmFvZGd6eXZjY2Nwb2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNTMxMDMsImV4cCI6MjA4MjYyOTEwM30.GNmkjNpRkgBybQeh-8l7MWlC9XwNj0Tx_hcVnJnzlNY`
- **Role in JWT:** `"role": "anon"`

### 2. Service Role Key (Admin Key) - `SUPABASE_SERVICE_ROLE_KEY`
- **Purpose:** Server-side admin operations (bypasses RLS)
- **Security:** ⚠️ **MUST BE KEPT SECRET** - Never expose to frontend!
- **Permissions:** Full admin access, bypasses all RLS policies
- **Where to get:** Supabase Dashboard → Settings → API → **"service_role"** key
- **Looks like:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eXVrYmFvZGd6eXZjY2Nwb2puIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzA1MzEwMywiZXhwIjoyMDgyNjI5MTAzfQ.xxxxx` (different!)
- **Role in JWT:** `"role": "service_role"`

## 🔍 How to Check Which Key You Have

### Method 1: Decode the JWT
The keys are JWTs. You can decode them to see the role:

**For your anon key:**
```bash
# The key you showed: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eXVrYmFvZGd6eXZjY2Nwb2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNTMxMDMsImV4cCI6MjA4MjYyOTEwM30.GNmkjNpRkgBybQeh-8l7MWlC9XwNj0Tx_hcVnJnzlNY

# Decode the middle part (payload):
eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55eXVrYmFvZGd6eXZjY2Nwb2puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwNTMxMDMsImV4cCI6MjA4MjYyOTEwM30

# This decodes to:
{
  "iss": "supabase",
  "ref": "nyyukbaodgzyvcccpojn",
  "role": "anon",  ← THIS IS THE ANON KEY
  "iat": 1767053103,
  "exp": 2082629103
}
```

**If it's a service_role key, it would show:**
```json
{
  "role": "service_role"  ← THIS IS THE SERVICE ROLE KEY
}
```

### Method 2: Check in Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/nyyukbaodgzyvcccpojn
2. Navigate to: **Settings → API**
3. You'll see two keys:
   - **anon public** - This is your anon key (safe to expose)
   - **service_role** - This is your service role key (keep secret!)

## ⚠️ If They're The Same

**If `SUPABASE_SERVICE_ROLE_KEY` equals `VITE_SUPABASE_ANON_KEY`, this is WRONG and DANGEROUS!**

**Why it's dangerous:**
- Service role key bypasses all security (RLS)
- If exposed in frontend, anyone can access your entire database
- Can delete/modify any data without restrictions

**What to do:**
1. Get the correct service_role key from Supabase Dashboard
2. Update `SUPABASE_SERVICE_ROLE_KEY` in your `.env`
3. Make sure it's NEVER exposed in frontend code
4. Only use it in API routes (server-side)

## ✅ Correct Setup

```bash
# .env file

# Anon Key (Public - Safe to expose)
VITE_SUPABASE_ANON_KEY=eyJ... (role: "anon")
SUPABASE_ANON_KEY=eyJ... (same as above, role: "anon")

# Service Role Key (Secret - Never expose!)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (role: "service_role") ← DIFFERENT KEY!
```

## 🔍 Quick Check

Run this to decode and check your keys:

```bash
# Check anon key role
echo "YOUR_ANON_KEY" | cut -d'.' -f2 | base64 -d 2>/dev/null | grep -o '"role":"[^"]*"'

# Check service role key
echo "YOUR_SERVICE_ROLE_KEY" | cut -d'.' -f2 | base64 -d 2>/dev/null | grep -o '"role":"[^"]*"'
```

The anon key should show: `"role":"anon"`
The service role key should show: `"role":"service_role"`

