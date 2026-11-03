-- Discomplete — album clubs: one album a week, listened to together
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.club_members (
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index club_members_user_idx on public.club_members (user_id);

create table public.club_picks (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  week_start date not null,                     -- the Monday the week starts
  album_id uuid not null references public.albums (id) on delete cascade,
  picked_by uuid references auth.users (id) on delete set null,
  note text check (char_length(note) <= 280),   -- "why this one"
  created_at timestamptz not null default now(),
  unique (club_id, week_start)
);

-- Is the signed-in user in this club? (security definer, so policies don't recurse)
create or replace function public.is_club_member(p_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from club_members where club_id = p_club and user_id = auth.uid());
$$;

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_picks enable row level security;

create policy "Members see their clubs" on public.clubs for select using (public.is_club_member(id));
create policy "The creator renames the club" on public.clubs for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "The creator deletes the club" on public.clubs for delete using (created_by = auth.uid());

create policy "Members see who is in the club" on public.club_members for select using (public.is_club_member(club_id));
create policy "Members can leave" on public.club_members for delete using (user_id = auth.uid());

create policy "Members see the picks" on public.club_picks for select using (public.is_club_member(club_id));
create policy "Members pick albums" on public.club_picks for insert with check (public.is_club_member(club_id) and picked_by = auth.uid());
create policy "The picker or the creator changes a pick" on public.club_picks for update
  using (picked_by = auth.uid() or exists (select 1 from clubs c where c.id = club_id and c.created_by = auth.uid()));
create policy "The picker or the creator removes a pick" on public.club_picks for delete
  using (picked_by = auth.uid() or exists (select 1 from clubs c where c.id = club_id and c.created_by = auth.uid()));

grant select, update, delete on public.clubs to authenticated;
grant select, delete on public.club_members to authenticated;
grant select, insert, update, delete on public.club_picks to authenticated;

-- Start a club (you're its first member).
create or replace function public.create_club(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into clubs (name, created_by) values (left(trim(p_name), 60), auth.uid()) returning id into v_id;
  insert into club_members (club_id, user_id) values (v_id, auth.uid());
  return v_id;
end $$;

-- What an invite link shows before you join.
create or replace function public.club_by_code(p_code text)
returns table (id uuid, name text, members int, is_member boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, (select count(*)::int from club_members m where m.club_id = c.id),
         exists (select 1 from club_members m where m.club_id = c.id and m.user_id = auth.uid())
  from clubs c where c.invite_code = p_code;
$$;

-- Join with an invite code.
create or replace function public.join_club(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into v_id from clubs where invite_code = p_code;
  if v_id is null then return null; end if;
  insert into club_members (club_id, user_id) values (v_id, auth.uid()) on conflict do nothing;
  return v_id;
end $$;

-- This week in a club: every member, whether they've listened since the week began,
-- and their stars and words — only once you've heard the album yourself. Private listens show as listened only.
create or replace function public.club_week(p_club uuid, p_album uuid, p_since date)
returns table (user_id uuid, name text, is_me boolean, listened boolean, listened_on date, rating numeric, note text, revealed boolean)
language sql stable security definer set search_path = public as $$
  with me as (
    select exists (select 1 from entries e where e.user_id = auth.uid() and e.album_id = p_album) as heard
  )
  select m.user_id,
         coalesce(nullif(p.display_name, ''), p.username, 'Someone'),
         m.user_id = auth.uid(),
         le.id is not null,
         le.listened_on,
         case when (select heard from me) and not coalesce(le.is_private, false) then le.rating end,
         case when (select heard from me) and not coalesce(le.is_private, false) then le.note end,
         (select heard from me)
  from club_members m
  left join profiles p on p.id = m.user_id
  left join lateral (
    select e.id, e.listened_on, e.rating, e.note, e.is_private from entries e
    where e.user_id = m.user_id and e.album_id = p_album and e.kind <> 'before' and e.listened_on >= p_since
    order by e.listened_on desc, e.created_at desc limit 1
  ) le on true
  where public.is_club_member(p_club) and m.club_id = p_club
  order by (le.id is null), le.listened_on, m.joined_at;
$$;

grant execute on function public.create_club(text), public.club_by_code(text), public.join_club(text), public.club_week(uuid, uuid, date) to authenticated;
