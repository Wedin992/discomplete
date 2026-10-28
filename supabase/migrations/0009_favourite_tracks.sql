-- Discomplete — favourite tracks: up to three per entry (optional)
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

-- Each element: {"id": <Deezer track id>, "title": "…", "position": <track number>}
alter table public.entries
  add column fav_tracks jsonb not null default '[]'::jsonb
  check (jsonb_typeof(fav_tracks) = 'array' and jsonb_array_length(fav_tracks) <= 3);

-- "Fans' favourites" on a record page: the tracks most often picked, counted once per person,
-- from public entries only. No user ids are returned.
create function public.album_top_tracks(p_album uuid, p_limit int default 5)
returns table (track_id bigint, title text, track_position int, fans int)
language sql
stable
security definer set search_path = ''
as $$
  select (t->>'id')::bigint, max(t->>'title'), max((t->>'position')::int), count(distinct e.user_id)::int
  from public.entries e
  cross join lateral jsonb_array_elements(e.fav_tracks) as t
  where e.album_id = p_album
    and not e.is_private
    and (t->>'id') ~ '^[0-9]{1,15}$'
  group by (t->>'id')::bigint
  order by 4 desc, 3 asc
  limit least(greatest(p_limit, 1), 20);
$$;

grant execute on function public.album_top_tracks(uuid, int) to anon, authenticated;
