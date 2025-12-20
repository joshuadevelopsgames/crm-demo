# Manual Deployment to Vercel

It looks like automatic deployments aren't triggering. Here's how to manually deploy:

## Option 1: Through Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Login to your account

2. **Find Your Project:**
   - Click on "lecrm" project

3. **Trigger Deployment:**
   - Click the "Deployments" tab
   - Click "Redeploy" button on the latest deployment
   - OR click "Deploy" button to create a new deployment

4. **Wait for Build:**
   - Watch the build logs
   - Wait for "Ready" status (1-2 minutes)

5. **Test Your URL:**
   - Visit: `https://lecrm.vercel.app/win-loss-test`

## Option 2: Install Vercel CLI and Deploy

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (will use existing project settings)
cd /Users/joshua/LECRM
vercel --prod

# Follow the prompts
# It will detect the existing .vercel configuration
```

## Option 3: Use Local Version (Immediate)

While waiting for deployment, you can use the local version right now:

1. **Make sure dev server is running:**
   ```bash
   npm run dev
   ```

2. **Open in browser:**
   ```
   http://localhost:5173/win-loss-test
   ```

3. **Upload your CSV and use it immediately!**

## Why Might Auto-Deploy Not Work?

Possible reasons:
- ❌ Vercel GitHub integration might be disconnected
- ❌ Repository webhook might be disabled
- ❌ Build might be failing (check Vercel dashboard logs)
- ❌ Project settings might need updating

## Fix Auto-Deploy

1. **Go to Vercel Dashboard** → Settings
2. **Check Git Integration:**
   - Make sure GitHub is connected
   - Verify the correct repository is linked
3. **Check Build Settings:**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

## Quick Fix: Reconnect GitHub

1. **Vercel Dashboard** → Your Project
2. **Settings** → **Git**
3. Click "Disconnect" then "Connect Git Repository"
4. Select your GitHub repo again
5. Save settings

This should re-enable automatic deployments on every push!

## Immediate Solution

**Use the local version right now:**
```
http://localhost:5173/win-loss-test
```

Your local dev server (already running) has the exact same functionality as the deployed version will have!














