-- Discomplete — "Remember this?" reminders for records you loved
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

-- "Not now" on a reminder: that record isn't brought up again until `until`.
create table public.rediscover_snoozed (
  user_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  album_id uuid not null references public.albums (id) on delete cascade,
  until    date not null,
  primary key (user_id, album_id)
);

alter table public.rediscover_snoozed enable row level security;
create policy "Users manage their own reminder snoozes"
  on public.rediscover_snoozed for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.rediscover_snoozed to authenticated;
