# Infra

One-time GCP infrastructure setup for Koppiku CMS media storage and CDN delivery.

## Prerequisites

- [gcloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated (`gcloud auth login`)
- A GCP project with billing enabled
- `roles/editor` or the following IAM permissions on the project:
  - `storage.buckets.create`
  - `iam.serviceAccounts.create`
  - `resourcemanager.projects.setIamPolicy`
  - `compute.backendBuckets.create`

## Setup

1. Copy `.env.example` and set your values:

   ```bash
   cp infra/.env.example .env
   # edit .env — set GCP_PROJECT_ID at minimum
   ```

2. Export the variables and run the script:

   ```bash
   export $(grep -v '^#' .env | xargs)
   bash infra/setup-gcs.sh
   ```

## What the script does

| Step | Action |
|------|--------|
| 1 | Creates a GCS bucket (`koppiku-media` by default) with uniform bucket-level access |
| 2 | Creates a `koppiku-cms-upload` service account with `roles/storage.objectCreator` |
| 3 | Exports the SA key to `infra/gcs-sa-key.json` |
| 4 | Creates a Cloud CDN-backed backend bucket (`koppiku-media-backend`) in front of the GCS bucket |

## After running

1. **Add the SA key to Supabase secrets** — the key at `infra/gcs-sa-key.json` must be added as the `GCS_SERVICE_ACCOUNT_KEY` secret in your Supabase project (Settings > Edge Functions > Secrets). The upload Edge Function uses this to sign GCS requests.

2. **Point your CDN domain** — create a URL map and HTTPS load balancer in GCP that routes to `koppiku-media-backend`, then point your `CDN_BASE_URL` DNS record at the load balancer IP.

3. **Delete the local key file** once the secret is stored:

   ```bash
   rm infra/gcs-sa-key.json
   ```

> `infra/gcs-sa-key.json` is gitignored and must never be committed.
