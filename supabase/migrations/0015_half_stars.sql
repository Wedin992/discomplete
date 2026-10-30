-- Discomplete — half stars: ratings from ½ to 5 in steps of ½
-- Run once in Supabase → SQL Editor (paste the whole file, click Run). Existing ratings stay as they are.

alter table public.entries drop constraint if exists entries_rating_check;
alter table public.entries alter column rating type numeric(2,1) using rating::numeric;
alter table public.entries add constraint entries_rating_check
  check (rating between 0.5 and 5 and rating * 2 = floor(rating * 2));

-- Public notes on a record: the rating can now be a half.
drop function if exists public.album_public_notes(uuid, int);
create function public.album_public_notes(p_album uuid, p_limit int default 20)
returns table (
  id uuid, listened_on date, rating numeric, format text, kind text, note text,
  note_lang text, note_en text,
  created_at timestamptz, username text, display_name text, is_anonymous boolean, is_mine boolean
)
language sql
stable
security definer set search_path = ''
as $$
  select e.id, e.listened_on, e.rating, e.format, e.kind, e.note,
         e.note_lang, e.note_en, e.created_at,
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
revoke all on function public.album_public_notes(uuid, int) from public;
grant execute on function public.album_public_notes(uuid, int) to anon, authenticated;

-- Rating summary: a half counts towards the star below it (3½ → the 3s), ½ towards the 1s.
create or replace function public.album_stats(p_album uuid)
returns table (rating_count int, avg_rating numeric, r1 int, r2 int, r3 int, r4 int, r5 int)
language sql
stable
security definer set search_path = ''
as $$
  select count(*)::int,
         round(avg(rating)::numeric, 1),
         count(*) filter (where greatest(1, floor(rating)) = 1)::int,
         count(*) filter (where floor(rating) = 2)::int,
         count(*) filter (where floor(rating) = 3)::int,
         count(*) filter (where floor(rating) = 4)::int,
         count(*) filter (where floor(rating) = 5)::int
  from public.entries
  where album_id = p_album and not is_private and rating is not null;
$$;
grant execute on function public.album_stats(uuid) to anon, authenticated;
