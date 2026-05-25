# Koppiku CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cloud-based digital signage CMS for Koppiku outlets — HQ uploads content, builds playlists, schedules them per outlet; Android TV browsers display them in real time.

**Architecture:** Turborepo monorepo with two apps (`cms` = Next.js 14 admin panel, `tv-player` = React Vite PWA) and a `shared` types package. Supabase handles DB, Auth, and Realtime push to TVs. GCS + Cloud CDN serves media files.

**Tech Stack:** Next.js 14 App Router · Vite + React 18 · Supabase JS v2 · Tailwind + shadcn/ui · @dnd-kit/core · Workbox · Vitest + Testing Library · Playwright

---

## Task 1: Monorepo scaffold

**Files:**
- Create: `package.json` (root)
- Create: `turbo.json`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `.gitignore` (update)

- [ ] **Step 1: Install Turborepo and init workspaces**

```bash
cd /Users/aaronfoo/koppiku-cms
npm init -y
npm install turbo --save-dev
```

- [ ] **Step 2: Write root `package.json`**

```json
{
  "name": "koppiku-cms",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "latest",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 3: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "test": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

- [ ] **Step 4: Scaffold `packages/shared`**

```bash
mkdir -p packages/shared/src
```

```json
// packages/shared/package.json
{
  "name": "@koppiku/shared",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": { "test": "vitest run" },
  "devDependencies": {
    "vitest": "^1.6.0",
    "typescript": "^5.4.0"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.43.0"
  }
}
```

```json
// packages/shared/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true
  }
}
```

- [ ] **Step 5: Scaffold app directories**

```bash
mkdir -p apps/cms apps/tv-player supabase/migrations supabase/functions infra
```

- [ ] **Step 6: Update `.gitignore`**

```
node_modules
.next
dist
.env
.env.local
.env*.local
.turbo
.superpowers/
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: monorepo scaffold with Turborepo"
```

---

## Task 2: Shared TypeScript types + Supabase client

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/supabase.ts`
- Create: `packages/shared/src/schedule.ts`
- Create: `packages/shared/src/schedule.test.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Write database types**

```typescript
// packages/shared/src/types.ts
export type Outlet = {
  id: string
  name: string
  region: string
  timezone: string
  created_at: string
}

export type DeviceStatus = 'pending' | 'active'

export type Device = {
  id: string
  outlet_id: string | null
  name: string | null
  pairing_code: string
  status: DeviceStatus
  last_seen: string | null
  ua: string | null
}

export type MediaType = 'image' | 'video'

export type Media = {
  id: string
  name: string
  type: MediaType
  mime_type: string
  gcs_url: string
  cdn_url: string
  thumbnail_url: string | null
  duration_s: number | null
  size_bytes: number
  uploaded_by: string
  created_at: string
}

export type PlaylistStatus = 'draft' | 'published'

export type Playlist = {
  id: string
  name: string
  status: PlaylistStatus
  created_by: string
  created_at: string
  updated_at: string
}

export type PlaylistItem = {
  id: string
  playlist_id: string
  media_id: string
  sequence: number
  display_duration_s: number | null
  media?: Media
}

export type Schedule = {
  id: string
  playlist_id: string
  outlet_id: string | null
  start_time: string
  end_time: string
  days_of_week: number[]
  active_from: string
  active_until: string | null
  priority: number
  playlist?: Playlist
}

export type PlaybackLog = {
  id: string
  device_id: string
  playlist_id: string
  media_id: string
  played_at: string
  duration_s: number
}
```

- [ ] **Step 2: Write Supabase client factory**

```typescript
// packages/shared/src/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function createSupabaseClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
}
```

- [ ] **Step 3: Write schedule resolution utility**

```typescript
// packages/shared/src/schedule.ts
import type { Schedule } from './types'

// Returns the highest-priority schedule active right now for a given outlet.
// outletId=null schedules (nationwide) are always considered.
export function resolveActiveSchedule(
  schedules: Schedule[],
  outletId: string,
  nowMY: Date  // must be in Asia/Kuala_Lumpur time
): Schedule | null {
  const dayOfWeek = nowMY.getDay()
  const currentTime = `${String(nowMY.getHours()).padStart(2, '0')}:${String(nowMY.getMinutes()).padStart(2, '0')}`
  const today = nowMY.toISOString().slice(0, 10)

  const active = schedules.filter((s) => {
    const forThisOutlet = s.outlet_id === null || s.outlet_id === outletId
    const dayMatches = s.days_of_week.length === 0 || s.days_of_week.includes(dayOfWeek)
    const timeMatches = currentTime >= s.start_time && currentTime < s.end_time
    const dateMatches = today >= s.active_from && (s.active_until === null || today <= s.active_until)
    return forThisOutlet && dayMatches && timeMatches && dateMatches
  })

  if (active.length === 0) return null
  return active.sort((a, b) => b.priority - a.priority)[0]
}

export function nowInMalaysia(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }))
}
```

- [ ] **Step 4: Write failing tests for schedule resolution**

```typescript
// packages/shared/src/schedule.test.ts
import { describe, it, expect } from 'vitest'
import { resolveActiveSchedule } from './schedule'
import type { Schedule } from './types'

const base: Schedule = {
  id: '1', playlist_id: 'p1', outlet_id: 'o1',
  start_time: '07:00', end_time: '11:00',
  days_of_week: [], active_from: '2026-01-01', active_until: null, priority: 1,
}

function makeDate(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date('2026-05-25T00:00:00') // Sunday = 0
  d.setHours(h, m, 0, 0)
  return d
}

