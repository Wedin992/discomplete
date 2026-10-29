-- Discomplete — challenges: complete an artist's albums, or one of our lists
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('artist', 'list')),
  ref text not null,                    -- Deezer artist id, or the list's slug
  title text not null,                  -- the artist's name, or the list's title
  created_at timestamptz not null default now(),
  draw_day date,                        -- "today's pick" from this challenge…
  draw_deezer_id bigint,                -- …and which album it is
  unique (user_id, kind, ref)
);

alter table public.challenges enable row level security;
create policy "Users manage their own challenges"
  on public.challenges for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.challenges to authenticated;
