-- Discomplete — automatic English translation of notes
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

alter table public.entries
  add column note_lang text check (char_length(note_lang) <= 10),
  add column note_en text check (char_length(note_en) <= 8000);

-- Public notes now include the detected language and the English translation.
drop function if exists public.album_public_notes(uuid, int);

create function public.album_public_notes(p_album uuid, p_limit int default 20)
returns table (
  id uuid, listened_on date, rating smallint, format text, kind text, note text,
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
