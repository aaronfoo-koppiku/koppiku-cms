alter table playlists
  add column fallback_image_id uuid references media(id) on delete set null;
