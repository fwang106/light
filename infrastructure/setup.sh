#!/bin/bash
# GCP Setup Script for Meeting Transcription App
# Run once to set up all required GCP resources
set -e

PROJECT_ID=${1:-$(gcloud config get-value project)}
REGION="us-central1"
SA_NAME="meeting-api-sa"

echo "Setting up project: $PROJECT_ID"

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  containerregistry.googleapis.com \
  firestore.googleapis.com \
  firebase.googleapis.com \
  --project=$PROJECT_ID

# Create service account for Cloud Run
gcloud iam service-accounts create $SA_NAME \
  --display-name="Meeting API Service Account" \
  --project=$PROJECT_ID || true

SA_EMAIL="$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

# Grant required permissions
for role in \
  roles/datastore.user \
  roles/storage.admin \
  roles/secretmanager.secretAccessor \
  roles/firebase.admin; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$role"
done

# Create secrets (values must be set manually)
for secret in openai-api-key anthropic-api-key; do
  gcloud secrets create $secret --project=$PROJECT_ID || true
  echo "Set $secret: gcloud secrets versions add $secret --data-file=-"
done

echo ""
echo "Setup complete. Next steps:"
echo "1. Set secret values: gcloud secrets versions add openai-api-key --data-file=-"
echo "2. Create Firebase project and enable Firestore + Storage"
echo "3. Copy .env.local.example to .env.local and fill in Firebase config"
echo "4. Run: gcloud builds submit --config=infrastructure/cloudbuild.yaml"
