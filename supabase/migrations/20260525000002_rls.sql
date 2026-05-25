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
