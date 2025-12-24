# Vercel Deploy Hook Setup

## Quick Deploy Script

Use the included `deploy.sh` script to trigger a deployment:

```bash
./deploy.sh
```

Or use Vercel CLI directly:

```bash
npx vercel --prod --yes
```

## Setting Up a Deploy Hook (Optional)

A deploy hook is a URL you can call to trigger deployments programmatically.

### Step 1: Create Deploy Hook in Vercel Dashboard

1. Go to **Vercel Dashboard**: https://vercel.com/dashboard
2. Click on your project (e.g., `lecrm-dev`)
3. Go to **Settings** → **Git**
4. Scroll down to **Deploy Hooks** section
5. Click **"Create Hook"**
6. Configure:
   - **Name**: `Production Deploy` (or any name)
   - **Branch**: `main`
   - **Production**: ✅ (check this for production deployments)
7. Click **"Create Hook"**
8. Copy the hook URL (looks like: `https://api.vercel.com/v1/integrations/deploy/...`)

### Step 2: Use the Deploy Hook

You can trigger a deployment by calling the hook URL:

```bash
# Using curl
curl -X POST "YOUR_DEPLOY_HOOK_URL"

# Or using the script
curl -X POST "YOUR_DEPLOY_HOOK_URL" && echo "Deployment triggered!"
```

### Step 3: Add to GitHub Actions (Optional)

You can also add the deploy hook to GitHub Actions to trigger deployments automatically:

```yaml
name: Deploy to Vercel
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Vercel Deployment
        run: |
          curl -X POST "${{ secrets.VERCEL_DEPLOY_HOOK }}"
```

## Current Deployment Status

After running the deploy script, check:
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Deployments Tab**: See the latest deployment status
- **Production URL**: https://lecrm-dev.vercel.app

## Troubleshooting

If deployment doesn't show up:
1. Check Vercel dashboard for build errors
2. Verify you're on the `main` branch
3. Check that the project is linked correctly: `npx vercel link`
4. Try redeploying from the dashboard manually

