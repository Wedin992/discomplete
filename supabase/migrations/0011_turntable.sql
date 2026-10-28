-- Discomplete — "On the turntable": albums you've started, followed until you've finished them
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

alter table public.lastfm_suggestions
  add column lfm_key        text check (char_length(lfm_key) <= 700),
  add column tracks         text[] not null default '{}',
  add column last_played_at timestamptz;

-- pending:   "Looks like you listened to …" / "You started …" — waiting for an answer
-- listening: "I'm on it" — on the turntable, progress follows your scrobbles
-- finished:  you've played (almost) all of it — "how was it?"
-- logged / dismissed: done
alter table public.lastfm_suggestions drop constraint if exists lastfm_suggestions_status_check;
alter table public.lastfm_suggestions add constraint lastfm_suggestions_status_check
  check (status in ('pending', 'listening', 'finished', 'logged', 'dismissed'));

create index if not exists lastfm_suggestions_active on public.lastfm_suggestions (user_id, status);
