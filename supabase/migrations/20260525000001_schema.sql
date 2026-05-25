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
