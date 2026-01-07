#!/bin/bash
# Script to check OAuth consent screen status for lecrm-478811
# Run this in your terminal where you've already authenticated with gcloud

export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"

PROJECT_ID="lecrm-478811"

echo "=========================================="
echo "Checking OAuth Consent Screen Status"
echo "Project: $PROJECT_ID"
echo "=========================================="
echo ""

echo "=== 1. Checking IAM Permissions ==="
gcloud projects get-iam-policy $PROJECT_ID --format=json | jq -r '.bindings[] | select(.members[] | contains("user:")) | "\(.role): \(.members | join(", "))"' 2>/dev/null || gcloud projects get-iam-policy $PROJECT_ID --format=json
echo ""

echo "=== 2. Checking Enabled APIs ==="
gcloud services list --enabled --project=$PROJECT_ID --format="table(service.name,service.title)" 2>&1
echo ""

echo "=== 3. Attempting to check OAuth consent screen ==="
echo "Trying to access OAuth consent screen configuration..."
gcloud alpha iap oauth-brands list --project=$PROJECT_ID 2>&1 || echo "Note: OAuth brands command may require additional setup"
echo ""

echo "=== 4. Checking OAuth Clients ==="
gcloud alpha iap oauth-clients list --project=$PROJECT_ID 2>&1 || echo "No OAuth clients found or command not available"
echo ""

echo "=== 5. Direct URL to try ==="
echo "Open this URL in your browser:"
echo "https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
echo ""

echo "=========================================="
echo "If you see permission errors above, you may need:"
echo "  gcloud projects add-iam-policy-binding $PROJECT_ID \\"
echo "    --member=user:YOUR_EMAIL@example.com \\"
echo "    --role=roles/oauthconfig.editor"
echo "=========================================="

