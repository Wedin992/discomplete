-- Discomplete — "Stars are enough": a rated listen you don't want to write about stops asking.
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

alter table public.entries add column no_words boolean not null default false;
