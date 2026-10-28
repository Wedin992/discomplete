-- Discomplete — Spotify (via Last.fm): suggested album listens from your scrobbles
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

-- Your Last.fm connection. Private: only you can read it (profiles are public, so it lives here).
create table public.lastfm_links (
  user_id    uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  username   text not null check (username ~ '^[A-Za-z0-9_-]{2,32}$'),
  autolog    boolean not null default false,
  synced_at  timestamptz,
  created_at timestamptz not null default now()
);
alter table public.lastfm_links enable row level security;
create policy "Users manage their own Last.fm link"
  on public.lastfm_links for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.lastfm_links to authenticated;

-- "Looks like you listened to …": one row per album listen spotted in your scrobbles.
create table public.lastfm_suggestions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  deezer_id     bigint not null,
  deezer_artist_id bigint,
  title         text not null check (char_length(title) <= 300),
  artist        text not null check (char_length(artist) <= 300),
  cover         text check (char_length(cover) <= 500),
  played_on     date not null,
  tracks_played int not null,
  total_tracks  int not null,
  status        text not null default 'pending' check (status in ('pending', 'logged', 'dismissed')),
  created_at    timestamptz not null default now(),
  unique (user_id, deezer_id, played_on)
);
alter table public.lastfm_suggestions enable row level security;
create policy "Users manage their own suggestions"
  on public.lastfm_suggestions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.lastfm_suggestions to authenticated;

-- "Never suggest this album / artist".
create table public.lastfm_muted (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('album', 'artist')),
  key        text not null check (char_length(key) <= 300),
  label      text check (char_length(label) <= 300),
  created_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);
alter table public.lastfm_muted enable row level security;
create policy "Users manage their own muted suggestions"
  on public.lastfm_muted for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.lastfm_muted to authenticated;