describe('resolveActiveSchedule', () => {
  it('returns schedule when time is within window', () => {
    const result = resolveActiveSchedule([base], 'o1', makeDate('08:00'))
    expect(result?.id).toBe('1')
  })

  it('returns null before start_time', () => {
    const result = resolveActiveSchedule([base], 'o1', makeDate('06:59'))
    expect(result).toBeNull()
  })

  it('returns null at end_time (exclusive)', () => {
    const result = resolveActiveSchedule([base], 'o1', makeDate('11:00'))
    expect(result).toBeNull()
  })

  it('null outlet_id applies to all outlets', () => {
    const nationwide = { ...base, outlet_id: null }
    const result = resolveActiveSchedule([nationwide], 'any-outlet', makeDate('08:00'))
    expect(result?.id).toBe('1')
  })

  it('returns highest priority when two schedules overlap', () => {
    const low = { ...base, id: 'low', priority: 1 }
    const high = { ...base, id: 'high', priority: 10 }
    const result = resolveActiveSchedule([low, high], 'o1', makeDate('08:00'))
    expect(result?.id).toBe('high')
  })

  it('filters by day_of_week when set', () => {
    const weekdays = { ...base, days_of_week: [1, 2, 3, 4, 5] } // Mon-Fri
    // makeDate uses 2026-05-25 = Sunday = 0
    const result = resolveActiveSchedule([weekdays], 'o1', makeDate('08:00'))
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 5: Run tests — expect FAIL**

```bash
cd packages/shared && npx vitest run
```

Expected: `resolveActiveSchedule is not a function` or test failures.

- [ ] **Step 6: Verify tests pass after implementation**

```bash
cd packages/shared && npx vitest run
```

Expected: 6 tests pass.

- [ ] **Step 7: Write `index.ts` exports**

```typescript
// packages/shared/src/index.ts
export * from './types'
export * from './supabase'
export * from './schedule'
```

- [ ] **Step 8: Commit**

```bash
git add packages/
git commit -m "feat: shared types, supabase client, schedule resolver"
```

---

## Task 3: Supabase schema + RLS

**Files:**
- Create: `supabase/migrations/001_schema.sql`
- Create: `supabase/migrations/002_rls.sql`
- Create: `supabase/seed.sql`

- [ ] **Step 1: Install Supabase CLI**

```bash
npm install supabase --save-dev
npx supabase init
npx supabase start
```

Expected: Local Supabase running at http://localhost:54321. Note the `anon` and `service_role` keys printed.

- [ ] **Step 2: Write schema migration**

```sql
-- supabase/migrations/001_schema.sql
create extension if not exists "uuid-ossp";

create table outlets (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  region text not null default '',
  timezone text not null default 'Asia/Kuala_Lumpur',
  created_at timestamptz not null default now()
);

create table devices (
  id uuid primary key default uuid_generate_v4(),
  outlet_id uuid references outlets(id) on delete set null,
  name text,
  pairing_code text not null,
  pairing_code_expires_at timestamptz not null default (now() + interval '10 minutes'),
  status text not null default 'pending' check (status in ('pending','active')),
  last_seen timestamptz,
  ua text
);

create table media (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('image','video')),
  mime_type text not null,
  gcs_url text not null,
  cdn_url text not null,
  thumbnail_url text,
  duration_s int,
  size_bytes bigint not null default 0,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table playlists (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  status text not null default 'draft' check (status in ('draft','published')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table playlist_items (
  id uuid primary key default uuid_generate_v4(),
  playlist_id uuid not null references playlists(id) on delete cascade,
  media_id uuid not null references media(id) on delete cascade,
  sequence int not null,
  display_duration_s int
);

create table schedules (
  id uuid primary key default uuid_generate_v4(),
  playlist_id uuid not null references playlists(id) on delete cascade,
  outlet_id uuid references outlets(id) on delete cascade,
  start_time time not null,
  end_time time not null,
  days_of_week int[] not null default '{}',
  active_from date not null default current_date,
  active_until date,
  priority int not null default 1
);

create table playback_logs (
  id uuid primary key default uuid_generate_v4(),
  device_id uuid references devices(id) on delete set null,
  playlist_id uuid references playlists(id) on delete set null,
  media_id uuid references media(id) on delete set null,
  played_at timestamptz not null default now(),
  duration_s int not null
);

-- Updated_at trigger for playlists
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger playlists_updated_at before update on playlists
  for each row execute function update_updated_at();
```

- [ ] **Step 3: Write RLS policies**

```sql
-- supabase/migrations/002_rls.sql

-- Enable RLS on all tables
alter table outlets enable row level security;
alter table devices enable row level security;
alter table media enable row level security;
alter table playlists enable row level security;
alter table playlist_items enable row level security;
alter table schedules enable row level security;
alter table playback_logs enable row level security;

-- Authenticated users (HQ) can do everything
create policy "auth full access" on outlets for all to authenticated using (true) with check (true);
create policy "auth full access" on devices for all to authenticated using (true) with check (true);
create policy "auth full access" on media for all to authenticated using (true) with check (true);
create policy "auth full access" on playlists for all to authenticated using (true) with check (true);
create policy "auth full access" on playlist_items for all to authenticated using (true) with check (true);
create policy "auth full access" on schedules for all to authenticated using (true) with check (true);
create policy "auth full access" on playback_logs for all to authenticated using (true) with check (true);

-- Anon (TV player) can read active playlists and write heartbeat/logs
create policy "anon read devices" on devices for select to anon using (true);
create policy "anon update device last_seen" on devices for update to anon
  using (true) with check (true);
create policy "anon read outlets" on outlets for select to anon using (true);
create policy "anon read media" on media for select to anon using (true);
create policy "anon read playlists" on playlists for select to anon
  using (status = 'published');
create policy "anon read playlist_items" on playlist_items for select to anon using (true);
create policy "anon read schedules" on schedules for select to anon using (true);
create policy "anon insert playback_logs" on playback_logs for insert to anon with check (true);
create policy "anon insert devices" on devices for insert to anon with check (true);
```

- [ ] **Step 4: Write seed data**

```sql
-- supabase/seed.sql
insert into outlets (id, name, region) values
  ('00000000-0000-0000-0000-000000000001', 'Koppiku Bangsar', 'KL'),
  ('00000000-0000-0000-0000-000000000002', 'Koppiku KLCC', 'KL'),
  ('00000000-0000-0000-0000-000000000003', 'Koppiku Melaka Central', 'Melaka');
```

- [ ] **Step 5: Apply migrations**

```bash
npx supabase db reset
```

Expected: `Finished supabase db reset` — all migrations applied, seed loaded.

- [ ] **Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: supabase schema, RLS policies, seed data"
```

---

## Task 4: GCS bucket + Cloud CDN setup

**Files:**
- Create: `infra/setup-gcs.sh`
- Create: `infra/.env.example`

- [ ] **Step 1: Write setup script**

```bash
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
```

- [ ] **Step 2: Write `.env.example`**

```bash
# infra/.env.example
GCP_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=koppiku-media
GCS_REGION=ASIA-SOUTHEAST1
CDN_BASE_URL=https://cdn.koppiku.com
```

- [ ] **Step 3: Add `gcs-sa-key.json` to `.gitignore`**

Add `infra/gcs-sa-key.json` to `.gitignore`.

- [ ] **Step 4: Commit**

```bash
git add infra/ .gitignore
git commit -m "feat: GCS bucket + CDN setup script"
```

---

## Task 5: Edge Function — upload

**Files:**
- Create: `supabase/functions/upload/index.ts`

- [ ] **Step 1: Set Supabase secrets for GCS**

```bash
npx supabase secrets set GCS_BUCKET=koppiku-media
npx supabase secrets set GCS_SA_KEY="$(cat infra/gcs-sa-key.json)"
npx supabase secrets set CDN_BASE_URL=https://cdn.koppiku.com
```

- [ ] **Step 2: Write the upload Edge Function**

```typescript
// supabase/functions/upload/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-file-name, x-file-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Verify auth
  const auth = req.headers.get('authorization')
  if (!auth) return new Response('Unauthorized', { status: 401 })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.replace('Bearer ', ''))
  if (authErr || !user) return new Response('Unauthorized', { status: 401 })

  const fileName = req.headers.get('x-file-name') ?? 'upload'
  const mimeType = req.headers.get('x-file-type') ?? 'application/octet-stream'
  const mediaType = mimeType.startsWith('video/') ? 'video' : 'image'
  const objectKey = `${crypto.randomUUID()}-${fileName}`
  const bucket = Deno.env.get('GCS_BUCKET')!
  const cdnBase = Deno.env.get('CDN_BASE_URL')!

  // Upload to GCS using service account
  const saKey = JSON.parse(Deno.env.get('GCS_SA_KEY')!)
  const token = await getGCSToken(saKey)

  const body = await req.arrayBuffer()
  const sizeBytes = body.byteLength

  const gcsRes = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(objectKey)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': mimeType }, body },
  )
  if (!gcsRes.ok) return new Response('GCS upload failed', { status: 502 })

  const gcsUrl = `gs://${bucket}/${objectKey}`
  const cdnUrl = `${cdnBase}/${objectKey}`

  // Insert media row
  const { data: media, error: dbErr } = await supabase.from('media').insert({
    name: fileName,
    type: mediaType,
    mime_type: mimeType,
    gcs_url: gcsUrl,
    cdn_url: cdnUrl,
    size_bytes: sizeBytes,
    uploaded_by: user.id,
  }).select().single()

  if (dbErr) return new Response(JSON.stringify({ error: dbErr.message }), { status: 500 })

  return new Response(JSON.stringify(media), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

async function getGCSToken(sa: Record<string, string>): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = btoa(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.read_write',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }))
  // Use Deno's built-in crypto to sign — requires importing the private key
  const keyData = sa.private_key.replace(/-----.*?-----/g, '').replace(/\s/g, '')
  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(`${header}.${payload}`),
  )
  const jwt = `${header}.${payload}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const { access_token } = await res.json()
  return access_token
}
```

- [ ] **Step 3: Deploy and smoke test**

```bash
npx supabase functions deploy upload --no-verify-jwt
# Test with a small image
curl -X POST http://localhost:54321/functions/v1/upload \
  -H "authorization: Bearer <your-session-jwt>" \
  -H "x-file-name: test.jpg" \
  -H "x-file-type: image/jpeg" \
  --data-binary @/path/to/test.jpg
```

Expected: JSON with `id`, `cdn_url`, `type: "image"`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/upload/
git commit -m "feat: upload edge function — GCS proxy + media row insert"
```

---

## Task 6: Edge Function — pair-device

**Files:**
- Create: `supabase/functions/pair-device/index.ts`

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/pair-device/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const auth = req.headers.get('authorization')
  const { data: { user }, error } = await supabase.auth.getUser(auth?.replace('Bearer ', '') ?? '')
  if (error || !user) return new Response('Unauthorized', { status: 401 })

  const { pairing_code, outlet_id, device_name } = await req.json() as {
    pairing_code: string
    outlet_id: string
    device_name?: string
  }

  // Find pending device with matching code that hasn't expired
  const { data: device, error: findErr } = await supabase
    .from('devices')
    .select('*')
    .eq('pairing_code', pairing_code)
    .eq('status', 'pending')
    .gt('pairing_code_expires_at', new Date().toISOString())
    .single()

  if (findErr || !device) {
    return new Response(JSON.stringify({ error: 'Invalid or expired pairing code' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { data: updated, error: updateErr } = await supabase
    .from('devices')
    .update({ outlet_id, status: 'active', name: device_name ?? 'Screen' })
    .eq('id', device.id)
    .select()
    .single()

  if (updateErr) return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 })

  return new Response(JSON.stringify(updated), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Deploy**

```bash
npx supabase functions deploy pair-device
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/pair-device/
git commit -m "feat: pair-device edge function"
```

---

## Task 7: Edge Functions — heartbeat + resolve-schedule

**Files:**
- Create: `supabase/functions/heartbeat/index.ts`
- Create: `supabase/functions/resolve-schedule/index.ts`

- [ ] **Step 1: Write heartbeat function**

```typescript
// supabase/functions/heartbeat/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { device_id } = await req.json() as { device_id: string }
  await supabase.from('devices').update({ last_seen: new Date().toISOString() }).eq('id', device_id)
  return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
})
```

- [ ] **Step 2: Write resolve-schedule function**

```typescript
// supabase/functions/resolve-schedule/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)

  const url = new URL(req.url)
  const outletId = url.searchParams.get('outlet_id')
  if (!outletId) return new Response('Missing outlet_id', { status: 400 })

  // Fetch all schedules for this outlet (+ nationwide ones)
  const { data: schedules } = await supabase
    .from('schedules')
    .select('*, playlist:playlists(*)')
    .or(`outlet_id.eq.${outletId},outlet_id.is.null`)
    .eq('playlists.status', 'published')

  // Current Malaysia time
  const nowMY = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }))
  const dayOfWeek = nowMY.getDay()
  const currentTime = `${String(nowMY.getHours()).padStart(2, '0')}:${String(nowMY.getMinutes()).padStart(2, '0')}`
  const today = nowMY.toISOString().slice(0, 10)

  const active = (schedules ?? []).filter((s: any) => {
    const dayOk = !s.days_of_week?.length || s.days_of_week.includes(dayOfWeek)
    const timeOk = currentTime >= s.start_time && currentTime < s.end_time
    const dateOk = today >= s.active_from && (!s.active_until || today <= s.active_until)
    return dayOk && timeOk && dateOk
  }).sort((a: any, b: any) => b.priority - a.priority)

  if (!active.length) return new Response(JSON.stringify({ schedule: null, items: [] }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

  const schedule = active[0]
  const { data: items } = await supabase
    .from('playlist_items')
    .select('*, media(*)')
    .eq('playlist_id', schedule.playlist_id)
    .order('sequence')

  return new Response(JSON.stringify({ schedule, items: items ?? [] }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 3: Deploy both**

```bash
npx supabase functions deploy heartbeat
npx supabase functions deploy resolve-schedule
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/
git commit -m "feat: heartbeat and resolve-schedule edge functions"
```

---

## Task 8: CMS app — scaffold, auth, layout

**Files:**
- Create: `apps/cms/` (Next.js 14 app)
- Create: `apps/cms/middleware.ts`
- Create: `apps/cms/lib/supabase/client.ts`
- Create: `apps/cms/lib/supabase/server.ts`
- Create: `apps/cms/app/login/page.tsx`
- Create: `apps/cms/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create Next.js app**

```bash
cd apps
npx create-next-app@latest cms --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
cd cms
npm install @supabase/supabase-js @supabase/ssr @koppiku/shared
```

- [ ] **Step 2: Write `.env.local`**

```bash
# apps/cms/.env.local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-local-service-role-key>
```

- [ ] **Step 3: Write Supabase browser client**

```typescript
// apps/cms/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 4: Write Supabase server client**

```typescript
// apps/cms/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  )
}
```

- [ ] **Step 5: Write auth middleware**

```typescript
// apps/cms/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
```

- [ ] **Step 6: Write login page**

```typescript
// apps/cms/app/login/page.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); return }
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Koppiku CMS</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm" required
        />
        <input
          type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm" required
        />
        <button type="submit" className="w-full bg-amber-600 text-white py-2 rounded-lg font-medium hover:bg-amber-700">
          Sign in
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 7: Write dashboard layout with nav**

```typescript
// apps/cms/app/(dashboard)/layout.tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const nav = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/media', label: 'Media' },
  { href: '/playlists', label: 'Playlists' },
  { href: '/schedules', label: 'Schedules' },
  { href: '/outlets', label: 'Outlets' },
  { href: '/devices', label: 'Devices' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 bg-amber-900 text-white flex flex-col">
        <div className="p-4 font-bold text-lg border-b border-amber-800">Koppiku CMS</div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ href, label }) => (
            <Link key={href} href={href}
              className="block px-3 py-2 rounded-lg text-sm hover:bg-amber-800 transition">
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 text-xs text-amber-300">{user.email}</div>
      </aside>
      <main className="flex-1 p-6 bg-gray-50">{children}</main>
    </div>
  )
}
```

- [ ] **Step 8: Run dev server and verify login works**

```bash
cd apps/cms && npm run dev
```

Open http://localhost:3000 — should redirect to `/login`. Sign in with a Supabase test account. Should land on `/dashboard`.

- [ ] **Step 9: Commit**

```bash
git add apps/cms/
git commit -m "feat: CMS scaffold — Next.js 14, auth, layout"
```

---

## Task 9: CMS — outlets page

**Files:**
- Create: `apps/cms/app/(dashboard)/outlets/page.tsx`
- Create: `apps/cms/app/(dashboard)/outlets/actions.ts`

- [ ] **Step 1: Write server actions**

```typescript
// apps/cms/app/(dashboard)/outlets/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Outlet } from '@koppiku/shared'

export async function createOutlet(formData: FormData) {
  const supabase = createClient()
  const name = formData.get('name') as string
  const region = formData.get('region') as string
  await supabase.from('outlets').insert({ name, region })
  revalidatePath('/outlets')
}

export async function deleteOutlet(id: string) {
  const supabase = createClient()
  await supabase.from('outlets').delete().eq('id', id)
  revalidatePath('/outlets')
}
```

- [ ] **Step 2: Write outlets page**

```typescript
// apps/cms/app/(dashboard)/outlets/page.tsx
import { createClient } from '@/lib/supabase/server'
import { createOutlet, deleteOutlet } from './actions'
import type { Outlet } from '@koppiku/shared'

export default async function OutletsPage() {
  const supabase = createClient()
  const { data: outlets } = await supabase.from('outlets').select('*').order('name') as { data: Outlet[] }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Outlets</h1>
      </div>

      <form action={createOutlet} className="flex gap-3 bg-white p-4 rounded-xl shadow-sm">
        <input name="name" placeholder="Outlet name" required
          className="flex-1 border rounded-lg px-3 py-2 text-sm" />
        <input name="region" placeholder="Region (e.g. KL)" required
          className="w-32 border rounded-lg px-3 py-2 text-sm" />
        <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          Add Outlet
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {(outlets ?? []).map((outlet) => (
          <div key={outlet.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-sm">{outlet.name}</p>
              <p className="text-xs text-gray-500">{outlet.region}</p>
            </div>
            <form action={deleteOutlet.bind(null, outlet.id)}>
              <button type="submit" className="text-xs text-red-500 hover:underline">Delete</button>
            </form>
          </div>
        ))}
        {!outlets?.length && <p className="px-4 py-6 text-sm text-gray-400">No outlets yet.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify manually**

Navigate to http://localhost:3000/outlets. Create an outlet. Verify it appears in the list. Delete it.

- [ ] **Step 4: Commit**

```bash
git add apps/cms/app/\(dashboard\)/outlets/
git commit -m "feat: CMS outlets page — create and delete outlets"
```

---

## Task 10: CMS — media library

**Files:**
- Create: `apps/cms/app/(dashboard)/media/page.tsx`
- Create: `apps/cms/app/(dashboard)/media/upload-zone.tsx`
- Create: `apps/cms/app/(dashboard)/media/media-grid.tsx`
- Create: `apps/cms/app/(dashboard)/media/upload-zone.test.tsx`

- [ ] **Step 1: Install test deps**

```bash
cd apps/cms
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Write failing test for UploadZone**

```typescript
// apps/cms/app/(dashboard)/media/upload-zone.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { UploadZone } from './upload-zone'

describe('UploadZone', () => {
  it('calls onFiles with selected files', () => {
    const onFiles = vi.fn()
    render(<UploadZone onFiles={onFiles} uploading={false} />)
    const input = screen.getByTestId('file-input')
    const file = new File(['hello'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [file] } })
    expect(onFiles).toHaveBeenCalledWith([file])
  })

  it('shows uploading state', () => {
    render(<UploadZone onFiles={vi.fn()} uploading={true} />)
    expect(screen.getByText(/uploading/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
cd apps/cms && npx vitest run
```

Expected: `Cannot find module './upload-zone'`

- [ ] **Step 4: Write UploadZone component**

```typescript
// apps/cms/app/(dashboard)/media/upload-zone.tsx
'use client'
import { useRef } from 'react'

interface Props { onFiles: (files: File[]) => void; uploading: boolean }

export function UploadZone({ onFiles, uploading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) onFiles(Array.from(e.target.files))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.type.startsWith('image/') || f.type.startsWith('video/')
    )
    if (files.length) onFiles(files)
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-amber-400 transition"
    >
      <input
        ref={inputRef}
        data-testid="file-input"
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleChange}
      />
      {uploading ? (
        <p className="text-sm text-gray-500">Uploading...</p>
      ) : (
        <p className="text-sm text-gray-500">Drop images or videos here, or click to browse</p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd apps/cms && npx vitest run
```

Expected: 2 tests pass.

- [ ] **Step 6: Write MediaGrid component**

```typescript
// apps/cms/app/(dashboard)/media/media-grid.tsx
'use client'
import type { Media } from '@koppiku/shared'

interface Props { items: Media[]; onDelete: (id: string) => void }

export function MediaGrid({ items, onDelete }: Props) {
  if (!items.length) return <p className="text-sm text-gray-400">No media yet.</p>
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {items.map((m) => (
        <div key={m.id} className="group relative bg-white rounded-xl overflow-hidden shadow-sm">
          {m.type === 'image' ? (
            <img src={m.cdn_url} alt={m.name} className="w-full aspect-video object-cover" />
          ) : (
            <video src={m.cdn_url} muted className="w-full aspect-video object-cover" />
          )}
          <div className="p-2">
            <p className="text-xs font-medium truncate">{m.name}</p>
            <p className="text-xs text-gray-400">{m.type}</p>
          </div>
          <button
            onClick={() => onDelete(m.id)}
            className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition"
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 7: Write media page**

```typescript
// apps/cms/app/(dashboard)/media/page.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UploadZone } from './upload-zone'
import { MediaGrid } from './media-grid'
import type { Media } from '@koppiku/shared'

export default function MediaPage() {
  const [items, setItems] = useState<Media[]>([])
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  const loadMedia = useCallback(async () => {
    const { data } = await supabase.from('media').select('*').order('created_at', { ascending: false })
    setItems((data as Media[]) ?? [])
  }, [supabase])

  useEffect(() => { loadMedia() }, [loadMedia])

  async function handleFiles(files: File[]) {
    setUploading(true)
    const { data: { session } } = await supabase.auth.getSession()
    for (const file of files) {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/upload`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${session!.access_token}`,
          'x-file-name': file.name,
          'x-file-type': file.type,
        },
        body: file,
      })
    }
    setUploading(false)
    loadMedia()
  }

  async function handleDelete(id: string) {
    setItems(prev => prev.filter(m => m.id !== id))
    await supabase.from('media').delete().eq('id', id)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Media Library</h1>
      <UploadZone onFiles={handleFiles} uploading={uploading} />
      <MediaGrid items={items} onDelete={handleDelete} />
    </div>
  )
}
```

- [ ] **Step 8: Verify manually**

Go to http://localhost:3000/media. Upload a test image. Verify it appears in the grid. Delete it.

- [ ] **Step 9: Commit**

```bash
git add apps/cms/app/\(dashboard\)/media/
git commit -m "feat: CMS media library — upload to GCS, grid view, delete"
```

---

## Task 11: CMS — playlist builder

**Files:**
- Create: `apps/cms/app/(dashboard)/playlists/page.tsx`
- Create: `apps/cms/app/(dashboard)/playlists/[id]/page.tsx`
- Create: `apps/cms/app/(dashboard)/playlists/[id]/playlist-editor.tsx`
- Create: `apps/cms/app/(dashboard)/playlists/actions.ts`

- [ ] **Step 1: Install dnd-kit**

```bash
cd apps/cms && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Write playlist server actions**

```typescript
// apps/cms/app/(dashboard)/playlists/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createPlaylist(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const name = formData.get('name') as string
  const { data } = await supabase.from('playlists').insert({ name, created_by: user!.id }).select().single()
  revalidatePath('/playlists')
  return data
}

export async function publishPlaylist(id: string) {
  const supabase = createClient()
  await supabase.from('playlists').update({ status: 'published' }).eq('id', id)
  revalidatePath(`/playlists/${id}`)
}

export async function unpublishPlaylist(id: string) {
  const supabase = createClient()
  await supabase.from('playlists').update({ status: 'draft' }).eq('id', id)
  revalidatePath(`/playlists/${id}`)
}

export async function addItemToPlaylist(playlistId: string, mediaId: string, sequence: number) {
  const supabase = createClient()
  await supabase.from('playlist_items').insert({ playlist_id: playlistId, media_id: mediaId, sequence })
  revalidatePath(`/playlists/${playlistId}`)
}

export async function removeItemFromPlaylist(itemId: string, playlistId: string) {
  const supabase = createClient()
  await supabase.from('playlist_items').delete().eq('id', itemId)
  revalidatePath(`/playlists/${playlistId}`)
}

export async function updateItemsSequence(items: { id: string; sequence: number }[]) {
  const supabase = createClient()
  await Promise.all(items.map(({ id, sequence }) =>
    supabase.from('playlist_items').update({ sequence }).eq('id', id)
  ))
}

export async function updateItemDuration(itemId: string, duration: number | null, playlistId: string) {
  const supabase = createClient()
  await supabase.from('playlist_items').update({ display_duration_s: duration }).eq('id', itemId)
  revalidatePath(`/playlists/${playlistId}`)
}
```

- [ ] **Step 3: Write playlist list page**

```typescript
// apps/cms/app/(dashboard)/playlists/page.tsx
import { createClient } from '@/lib/supabase/server'
import { createPlaylist } from './actions'
import Link from 'next/link'
import type { Playlist } from '@koppiku/shared'

export default async function PlaylistsPage() {
  const supabase = createClient()
  const { data: playlists } = await supabase.from('playlists').select('*').order('created_at', { ascending: false }) as { data: Playlist[] }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Playlists</h1>
      </div>
      <form action={createPlaylist} className="flex gap-3">
        <input name="name" placeholder="Playlist name" required
          className="flex-1 border rounded-lg px-3 py-2 text-sm bg-white" />
        <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          New Playlist
        </button>
      </form>
      <div className="bg-white rounded-xl shadow-sm divide-y">
        {(playlists ?? []).map((p) => (
          <Link key={p.id} href={`/playlists/${p.id}`}
            className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
            <span className="font-medium text-sm">{p.name}</span>
            <span className={`text-xs px-2 py-1 rounded-full ${p.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {p.status}
            </span>
          </Link>
        ))}
        {!playlists?.length && <p className="px-4 py-6 text-sm text-gray-400">No playlists yet.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write playlist editor (drag-and-drop)**

```typescript
// apps/cms/app/(dashboard)/playlists/[id]/playlist-editor.tsx
'use client'
import { useState, useCallback } from 'react'
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Playlist, PlaylistItem, Media } from '@koppiku/shared'
import { updateItemsSequence, removeItemFromPlaylist, addItemToPlaylist, publishPlaylist, unpublishPlaylist, updateItemDuration } from '../actions'

function SortableItem({ item, playlistId }: { item: PlaylistItem & { media: Media }; playlistId: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const DEFAULT_DURATION = item.media.type === 'video' ? (item.media.duration_s ?? 30) : 10

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-white border rounded-lg p-3">
      <span {...attributes} {...listeners} className="cursor-grab text-gray-400">⠿</span>
      {item.media.type === 'image' ? (
        <img src={item.media.cdn_url} className="w-16 h-10 object-cover rounded" />
      ) : (
        <video src={item.media.cdn_url} className="w-16 h-10 object-cover rounded" muted />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.media.name}</p>
        <p className="text-xs text-gray-400">{item.media.type}</p>
      </div>
      <div className="flex items-center gap-1 text-xs">
        <input
          type="number" min={1} max={300}
          defaultValue={item.display_duration_s ?? DEFAULT_DURATION}
          onChange={e => updateItemDuration(item.id, Number(e.target.value), playlistId)}
          className="w-14 border rounded px-2 py-1 text-center"
        />
        <span className="text-gray-400">s</span>
      </div>
      <button onClick={() => removeItemFromPlaylist(item.id, playlistId)}
        className="text-red-400 hover:text-red-600 text-sm">✕</button>
    </div>
  )
}

interface Props {
  playlist: Playlist
  items: (PlaylistItem & { media: Media })[]
  allMedia: Media[]
}

export function PlaylistEditor({ playlist, items: initial, allMedia }: Props) {
  const [items, setItems] = useState(initial)

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    const reordered = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({ ...item, sequence: idx }))
    setItems(reordered)
    await updateItemsSequence(reordered.map(i => ({ id: i.id, sequence: i.sequence })))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{playlist.name}</h1>
        {playlist.status === 'draft' ? (
          <button onClick={() => publishPlaylist(playlist.id)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Publish
          </button>
        ) : (
          <button onClick={() => unpublishPlaylist(playlist.id)}
            className="bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Unpublish
          </button>
        )}
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map(item => <SortableItem key={item.id} item={item} playlistId={playlist.id} />)}
            {!items.length && <p className="text-sm text-gray-400">No items yet. Add from media below.</p>}
          </div>
        </SortableContext>
      </DndContext>

      <div>
        <h2 className="font-semibold mb-3 text-sm text-gray-600 uppercase tracking-wide">Add from Media Library</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          {allMedia.map(m => (
            <button key={m.id}
              onClick={() => addItemToPlaylist(playlist.id, m.id, items.length)}
              className="text-left bg-white rounded-lg overflow-hidden shadow-sm hover:ring-2 ring-amber-400">
              {m.type === 'image'
                ? <img src={m.cdn_url} className="w-full aspect-video object-cover" />
                : <video src={m.cdn_url} className="w-full aspect-video object-cover" muted />}
              <p className="text-xs p-2 truncate">{m.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write playlist detail page (server)**

```typescript
// apps/cms/app/(dashboard)/playlists/[id]/page.tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PlaylistEditor } from './playlist-editor'
import type { Playlist, PlaylistItem, Media } from '@koppiku/shared'

export default async function PlaylistPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: playlist }, { data: items }, { data: allMedia }] = await Promise.all([
    supabase.from('playlists').select('*').eq('id', params.id).single(),
    supabase.from('playlist_items').select('*, media(*)').eq('playlist_id', params.id).order('sequence'),
    supabase.from('media').select('*').order('created_at', { ascending: false }),
  ])

  if (!playlist) notFound()

  return (
    <PlaylistEditor
      playlist={playlist as Playlist}
      items={(items ?? []) as (PlaylistItem & { media: Media })[]}
      allMedia={(allMedia ?? []) as Media[]}
    />
  )
}
```

- [ ] **Step 6: Verify manually**

Create a playlist, add media items, drag to reorder, publish. Check that status changes to `published` in the list.

- [ ] **Step 7: Commit**

```bash
git add apps/cms/app/\(dashboard\)/playlists/
git commit -m "feat: playlist builder — drag-and-drop, add/remove items, publish"
```

---

## Task 12: CMS — scheduling + devices pages

**Files:**
- Create: `apps/cms/app/(dashboard)/schedules/page.tsx`
- Create: `apps/cms/app/(dashboard)/schedules/actions.ts`
- Create: `apps/cms/app/(dashboard)/devices/page.tsx`
- Create: `apps/cms/app/(dashboard)/devices/actions.ts`

- [ ] **Step 1: Write schedule actions**

```typescript
// apps/cms/app/(dashboard)/schedules/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createSchedule(formData: FormData) {
  const supabase = createClient()
  const daysRaw = formData.getAll('days_of_week').map(Number)
  await supabase.from('schedules').insert({
    playlist_id: formData.get('playlist_id') as string,
    outlet_id: (formData.get('outlet_id') as string) || null,
    start_time: formData.get('start_time') as string,
    end_time: formData.get('end_time') as string,
    days_of_week: daysRaw,
    active_from: formData.get('active_from') as string,
    active_until: (formData.get('active_until') as string) || null,
    priority: Number(formData.get('priority')) || 1,
  })
  revalidatePath('/schedules')
}

export async function deleteSchedule(id: string) {
  const supabase = createClient()
  await supabase.from('schedules').delete().eq('id', id)
  revalidatePath('/schedules')
}
```

- [ ] **Step 2: Write schedules page**

```typescript
// apps/cms/app/(dashboard)/schedules/page.tsx
import { createClient } from '@/lib/supabase/server'
import { createSchedule, deleteSchedule } from './actions'
import type { Schedule, Playlist, Outlet } from '@koppiku/shared'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default async function SchedulesPage() {
  const supabase = createClient()
  const [{ data: schedules }, { data: playlists }, { data: outlets }] = await Promise.all([
    supabase.from('schedules').select('*, playlist:playlists(name), outlet:outlets(name)').order('priority', { ascending: false }),
    supabase.from('playlists').select('id, name').eq('status', 'published'),
    supabase.from('outlets').select('id, name').order('name'),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Schedules</h1>

      <form action={createSchedule} className="bg-white p-4 rounded-xl shadow-sm space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Playlist</label>
            <select name="playlist_id" required className="w-full border rounded-lg px-3 py-2 text-sm">
              {(playlists ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Outlet (blank = all)</label>
            <select name="outlet_id" className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">All outlets</option>
              {(outlets ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Start time</label>
            <input type="time" name="start_time" required className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">End time</label>
            <input type="time" name="end_time" required className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Active from</label>
            <input type="date" name="active_from" required className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Active until (blank = forever)</label>
            <input type="date" name="active_until" className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Days (blank = every day)</label>
          <div className="flex gap-2">
            {DAYS.map((d, i) => (
              <label key={i} className="flex items-center gap-1 text-sm cursor-pointer">
                <input type="checkbox" name="days_of_week" value={i} /> {d}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Priority</label>
            <input type="number" name="priority" defaultValue={1} min={1}
              className="w-20 border rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="mt-4 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Add Schedule
          </button>
        </div>
      </form>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {(schedules ?? []).map((s: any) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{s.playlist?.name}</p>
              <p className="text-xs text-gray-500">
                {s.start_time}–{s.end_time} · {s.outlet?.name ?? 'All outlets'} · Priority {s.priority}
              </p>
            </div>
            <form action={deleteSchedule.bind(null, s.id)}>
              <button type="submit" className="text-xs text-red-500 hover:underline">Delete</button>
            </form>
          </div>
        ))}
        {!schedules?.length && <p className="px-4 py-6 text-sm text-gray-400">No schedules yet.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write device actions**

```typescript
// apps/cms/app/(dashboard)/devices/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function pairDevice(formData: FormData) {
  const code = formData.get('pairing_code') as string
  const outlet_id = formData.get('outlet_id') as string
  const device_name = formData.get('device_name') as string

  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/pair-device`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session!.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ pairing_code: code, outlet_id, device_name }),
  })

  if (!res.ok) throw new Error(await res.text())
  revalidatePath('/devices')
}

export async function renameDevice(id: string, name: string) {
  const supabase = createClient()
  await supabase.from('devices').update({ name }).eq('id', id)
  revalidatePath('/devices')
}
```

- [ ] **Step 4: Write devices page**

```typescript
// apps/cms/app/(dashboard)/devices/page.tsx
import { createClient } from '@/lib/supabase/server'
import { pairDevice, renameDevice } from './actions'
import type { Device, Outlet } from '@koppiku/shared'

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < 90_000 // 90s threshold
}

export default async function DevicesPage() {
  const supabase = createClient()
  const [{ data: devices }, { data: outlets }] = await Promise.all([
    supabase.from('devices').select('*, outlet:outlets(name)').order('status').order('last_seen', { ascending: false }),
    supabase.from('outlets').select('id, name').order('name'),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Devices</h1>

      <form action={pairDevice} className="bg-white p-4 rounded-xl shadow-sm flex gap-3 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Pairing code</label>
          <input name="pairing_code" placeholder="123456" maxLength={6} required
            className="w-28 border rounded-lg px-3 py-2 text-sm font-mono tracking-widest" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Outlet</label>
          <select name="outlet_id" required className="border rounded-lg px-3 py-2 text-sm">
            {(outlets ?? []).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Device name</label>
          <input name="device_name" placeholder="Screen 1" className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Pair Device</button>
      </form>

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {(devices ?? []).map((d: any) => (
          <div key={d.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${isOnline(d.last_seen) ? 'bg-green-500' : 'bg-gray-300'}`} />
              <div>
                <p className="text-sm font-medium">{d.name ?? 'Unnamed'}</p>
                <p className="text-xs text-gray-500">{d.outlet?.name} · Last seen: {d.last_seen ? new Date(d.last_seen).toLocaleString() : 'Never'}</p>
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {d.status}
            </span>
          </div>
        ))}
        {!devices?.length && <p className="px-4 py-6 text-sm text-gray-400">No devices yet.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write dashboard overview page**

```typescript
// apps/cms/app/(dashboard)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = createClient()
  const [{ count: outletCount }, { count: deviceCount }, { count: mediaCount }, { count: playlistCount }] =
    await Promise.all([
      supabase.from('outlets').select('*', { count: 'exact', head: true }),
      supabase.from('devices').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('media').select('*', { count: 'exact', head: true }),
      supabase.from('playlists').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    ])

  const stats = [
    { label: 'Outlets', value: outletCount ?? 0 },
    { label: 'Active Screens', value: deviceCount ?? 0 },
    { label: 'Media Files', value: mediaCount ?? 0 },
    { label: 'Published Playlists', value: playlistCount ?? 0 },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-6 shadow-sm">
            <p className="text-3xl font-bold text-amber-700">{value}</p>
            <p className="text-sm text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Verify all CMS pages render**

Visit each route: `/dashboard`, `/outlets`, `/media`, `/playlists`, `/schedules`, `/devices`. No 500 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/cms/app/\(dashboard\)/
git commit -m "feat: CMS scheduling, devices, dashboard pages"
```

---

## Task 13: TV Player — scaffold + PWA

**Files:**
- Create: `apps/tv-player/` (Vite + React 18)
- Create: `apps/tv-player/public/manifest.json`
- Create: `apps/tv-player/vite.config.ts`
- Create: `apps/tv-player/src/main.tsx`

- [ ] **Step 1: Create Vite app**

```bash
cd apps
npm create vite@latest tv-player -- --template react-ts
cd tv-player
npm install @supabase/supabase-js @koppiku/shared workbox-window
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom vite-plugin-pwa
```

- [ ] **Step 2: Write `vite.config.ts` with PWA plugin**

```typescript
// apps/tv-player/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [{
          urlPattern: /^https:\/\/cdn\./,
          handler: 'CacheFirst',
          options: { cacheName: 'media-cache', expiration: { maxEntries: 200, maxAgeSeconds: 86400 * 7 } },
        }],
      },
      manifest: {
        name: 'Koppiku TV Player',
        short_name: 'Koppiku TV',
        display: 'fullscreen',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }],
      },
    }),
  ],
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] },
})
```

- [ ] **Step 3: Write test setup**

```typescript
// apps/tv-player/src/test-setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Write `.env.local`**

```bash
# apps/tv-player/.env.local
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=<your-local-anon-key>
VITE_RESOLVE_SCHEDULE_URL=http://localhost:54321/functions/v1/resolve-schedule
VITE_HEARTBEAT_URL=http://localhost:54321/functions/v1/heartbeat
```

- [ ] **Step 5: Write main entry + global CSS**

```typescript
// apps/tv-player/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
)
```

```css
/* apps/tv-player/src/index.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #root { width: 100%; height: 100%; background: #000; overflow: hidden; cursor: none; }
```

- [ ] **Step 6: Write root App component (state machine)**

```typescript
// apps/tv-player/src/App.tsx
import { useDevice } from './hooks/useDevice'
import { PairingScreen } from './components/PairingScreen'
import { PlayerScreen } from './components/PlayerScreen'

export default function App() {
  const { deviceId, outletId, pairingCode } = useDevice()

  if (!outletId) return <PairingScreen pairingCode={pairingCode} />
  return <PlayerScreen deviceId={deviceId} outletId={outletId} />
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/tv-player/
git commit -m "feat: TV player scaffold — Vite + React PWA"
```

---

## Task 14: TV Player — device registration + pairing

**Files:**
- Create: `apps/tv-player/src/hooks/useDevice.ts`
- Create: `apps/tv-player/src/components/PairingScreen.tsx`
- Create: `apps/tv-player/src/hooks/useDevice.test.ts`

- [ ] **Step 1: Write failing test for useDevice**

```typescript
// apps/tv-player/src/hooks/useDevice.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: () => ({ eq: () => ({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) }),
      channel: () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
    }),
    channel: () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
  },
}))

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('useDevice', () => {
  it('generates a deviceId and stores it in localStorage', async () => {
    const { useDevice } = await import('./useDevice')
    const { result } = renderHook(() => useDevice())
    expect(result.current.deviceId).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.getItem('koppiku_device_id')).toBe(result.current.deviceId)
  })

  it('reuses deviceId across renders', async () => {
    const { useDevice } = await import('./useDevice')
    const { result: r1 } = renderHook(() => useDevice())
    const id1 = r1.current.deviceId
    const { result: r2 } = renderHook(() => useDevice())
    expect(r2.current.deviceId).toBe(id1)
  })

  it('returns null outletId when device is pending', async () => {
    const { useDevice } = await import('./useDevice')
    const { result } = renderHook(() => useDevice())
    expect(result.current.outletId).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/tv-player && npx vitest run
```

Expected: `Cannot find module './useDevice'`

- [ ] **Step 3: Write Supabase client for TV player**

```typescript
// apps/tv-player/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

- [ ] **Step 4: Write useDevice hook**

```typescript
// apps/tv-player/src/hooks/useDevice.ts
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function generatePairingCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function getOrCreateDeviceId(): string {
  const stored = localStorage.getItem('koppiku_device_id')
  if (stored) return stored
  const id = crypto.randomUUID()
  localStorage.setItem('koppiku_device_id', id)
  return id
}

export function useDevice() {
  const deviceId = getOrCreateDeviceId()
  const [pairingCode] = useState(generatePairingCode)
  const [outletId, setOutletId] = useState<string | null>(
    () => localStorage.getItem('koppiku_outlet_id')
  )

  useEffect(() => {
    // Register device row if it doesn't exist
    supabase.from('devices').select('id, outlet_id, status').eq('id', deviceId).single()
      .then(({ data }) => {
        if (!data) {
          supabase.from('devices').insert({
            id: deviceId,
            pairing_code: pairingCode,
            ua: navigator.userAgent,
          })
        } else if (data.status === 'active' && data.outlet_id) {
          localStorage.setItem('koppiku_outlet_id', data.outlet_id)
          setOutletId(data.outlet_id)
        }
      })
  }, [deviceId, pairingCode])

  useEffect(() => {
    // Subscribe to this device row for pairing confirmation
    const channel = supabase
      .channel(`device:${deviceId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'devices',
        filter: `id=eq.${deviceId}`,
      }, (payload) => {
        const updated = payload.new as { outlet_id: string | null; status: string }
        if (updated.status === 'active' && updated.outlet_id) {
          localStorage.setItem('koppiku_outlet_id', updated.outlet_id)
          setOutletId(updated.outlet_id)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [deviceId])

  return { deviceId, pairingCode, outletId }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd apps/tv-player && npx vitest run
```

Expected: 3 tests pass.

- [ ] **Step 6: Write PairingScreen component**

```typescript
// apps/tv-player/src/components/PairingScreen.tsx
interface Props { pairingCode: string }

export function PairingScreen({ pairingCode }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#1a0a00', color: '#fff', fontFamily: 'sans-serif',
    }}>
      <p style={{ fontSize: '1.2rem', color: '#d97706', marginBottom: '1rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Koppiku TV
      </p>
      <p style={{ fontSize: '1rem', color: '#9ca3af', marginBottom: '2rem' }}>
        Enter this code in the CMS to pair this screen
      </p>
      <div style={{
        fontSize: '5rem', fontWeight: 700, letterSpacing: '0.4em',
        background: '#d97706', color: '#fff', padding: '1.5rem 3rem', borderRadius: '1rem',
      }}>
        {pairingCode}
      </div>
      <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: '#6b7280' }}>
        Code expires in 10 minutes
      </p>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/tv-player/src/
git commit -m "feat: TV player device registration and pairing code UI"
```

---

## Task 15: TV Player — playback engine

**Files:**
- Create: `apps/tv-player/src/hooks/usePlayback.ts`
- Create: `apps/tv-player/src/components/PlayerScreen.tsx`
- Create: `apps/tv-player/src/components/ImageSlide.tsx`
- Create: `apps/tv-player/src/components/VideoSlide.tsx`
- Create: `apps/tv-player/src/hooks/usePlayback.test.ts`

- [ ] **Step 1: Write failing test for playback logic**

```typescript
// apps/tv-player/src/hooks/usePlayback.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getActiveItems, DEFAULT_IMAGE_DURATION_S } from './usePlayback'
import type { PlaylistItem, Media } from '@koppiku/shared'

const makeItem = (id: string, duration?: number): PlaylistItem & { media: Media } => ({
  id, playlist_id: 'p1', media_id: id, sequence: 0, display_duration_s: duration ?? null,
  media: { id, name: 'test', type: 'image', mime_type: 'image/jpeg', gcs_url: '', cdn_url: 'http://cdn/img.jpg',
    thumbnail_url: null, duration_s: null, size_bytes: 0, uploaded_by: 'u', created_at: '' },
})

describe('getActiveItems', () => {
  it('returns items sorted by sequence', () => {
    const items = [makeItem('b'), makeItem('a')].map((i, idx) => ({ ...i, sequence: idx === 0 ? 1 : 0 }))
    const result = getActiveItems(items)
    expect(result[0].id).toBe('a')
  })

  it('returns DEFAULT_IMAGE_DURATION_S for images with no override', () => {
    const item = makeItem('x')
    const result = getActiveItems([item])
    expect(result[0].display_duration_s).toBe(DEFAULT_IMAGE_DURATION_S)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd apps/tv-player && npx vitest run
```

- [ ] **Step 3: Write usePlayback hook**

```typescript
// apps/tv-player/src/hooks/usePlayback.ts
import { useState, useEffect, useCallback, useRef } from 'react'
import type { PlaylistItem, Media } from '@koppiku/shared'

export const DEFAULT_IMAGE_DURATION_S = 10

export function getActiveItems(items: (PlaylistItem & { media: Media })[]) {
  return [...items]
    .sort((a, b) => a.sequence - b.sequence)
    .map(item => ({
      ...item,
      display_duration_s:
        item.display_duration_s ??
        (item.media.type === 'video' ? (item.media.duration_s ?? 30) : DEFAULT_IMAGE_DURATION_S),
    }))
}

export function usePlayback(items: (PlaylistItem & { media: Media })[]) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const activeItems = getActiveItems(items)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const advanceSlide = useCallback(() => {
    setCurrentIndex(i => (i + 1) % Math.max(activeItems.length, 1))
  }, [activeItems.length])

  const currentItem = activeItems[currentIndex] ?? null

  useEffect(() => {
    if (!currentItem || currentItem.media.type === 'video') return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(advanceSlide, currentItem.display_duration_s * 1000)
    return () => clearTimeout(timerRef.current)
  }, [currentIndex, currentItem, advanceSlide])

  // When items change (Realtime update), continue from current if possible
  useEffect(() => {
    if (currentIndex >= activeItems.length) setCurrentIndex(0)
  }, [activeItems.length, currentIndex])

  return { currentItem, currentIndex, advanceSlide }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd apps/tv-player && npx vitest run
```

Expected: 2 tests pass.

- [ ] **Step 5: Write slide components**

```typescript
// apps/tv-player/src/components/ImageSlide.tsx
interface Props { url: string; alt: string }

export function ImageSlide({ url, alt }: Props) {
  return (
    <img
      src={url} alt={alt}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
    />
  )
}
```

```typescript
// apps/tv-player/src/components/VideoSlide.tsx
interface Props { url: string; onEnded: () => void }

export function VideoSlide({ url, onEnded }: Props) {
  return (
    <video
      key={url}
      src={url}
      autoPlay
      muted
      playsInline
      onEnded={onEnded}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
    />
  )
}
```

- [ ] **Step 6: Write PlayerScreen**

```typescript
// apps/tv-player/src/components/PlayerScreen.tsx
import { usePlayback } from '../hooks/usePlayback'
import { useRealtime } from '../hooks/useRealtime'
import { useHeartbeat } from '../hooks/useHeartbeat'
import { usePlaybackLogger } from '../hooks/usePlaybackLogger'
import { ImageSlide } from './ImageSlide'
import { VideoSlide } from './VideoSlide'

interface Props { deviceId: string; outletId: string }

export function PlayerScreen({ deviceId, outletId }: Props) {
  const { items, isOffline } = useRealtime(outletId)
  const { currentItem, advanceSlide } = usePlayback(items)
  useHeartbeat(deviceId)
  usePlaybackLogger(currentItem, deviceId)

  if (!currentItem) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff', background: '#1a0a00' }}>
        <p style={{ fontFamily: 'sans-serif', color: '#6b7280' }}>No content scheduled</p>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#000' }}>
      {currentItem.media.type === 'image' ? (
        <ImageSlide url={currentItem.media.cdn_url} alt={currentItem.media.name} />
      ) : (
        <VideoSlide url={currentItem.media.cdn_url} onEnded={advanceSlide} />
      )}
      {isOffline && (
        <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.5)', color: '#9ca3af', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'sans-serif' }}>
          Offline
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/tv-player/src/
git commit -m "feat: TV player playback engine — image/video slides, loop"
```

---

## Task 16: TV Player — Realtime sync + offline resilience

**Files:**
- Create: `apps/tv-player/src/hooks/useRealtime.ts`
- Create: `apps/tv-player/src/hooks/useHeartbeat.ts`
- Create: `apps/tv-player/src/hooks/usePlaybackLogger.ts`

- [ ] **Step 1: Write useRealtime hook**

```typescript
// apps/tv-player/src/hooks/useRealtime.ts
import { useState, useEffect, useCallback } from 'react'
import type { PlaylistItem, Media } from '@koppiku/shared'
import { supabase } from '../lib/supabase'

const STORAGE_KEY = 'koppiku_cached_items'

function loadCachedItems(): (PlaylistItem & { media: Media })[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

function saveItems(items: (PlaylistItem & { media: Media })[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

async function fetchScheduleItems(outletId: string): Promise<(PlaylistItem & { media: Media })[]> {
  const res = await fetch(`${import.meta.env.VITE_RESOLVE_SCHEDULE_URL}?outlet_id=${outletId}`)
  if (!res.ok) throw new Error('Failed to fetch schedule')
  const { items } = await res.json()
  return items ?? []
}

export function useRealtime(outletId: string) {
  const [items, setItems] = useState<(PlaylistItem & { media: Media })[]>(loadCachedItems)
  const [isOffline, setIsOffline] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetchScheduleItems(outletId)
      setItems(fresh)
      saveItems(fresh)
      setIsOffline(false)
    } catch {
      setIsOffline(true)
      // Continue with cached items
    }
  }, [outletId])

  useEffect(() => { refresh() }, [refresh])

  // Poll as fallback every 60s in case Realtime drops
  useEffect(() => {
    const interval = setInterval(refresh, 60_000)
    return () => clearInterval(interval)
  }, [refresh])

  // Realtime subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel(`outlet:${outletId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlists' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist_items' }, refresh)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') setIsOffline(true)
        if (status === 'SUBSCRIBED') setIsOffline(false)
      })
    return () => { supabase.removeChannel(channel) }
  }, [outletId, refresh])

  return { items, isOffline }
}
```

- [ ] **Step 2: Write useHeartbeat hook**

```typescript
// apps/tv-player/src/hooks/useHeartbeat.ts
import { useEffect } from 'react'

const INTERVAL_MS = 30_000

export function useHeartbeat(deviceId: string) {
  useEffect(() => {
    async function beat() {
      try {
        await fetch(import.meta.env.VITE_HEARTBEAT_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ device_id: deviceId }),
        })
      } catch { /* ignore — offline */ }
    }

    beat()
    const interval = setInterval(beat, INTERVAL_MS)
    return () => clearInterval(interval)
  }, [deviceId])
}
```

- [ ] **Step 3: Write usePlaybackLogger hook**

```typescript
// apps/tv-player/src/hooks/usePlaybackLogger.ts
import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { PlaylistItem, Media } from '@koppiku/shared'

export function usePlaybackLogger(
  currentItem: (PlaylistItem & { media: Media }) | null,
  deviceId: string,
) {
  const startRef = useRef<number>(Date.now())
  const prevItemRef = useRef<string | null>(null)

  useEffect(() => {
    if (!currentItem) return

    // Log previous item's actual display duration when slide changes
    if (prevItemRef.current && prevItemRef.current !== currentItem.id) {
      const duration = Math.round((Date.now() - startRef.current) / 1000)
      supabase.from('playback_logs').insert({
        device_id: deviceId,
        playlist_id: currentItem.playlist_id,
        media_id: prevItemRef.current,
        played_at: new Date(startRef.current).toISOString(),
        duration_s: duration,
      }).then() // fire-and-forget
    }

    startRef.current = Date.now()
    prevItemRef.current = currentItem.id
  }, [currentItem?.id, deviceId])
}
```

- [ ] **Step 4: Start TV player dev server and verify**

```bash
cd apps/tv-player && npm run dev
```

Open http://localhost:5173. Should show pairing code screen. Pair it via CMS (`/devices`). Should transition to player state.

- [ ] **Step 5: Commit**

```bash
git add apps/tv-player/src/
git commit -m "feat: TV player Realtime sync, offline fallback, heartbeat, playback logging"
```

---

## Task 17: E2E integration test

**Files:**
- Create: `apps/cms/e2e/signage-flow.spec.ts`
- Create: `apps/cms/playwright.config.ts`

- [ ] **Step 1: Install Playwright**

```bash
cd apps/cms
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Write Playwright config**

```typescript
// apps/cms/playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
    storageState: 'e2e/.auth.json',
  },
  webServer: { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true },
})
```

- [ ] **Step 3: Write auth setup helper**

```typescript
// apps/cms/e2e/auth.setup.ts
import { test as setup } from '@playwright/test'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.fill('input[type="email"]', process.env.E2E_EMAIL!)
  await page.fill('input[type="password"]', process.env.E2E_PASSWORD!)
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
  await page.context().storageState({ path: 'e2e/.auth.json' })
})
```

- [ ] **Step 4: Write E2E test**

```typescript
// apps/cms/e2e/signage-flow.spec.ts
import { test, expect } from '@playwright/test'

test('create outlet, upload media, build playlist, schedule', async ({ page }) => {
  // Create outlet
  await page.goto('/outlets')
  await page.fill('input[name="name"]', 'E2E Test Outlet')
  await page.fill('input[name="region"]', 'Test')
  await page.click('button[type="submit"]')
  await expect(page.getByText('E2E Test Outlet')).toBeVisible()

  // Upload media
  await page.goto('/media')
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('file-input').click(),
  ])
  await fileChooser.setFiles({ name: 'test.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake') })
  await expect(page.getByText('test.jpg')).toBeVisible({ timeout: 10_000 })

  // Create and publish playlist
  await page.goto('/playlists')
  await page.fill('input[name="name"]', 'E2E Playlist')
  await page.click('button[type="submit"]')
  await page.getByText('E2E Playlist').click()
  await page.getByText('test.jpg').click() // add media item
  await page.getByText('Publish').click()
  await expect(page.getByText('published')).toBeVisible()
})
```

- [ ] **Step 5: Run E2E tests**

```bash
cd apps/cms && E2E_EMAIL=test@example.com E2E_PASSWORD=yourpassword npx playwright test
```

Expected: 1 test passes (or skip with `test.skip` if no test credentials available in CI).

- [ ] **Step 6: Commit**

```bash
git add apps/cms/e2e/ apps/cms/playwright.config.ts
git commit -m "test: E2E signage flow — outlet, media upload, playlist publish"
```

---

## Task 18: Vercel deployment

**Files:**
- Create: `apps/cms/vercel.json`
- Create: `apps/tv-player/vercel.json`

- [ ] **Step 1: Write CMS vercel.json**

```json
// apps/cms/vercel.json
{
  "framework": "nextjs",
  "buildCommand": "cd ../.. && turbo build --filter=cms",
  "installCommand": "npm install"
}
```

- [ ] **Step 2: Write TV Player vercel.json**

```json
// apps/tv-player/vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 3: Set Vercel environment variables (CMS)**

In Vercel dashboard for `cms` project:
```
NEXT_PUBLIC_SUPABASE_URL = <your supabase project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY = <your supabase anon key>
```

- [ ] **Step 4: Set Vercel environment variables (TV Player)**

In Vercel dashboard for `tv-player` project:
```
VITE_SUPABASE_URL = <your supabase project URL>
VITE_SUPABASE_ANON_KEY = <your supabase anon key>
VITE_RESOLVE_SCHEDULE_URL = <supabase project URL>/functions/v1/resolve-schedule
VITE_HEARTBEAT_URL = <supabase project URL>/functions/v1/heartbeat
```

- [ ] **Step 5: Deploy edge functions to production Supabase**

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase functions deploy upload
npx supabase functions deploy pair-device
npx supabase functions deploy heartbeat
npx supabase functions deploy resolve-schedule
```

Set production secrets:
```bash
npx supabase secrets set GCS_BUCKET=koppiku-media
npx supabase secrets set CDN_BASE_URL=https://cdn.koppiku.com
npx supabase secrets set GCS_SA_KEY="$(cat infra/gcs-sa-key.json)"
```

- [ ] **Step 6: Smoke test production**

1. Open `https://cms.koppiku.com/login` — sign in ✓
2. Create an outlet ✓
3. Upload a test image ✓
4. Open `https://player.koppiku.com` on Android TV — shows pairing code ✓
5. Pair device in CMS ✓
6. TV transitions to player screen ✓
7. Build and publish a playlist — TV updates within 2s ✓

- [ ] **Step 7: Final commit**

```bash
git add apps/cms/vercel.json apps/tv-player/vercel.json
git commit -m "feat: vercel deployment config for CMS and TV player"
git tag v0.1.0
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Media upload → Tasks 5, 10
- [x] Playlist builder (drag-and-drop, duration, publish) → Task 11
- [x] Scheduling (time window, day-of-week, priority, nationwide) → Tasks 7, 12
- [x] Outlet + device management → Tasks 9, 12
- [x] TV player fullscreen kiosk → Tasks 13–16
- [x] Realtime sync (<2s) → Task 16 (Supabase Realtime)
- [x] Offline caching (Service Worker) → Task 13 (Workbox via VitePWA)
- [x] Device pairing → Tasks 6, 12, 14
- [x] Heartbeat (30s interval) → Task 16
- [x] playback_logs (from day one) → Task 16
- [x] Auth (Supabase email/password) → Task 8
- [x] Malaysia timezone (UTC+8) → Tasks 2, 7
- [x] GCS + Cloud CDN → Tasks 4, 5

**All types consistent:** `Outlet`, `Device`, `Media`, `Playlist`, `PlaylistItem`, `Schedule`, `PlaybackLog` defined in Task 2, referenced by name throughout.

**No placeholders found.**
