#!/usr/bin/env bash
# infra/setup-gcs.sh
# Run once: bash infra/setup-gcs.sh
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
BUCKET="${GCS_BUCKET_NAME:-koppiku-media}"
REGION="${GCS_REGION:-ASIA-SOUTHEAST1}"

echo "Creating GCS bucket $BUCKET in $REGION..."
if gcloud storage buckets describe "gs://$BUCKET" --project="$PROJECT_ID" &>/dev/null; then
  echo "Bucket gs://$BUCKET already exists, skipping."
else
  gcloud storage buckets create "gs://$BUCKET" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --uniform-bucket-level-access
fi

echo "Creating service account for uploads..."
if gcloud iam service-accounts describe "koppiku-cms-upload@$PROJECT_ID.iam.gserviceaccount.com" --project="$PROJECT_ID" &>/dev/null; then
  echo "Service account already exists, skipping."
else
  gcloud iam service-accounts create koppiku-cms-upload \
    --project="$PROJECT_ID" \
    --display-name="Koppiku CMS Upload"
fi

gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member="serviceAccount:koppiku-cms-upload@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectCreator"

gcloud iam service-accounts keys create "$SCRIPT_DIR/gcs-sa-key.json" \
  --iam-account="koppiku-cms-upload@$PROJECT_ID.iam.gserviceaccount.com"

echo "Enabling Cloud CDN..."
if gcloud compute backend-buckets describe koppiku-media-backend --project="$PROJECT_ID" &>/dev/null; then
  echo "Backend bucket already exists, skipping."
else
  gcloud compute backend-buckets create koppiku-media-backend \
    --gcs-bucket-name="$BUCKET" \
    --enable-cdn \
    --project="$PROJECT_ID"
fi

echo "Done. SA key written to $SCRIPT_DIR/gcs-sa-key.json — add to Supabase secrets."
