# Workflow Notes

## Git Remote Configuration

- **`dev`** → `LECRM-dev` repository (for `lecrm-dev.vercel.app`)
- **`staging`** → `LECRM-staging` repository (for `lecrm-stg.vercel.app`)
- **`production`** → `LECRM` repository (for `lecrm.vercel.app`)

## Push Commands

When you say "push to dev", that means:
```bash
git push dev main
```
This pushes the current `main` branch to the `LECRM-dev` repository's `main` branch.

## Standard Workflow

1. **Work locally on `main` branch**
2. **Push to dev**: `git push dev main` (deploys to `lecrm-dev.vercel.app`)
3. **Push to staging**: `git push staging main` (deploys to `lecrm-stg.vercel.app`)
4. **Push to production**: `git push production main` (deploys to `lecrm.vercel.app`)

## Important Notes

- All repositories use `main` as the primary branch
- `lecrm-dev.vercel.app` should deploy from `LECRM-dev` repository's `main` branch
- When pushing to dev, always push to `main` branch: `git push dev main`

