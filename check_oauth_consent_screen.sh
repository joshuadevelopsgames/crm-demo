#!/bin/bash
# Script to check OAuth 2.0 Consent Screen (not IAP) for lecrm-478811
# This is the correct API for OAuth consent screen configuration

export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"

PROJECT_ID="lecrm-478811"

echo "=========================================="
echo "Checking OAuth 2.0 Consent Screen Status"
echo "Project: $PROJECT_ID"
echo "=========================================="
echo ""

echo "=== 1. Checking IAM Permissions ==="
gcloud projects get-iam-policy $PROJECT_ID --format="value(bindings[].members,bindings[].role)" | grep -E "user:|roles/(owner|editor|oauthconfig)" | head -20
echo ""

echo "=== 2. Checking Enabled APIs ==="
echo "Looking for Identity and Access Management API..."
gcloud services list --enabled --project=$PROJECT_ID --filter="name:iam OR name:oauth2" --format="table(service.name,service.title)"
echo ""

echo "=== 3. Enabling Required APIs ==="
echo "Enabling Identity and Access Management API (if not already enabled)..."
gcloud services enable iam.googleapis.com --project=$PROJECT_ID 2>&1
gcloud services enable oauth2.googleapis.com --project=$PROJECT_ID 2>&1
echo ""

echo "=== 4. Direct URL to OAuth Consent Screen ==="
echo "Try opening this URL in your browser:"
echo "https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
echo ""

echo "=== 5. Alternative: Try Creating OAuth Client ==="
echo "If consent screen is configured, you should be able to create OAuth credentials:"
echo "https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo ""

echo "=== 6. Checking if Project is in Organization ==="
ORG_ID=$(gcloud projects describe $PROJECT_ID --format="value(parent.id)" 2>/dev/null)
if [ -n "$ORG_ID" ] && [ "$ORG_ID" != "" ]; then
    echo "Project belongs to organization: $ORG_ID"
else
    echo "Project does NOT belong to an organization (personal project)"
    echo "This is fine for OAuth consent screen - personal projects can use OAuth 2.0"
fi
echo ""

echo "=========================================="
echo "Next Steps:"
echo "1. Try the direct URL above"
echo "2. If that redirects, try creating OAuth credentials (Method 5)"
echo "3. If consent screen isn't configured, you'll see a prompt to configure it"
echo "=========================================="


