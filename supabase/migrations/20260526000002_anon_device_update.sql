-- Allow TV player (anon) to renew its own pairing code
create policy "anon update device pairing" on devices
  for update to anon
  using (status = 'pending')
  with check (status = 'pending');
