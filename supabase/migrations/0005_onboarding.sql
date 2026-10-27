-- Discomplete — sign-up quiz: what you want from the app, and artists you like
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

alter table public.profiles
  add column goals text[] not null default '{}',
  add column onboarded_at timestamptz;

-- Everyone who already has an account has, in effect, been onboarded; they can
-- still take the quiz from Settings.
update public.profiles set onboarded_at = now() where onboarded_at is null;

grant update (goals, onboarded_at) on public.profiles to authenticated;

create table public.favorite_artists (
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  deezer_artist_id bigint not null,
  artist           text not null check (char_length(artist) <= 300),
  picture          text check (char_length(picture) <= 500),
  created_at       timestamptz not null default now(),
  primary key (user_id, deezer_artist_id)
);

alter table public.favorite_artists enable row level security;

create policy "Users manage their favourite artists"
  on public.favorite_artists for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on public.favorite_artists to authenticated;
