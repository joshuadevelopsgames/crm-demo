# Push to GitHub - Quick Guide

## Option 1: Using GitHub CLI (if installed)

If you have GitHub CLI (`gh`) installed:

```bash
gh repo create LECRM --public --source=. --remote=origin --push
```

Or for a private repo:

```bash
gh repo create LECRM --private --source=. --remote=origin --push
```

## Option 2: Manual GitHub Setup

### Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `LECRM` (or your preferred name)
3. Choose Public or Private
4. **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"

### Step 2: Add Remote and Push

After creating the repo, GitHub will show you commands. Use these:

```bash
# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/LECRM.git

# Or if using SSH:
git remote add origin git@github.com:YOUR_USERNAME/LECRM.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Verify

Check your GitHub repo - all your code should be there!

## What's Included

✅ All source code (React, components, pages, services)
✅ Configuration files (package.json, vite.config.js, etc.)
✅ Documentation (all .md files)
✅ Mobile app setup (iOS & Android projects)
✅ .gitignore configured to exclude:
   - node_modules/
   - dist/ and build/
   - .env files (sensitive data)
   - iOS/Android build artifacts
   - IDE files

## After Pushing

Once pushed to GitHub, you can:

1. **Clone on other machines:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/LECRM.git
   cd LECRM
   npm install
   npm run cap:sync
   ```

2. **Deploy easily:**
   - Connect to deployment services (Vercel, Netlify, etc.)
   - Share with team members
   - Track changes and versions

3. **Xcode Integration:**
   - Xcode can work with git repos
   - Your team can clone and open directly in Xcode
   - Changes are tracked and versioned

## Important Notes

⚠️ **Sensitive Data**: Make sure `.env` files are in `.gitignore` (they are!)
⚠️ **API Keys**: Never commit API keys or secrets to GitHub
✅ **Build Files**: `dist/` and build artifacts are excluded (they're generated)

## Next Steps After Push

1. Set up GitHub Actions for CI/CD (optional)
2. Add deployment workflows
3. Set up branch protection (for production)
4. Add collaborators if working with a team

