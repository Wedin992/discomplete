-- Discomplete — initial schema
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

-- ─────────────────────────────────────────────────────────────
-- Profiles: one per user, created automatically on sign-up
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique check (username ~ '^[a-z0-9._]{3,24}$'),
  display_name text check (char_length(display_name) <= 60),
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by everyone"
  on public.profiles for select using (true);

create policy "Users update their own profile"
  on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  base text;
begin
  base := lower(regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9._]', '', 'g'));
  if char_length(base) < 3 then base := 'listener'; end if;
  base := left(base, 18);
  insert into public.profiles (id, username, display_name)
  values (new.id, base || '_' || substr(md5(new.id::text), 1, 4), split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Albums: the shared catalogue, filled from Deezer as people log
-- ─────────────────────────────────────────────────────────────
create table public.albums (
  id               uuid primary key default gen_random_uuid(),
  deezer_id        bigint unique,
  title            text not null,
  artist           text not null,
  deezer_artist_id bigint,
  release_year     int,
  record_type      text,
  genre            text,
  cover_small      text,
  cover_medium     text,
  cover_xl         text,
  track_count      int,
  duration_sec     int,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.albums enable row level security;

create policy "Albums are readable by everyone"
  on public.albums for select using (true);
-- No insert/update policies: albums are written only through upsert_album() below.

create function public.upsert_album(p jsonb)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
  result uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.albums as a (
    deezer_id, title, artist, deezer_artist_id, release_year, record_type, genre,
    cover_small, cover_medium, cover_xl, track_count, duration_sec
  ) values (
    (p->>'deezer_id')::bigint, p->>'title', p->>'artist', (p->>'deezer_artist_id')::bigint,
    (p->>'release_year')::int, p->>'record_type', p->>'genre',
    p->>'cover_small', p->>'cover_medium', p->>'cover_xl',
    (p->>'track_count')::int, (p->>'duration_sec')::int
  )
  on conflict (deezer_id) do update set
    title = excluded.title,
    artist = excluded.artist,
    release_year = coalesce(excluded.release_year, a.release_year),
    genre = coalesce(excluded.genre, a.genre),
    cover_small = excluded.cover_small,
    cover_medium = excluded.cover_medium,
    cover_xl = excluded.cover_xl,
    track_count = coalesce(excluded.track_count, a.track_count),
    duration_sec = coalesce(excluded.duration_sec, a.duration_sec),
    updated_at = now()
  returning a.id into result;
  return result;
end;
$$;

revoke all on function public.upsert_album(jsonb) from public, anon;
grant execute on function public.upsert_album(jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Entries: the diary. Private to their owner at table level;
-- the public parts are exposed only through the functions below.
-- ─────────────────────────────────────────────────────────────
create table public.entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  album_id     uuid not null references public.albums (id) on delete cascade,
  listened_on  date not null default current_date,
  rating       smallint check (rating between 1 and 5),
  format       text not null default 'stream' check (format in ('stream', 'vinyl', 'cd')),
  kind         text not null default 'first' check (kind in ('first', 'relisten')),
  note         text check (char_length(note) <= 5000),
  lyric        text check (char_length(lyric) <= 200),
  tags         text[] not null default '{}',
  is_private   boolean not null default false,
  is_anonymous boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index entries_user_idx on public.entries (user_id, listened_on desc, created_at desc);
create index entries_album_idx on public.entries (album_id);

alter table public.entries enable row level security;

create policy "Users read their own entries"
  on public.entries for select using (user_id = auth.uid());
create policy "Users add their own entries"
  on public.entries for insert with check (user_id = auth.uid());
create policy "Users edit their own entries"
  on public.entries for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete their own entries"
  on public.entries for delete using (user_id = auth.uid());

-- Public notes on a record. Anonymous entries never reveal who wrote them.
create function public.album_public_notes(p_album uuid, p_limit int default 20)
returns table (
  id uuid, listened_on date, rating smallint, format text, kind text, note text,
  created_at timestamptz, username text, display_name text, is_anonymous boolean, is_mine boolean
)
language sql
stable
security definer set search_path = ''
as $$
  select e.id, e.listened_on, e.rating, e.format, e.kind, e.note, e.created_at,
         case when e.is_anonymous then null else p.username end,
         case when e.is_anonymous then null else p.display_name end,
         e.is_anonymous,
         e.user_id = auth.uid()
  from public.entries e
  join public.profiles p on p.id = e.user_id
  where e.album_id = p_album
    and not e.is_private
    and coalesce(e.note, '') <> ''
  order by e.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Rating summary for a record. Private ratings are not counted; anonymous ones are.
create function public.album_stats(p_album uuid)
returns table (rating_count int, avg_rating numeric, r1 int, r2 int, r3 int, r4 int, r5 int)
language sql
stable
security definer set search_path = ''
as $$
  select count(*)::int,
         round(avg(rating)::numeric, 1),
         count(*) filter (where rating = 1)::int,
         count(*) filter (where rating = 2)::int,
         count(*) filter (where rating = 3)::int,
         count(*) filter (where rating = 4)::int,
         count(*) filter (where rating = 5)::int
  from public.entries
  where album_id = p_album and not is_private and rating is not null;
$$;

grant execute on function public.album_public_notes(uuid, int) to anon, authenticated;
grant execute on function public.album_stats(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- To listen + collection (both private to the user)
-- ─────────────────────────────────────────────────────────────
create table public.to_listen (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  album_id   uuid not null references public.albums (id) on delete cascade,
  source     text check (char_length(source) <= 200),
  created_at timestamptz not null default now(),
  primary key (user_id, album_id)
);

alter table public.to_listen enable row level security;
create policy "Users manage their own to-listen list"
  on public.to_listen for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.collection (
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  album_id   uuid not null references public.albums (id) on delete cascade,
  vinyl      boolean not null default false,
  cd         boolean not null default false,
  wishlist   boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, album_id)
);

alter table public.collection enable row level security;
create policy "Users manage their own collection"
  on public.collection for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- API access. Explicit, so this works with "Automatically expose
-- new tables" turned off. Row-level security still decides which rows.
-- ─────────────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;

grant select on public.profiles, public.albums to anon, authenticated;
grant update (username, display_name) on public.profiles to authenticated;

grant select, insert, update, delete on public.entries to authenticated;
grant select, insert, update, delete on public.to_listen to authenticated;
grant select, insert, update, delete on public.collection to authenticated;

-- Functions: only what the app calls, nothing else.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.album_public_notes(uuid, int) from public;
revoke all on function public.album_stats(uuid) from public;
grant execute on function public.album_public_notes(uuid, int) to anon, authenticated;
grant execute on function public.album_stats(uuid) to anon, authenticated;
