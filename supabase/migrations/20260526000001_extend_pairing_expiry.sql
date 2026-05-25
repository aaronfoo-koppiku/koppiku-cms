-- Extend pairing code default expiry from 10 minutes to 1 hour
alter table devices
  alter column pairing_code_expires_at
  set default (now() + interval '1 hour');
