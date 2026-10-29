-- Discomplete — mark tracks as played yourself (when Last.fm missed one, or you heard it elsewhere)
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

create table public.track_marks (
  user_id uuid not null references auth.users (id) on delete cascade,
  deezer_id bigint not null,           -- the album
  track text not null,                 -- the track, normalised the same way as Last.fm tracks
  created_at timestamptz not null default now(),
  primary key (user_id, deezer_id, track)
);

alter table public.track_marks enable row level security;
create policy "Users manage their own track marks"
  on public.track_marks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.track_marks to authenticated;
