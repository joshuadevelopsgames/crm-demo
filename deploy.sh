#!/bin/bash

# Deploy script for LECRM
# This script triggers a production deployment to Vercel

echo "🚀 Deploying to Vercel production..."

# Deploy using Vercel CLI
npx vercel --prod --yes

echo "✅ Deployment triggered!"
echo "📊 Check deployment status at: https://vercel.com/dashboard"

