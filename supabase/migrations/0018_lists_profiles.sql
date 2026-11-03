-- Discomplete — your own lists (others can take them on as a challenge), and an optional public profile
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

-- Lists ----------------------------------------------------------------------
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text check (char_length(description) <= 1000),
  is_public boolean not null default true,
  ranked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lists_user_idx on public.lists (user_id, updated_at desc);

create table public.list_items (
  list_id uuid not null references public.lists (id) on delete cascade,
  album_id uuid not null references public.albums (id) on delete cascade,
  position int not null default 0,
  note text check (char_length(note) <= 280),   -- why it's on the list
  created_at timestamptz not null default now(),
  primary key (list_id, album_id)
);

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

create policy "Public lists, and your own" on public.lists for select using (is_public or user_id = auth.uid());
create policy "You make your own lists" on public.lists for insert with check (user_id = auth.uid());
create policy "You change your own lists" on public.lists for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "You delete your own lists" on public.lists for delete using (user_id = auth.uid());

create policy "Items of lists you can see" on public.list_items for select
  using (exists (select 1 from lists l where l.id = list_id and (l.is_public or l.user_id = auth.uid())));
create policy "You fill your own lists" on public.list_items for insert
  with check (exists (select 1 from lists l where l.id = list_id and l.user_id = auth.uid()));
create policy "You edit your own lists" on public.list_items for update
  using (exists (select 1 from lists l where l.id = list_id and l.user_id = auth.uid()));
create policy "You empty your own lists" on public.list_items for delete
  using (exists (select 1 from lists l where l.id = list_id and l.user_id = auth.uid()));

grant select, insert, update, delete on public.lists, public.list_items to authenticated;

-- Take on someone's list as a challenge ---------------------------------------
alter table public.challenges drop constraint if exists challenges_kind_check;
alter table public.challenges add constraint challenges_kind_check check (kind in ('artist', 'list', 'user_list'));

-- Public profile (off until you switch it on) -----------------------------------
alter table public.profiles add column if not exists is_public boolean not null default false;
alter table public.profiles add column if not exists bio text check (char_length(bio) <= 200);

-- Someone's public listens (never private or anonymous ones), if their profile is public — or your own.
create or replace function public.profile_listens(p_username text, p_limit int default 500)
returns setof json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', e.id, 'listened_on', e.listened_on, 'rating', e.rating, 'kind', e.kind, 'note', e.note,
    'format', e.format, 'created_at', e.created_at, 'album', to_json(a))
  from profiles p
  join entries e on e.user_id = p.id
  join albums a on a.id = e.album_id
  where p.username = p_username and (p.is_public or p.id = auth.uid())
    and not e.is_private and not e.is_anonymous
  order by e.listened_on desc, e.created_at desc
  limit least(coalesce(p_limit, 500), 2000);
$$;

-- What they're working through.
create or replace function public.profile_challenges(p_username text)
returns setof json language sql stable security definer set search_path = public as $$
  select json_build_object('id', c.id, 'kind', c.kind, 'ref', c.ref, 'title', c.title, 'created_at', c.created_at)
  from profiles p join challenges c on c.user_id = p.id
  where p.username = p_username and (p.is_public or p.id = auth.uid())
  order by c.created_at desc;
$$;

grant execute on function public.profile_listens(text, int), public.profile_challenges(text) to authenticated;
