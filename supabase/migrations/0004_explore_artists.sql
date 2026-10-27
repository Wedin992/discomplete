-- Discomplete — "I want to hear more from this artist"
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

create table public.explore_artists (
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  deezer_artist_id bigint not null,
  artist           text not null check (char_length(artist) <= 300),
  from_album_id    uuid references public.albums (id) on delete set null,
  created_at       timestamptz not null default now(),
  primary key (user_id, deezer_artist_id)
);

alter table public.explore_artists enable row level security;

create policy "Users manage the artists they explore"
  on public.explore_artists for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.explore_artists to authenticated;
