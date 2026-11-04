-- Discomplete — email about listening parties (Monday digest + "X picked this week's album")
-- Run once in Supabase → SQL Editor. Then, in a SEPARATE run, set the key (see the last lines).

-- A private place for server-only secrets: no policies, so nothing can read it through the API.
create table if not exists public.app_secrets (name text primary key, value text not null);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;

-- Opt-out per person (on by default; Settings → Emails).
alter table public.profiles add column if not exists party_emails boolean not null default true;

-- Who to email in each party (only with the server's key; never callable from a browser without it).
create or replace function public.party_mail_list(p_key text, p_club uuid default null)
returns table (club_id uuid, club_name text, user_id uuid, email text, name text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if p_key is null or not exists (select 1 from public.app_secrets s where s.name = 'party_mail_key' and s.value = p_key) then
    raise exception 'not allowed';
  end if;
  return query
    select c.id, c.name, m.user_id, u.email::text, coalesce(nullif(p.display_name, ''), p.username, 'Someone')
    from public.clubs c
    join public.club_members m on m.club_id = c.id
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
    where (p_club is null or c.id = p_club) and coalesce(p.party_emails, true) and u.email is not null;
end $$;

-- This week's album in every party (for the Monday digest).
create or replace function public.party_week_picks(p_key text, p_week date)
returns table (club_id uuid, title text, artist text, artist_slug text, title_slug text, cover text, note text, picked_by text)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_key is null or not exists (select 1 from public.app_secrets s where s.name = 'party_mail_key' and s.value = p_key) then
    raise exception 'not allowed';
  end if;
  return query
    select k.club_id, a.title, a.artist, a.artist_slug, a.title_slug, coalesce(a.cover_medium, a.cover_small), k.note,
           coalesce(nullif(p.display_name, ''), p.username, 'Someone')
    from public.club_picks k
    join public.albums a on a.id = k.album_id
    left join public.profiles p on p.id = k.picked_by
    where k.week_start = p_week;
end $$;

grant execute on function public.party_mail_list(text, uuid), public.party_week_picks(text, date) to anon, authenticated;

-- ── Run separately, with your own long random value (the same one you put in Vercel as PARTY_MAIL_KEY): ──
-- insert into public.app_secrets (name, value) values ('party_mail_key', 'YOUR-LONG-RANDOM-VALUE')
--   on conflict (name) do update set value = excluded.value;
