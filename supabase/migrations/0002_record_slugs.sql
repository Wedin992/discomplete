-- Discomplete — readable record URLs, e.g. /record/metallica/and-justice-for-all
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

create function public.slugify(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    replace(replace(replace(translate(lower(coalesce(t, '')),
      'åäáàâãöóòôõøéèêëüúùûíìîïñç',
      'aaaaaaooooooeeeeuuuuiiiinc'),
      'æ', 'ae'), 'ß', 'ss'), '&', ' and '),
    '[^a-z0-9]+', '-', 'g'));
$$;

alter table public.albums
  add column artist_slug text,
  add column title_slug text;

-- Gives each record a unique artist/title pair; a clash gets -2, -3 …
create function public.albums_set_slugs()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  a text := coalesce(nullif(left(public.slugify(new.artist), 60), ''), 'artist');
  base text := coalesce(nullif(left(public.slugify(new.title), 80), ''), 'record');
  candidate text := base;
  n int := 1;
begin
  if new.artist_slug is not null and new.title_slug is not null then
    return new;
  end if;
  while exists (
    select 1 from public.albums
    where artist_slug = a and title_slug = candidate and id <> new.id
  ) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  new.artist_slug := a;
  new.title_slug := candidate;
  return new;
end;
$$;

create trigger albums_slugs
  before insert or update on public.albums
  for each row execute function public.albums_set_slugs();

-- Fill in records that already exist (oldest first keeps the shortest slugs).
do $$
declare r record;
begin
  for r in select id from public.albums where artist_slug is null order by created_at loop
    update public.albums set updated_at = updated_at where id = r.id;
  end loop;
end;
$$;

alter table public.albums
  alter column artist_slug set not null,
  alter column title_slug set not null;

create unique index albums_slug_idx on public.albums (artist_slug, title_slug);

revoke all on function public.albums_set_slugs() from public, anon, authenticated;
