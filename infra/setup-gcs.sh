#!/usr/bin/env bash
# infra/setup-gcs.sh
# Run once: bash infra/setup-gcs.sh
set -e

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
BUCKET="${GCS_BUCKET_NAME:-koppiku-media}"
REGION="${GCS_REGION:-ASIA-SOUTHEAST1}"

echo "Creating GCS bucket $BUCKET in $REGION..."
gcloud storage buckets create "gs://$BUCKET" \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --uniform-bucket-level-access

echo "Creating service account for uploads..."
gcloud iam service-accounts create koppiku-cms-upload \
  --project="$PROJECT_ID" \
  --display-name="Koppiku CMS Upload"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:koppiku-cms-upload@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectCreator"

gcloud iam service-accounts keys create infra/gcs-sa-key.json \
  --iam-account="koppiku-cms-upload@$PROJECT_ID.iam.gserviceaccount.com"

echo "Enabling Cloud CDN..."
gcloud compute backend-buckets create koppiku-media-backend \
  --gcs-bucket-name="$BUCKET" \
  --enable-cdn \
  --project="$PROJECT_ID"

echo "Done. SA key written to infra/gcs-sa-key.json — add to Supabase secrets."
