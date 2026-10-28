-- Discomplete — Discover: "Today's three", "Not for me" and taste neighbours
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

-- The three picks shown on a given day, per scope ('daily' or 'genre:<slug>').
create table public.discover_picks (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day        date not null,
  scope      text not null check (char_length(scope) <= 120),
  picks      jsonb not null default '[]'::jsonb,
  shuffles   int not null default 0 check (shuffles >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, day, scope)
);

alter table public.discover_picks enable row level security;
create policy "Users manage their own Discover picks"
  on public.discover_picks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.discover_picks to authenticated;

-- Records you said "Not for me" to. The artist is kept out of suggestions for a few months.
create table public.discover_dismissed (
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  deezer_id        bigint not null,
  deezer_artist_id bigint,
  artist           text check (char_length(artist) <= 300),
  created_at       timestamptz not null default now(),
  primary key (user_id, deezer_id)
);

alter table public.discover_dismissed enable row level security;
create policy "Users manage their own dismissed suggestions"
  on public.discover_dismissed for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.discover_dismissed to authenticated;

-- "People who rate like you also loved…": records rated 4★+ by users who gave 4★+ to the
-- same records as you. Only public entries count, and no user ids or notes are returned.
create function public.taste_neighbour_picks(p_limit int default 40)
returns table (deezer_id bigint, deezer_artist_id bigint, artist text, title text, cover text, release_year int, fans int, score numeric)
language sql
stable
security definer set search_path = ''
as $$
  with mine as (
    select album_id, rating from public.entries where user_id = auth.uid()
  ),
  neighbours as (
    select e.user_id, count(distinct e.album_id)::numeric as shared
    from public.entries e
    join mine m on m.album_id = e.album_id and m.rating >= 4
    where e.user_id <> auth.uid() and not e.is_private and e.rating >= 4
    group by e.user_id
  )
  select a.deezer_id, a.deezer_artist_id, a.artist, a.title, a.cover_medium, a.release_year::int,
         count(distinct e.user_id)::int as fans,
         sum(n.shared * (e.rating - 3))::numeric as score
  from public.entries e
  join neighbours n on n.user_id = e.user_id
  join public.albums a on a.id = e.album_id
  where e.rating >= 4 and not e.is_private
    and a.deezer_id is not null
    and e.album_id not in (select album_id from mine)
  group by a.id
  order by score desc, fans desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke execute on function public.taste_neighbour_picks(int) from public, anon;
grant execute on function public.taste_neighbour_picks(int) to authenticated;
