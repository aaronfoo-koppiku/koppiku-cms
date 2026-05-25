insert into outlets (id, name, region) values
  ('00000000-0000-0000-0000-000000000001', 'Koppiku Bangsar', 'KL'),
  ('00000000-0000-0000-0000-000000000002', 'Koppiku KLCC', 'KL'),
  ('00000000-0000-0000-0000-000000000003', 'Koppiku Melaka Central', 'Melaka')
on conflict (id) do nothing;
