# Setting Up Environment Variables for Estimates Comparison

## Quick Setup (Recommended)

Run the setup script:

```bash
./setup_env_vars.sh
```

This will guide you through getting your Supabase service role key and setting up the environment variables.

---

## Manual Setup

### Step 1: Get Your Supabase Service Role Key

1. **Go to your Supabase Dashboard:**
   - https://supabase.com/dashboard/project/vtnaqheddlvnlcgwwssc/settings/api

2. **Find the "service_role" key:**
   - Scroll down to "Project API keys"
   - Find the row with "service_role" in the "Name" column
   - Click the "Reveal" button (eye icon) to show the key
   - Copy the entire key (it's a long string starting with `eyJ...`)

   ⚠️ **Important:** The service_role key has admin access. Keep it secret and never commit it to git!

### Step 2: Set Environment Variables

You have two options:

#### Option A: Set for Current Terminal Session (Temporary)

```bash
export SUPABASE_URL="https://vtnaqheddlvnlcgwwssc.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

Then run:
```bash
npm run compare:estimates
```

**Note:** These will only work in this terminal window. Close the terminal and you'll need to set them again.

#### Option B: Add to Your Shell Profile (Permanent)

Add these lines to your `~/.zshrc` (or `~/.bash_profile` if using bash):

```bash
# Supabase environment variables for LECRM
export SUPABASE_URL="https://vtnaqheddlvnlcgwwssc.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

Then reload your profile:
```bash
source ~/.zshrc
```

Or just restart your terminal.

Now you can run the comparison script anytime:
```bash
npm run compare:estimates
```

---

## Verify Setup

To check if your environment variables are set:

```bash
echo $SUPABASE_URL
echo $SUPABASE_SERVICE_ROLE_KEY
```

You should see:
- First command: `https://vtnaqheddlvnlcgwwssc.supabase.co`
- Second command: Your service role key (long string)

---

## Troubleshooting

### "Missing environment variables" error

Make sure you've:
1. Set both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
2. Exported them (using `export` command)
3. Run the command in the same terminal session where you set them

### "File not found" error for Excel file

Make sure `Estimates List.xlsx` is in your Downloads folder:
- macOS: `/Users/joshua/Downloads/Estimates List.xlsx`
- The script will automatically find it there

### "Permission denied" error

If you get a permission error when running `./setup_env_vars.sh`:
```bash
chmod +x setup_env_vars.sh
```

---

## Security Note

⚠️ **Never commit your service role key to git!**

The `.env` file (if you create one) should be in `.gitignore` and never committed. The service role key has full admin access to your database.

