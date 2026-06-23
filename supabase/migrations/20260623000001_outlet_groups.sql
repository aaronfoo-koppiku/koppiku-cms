-- Outlet groups and group membership
create table outlet_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table outlet_group_members (
  group_id uuid not null references outlet_groups(id) on delete cascade,
  outlet_id uuid not null references outlets(id) on delete cascade,
  primary key (group_id, outlet_id)
);

-- Link schedules to an outlet group (mutually exclusive with outlet_id)
alter table schedules add column outlet_group_id uuid references outlet_groups(id) on delete set null;

-- RLS
alter table outlet_groups enable row level security;
alter table outlet_group_members enable row level security;

create policy "auth full access" on outlet_groups for all to authenticated using (true) with check (true);
create policy "auth full access" on outlet_group_members for all to authenticated using (true) with check (true);
create policy "anon read outlet_groups" on outlet_groups for select to anon using (true);
create policy "anon read outlet_group_members" on outlet_group_members for select to anon using (true);
