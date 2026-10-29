-- Discomplete — albums logged automatically from Spotify ask "how was it?" (or wait until you have time)
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

-- ask:   just logged automatically — the diary asks you to rate or write about it
-- later: "I'll do it later" — it waits at the bottom of the diary
alter table public.lastfm_suggestions
  add column review text check (review in ('ask', 'later'));

-- Ones logged automatically in the last two weeks ask too (rated or written-about ones are skipped by the app).
update public.lastfm_suggestions set review = 'ask' where status = 'logged' and played_on >= current_date - 14;
