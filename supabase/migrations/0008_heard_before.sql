-- Discomplete — "Heard it before": records you know from before you used Discomplete
-- Run once in Supabase → SQL Editor (paste the whole file, click Run).

-- A third kind of entry next to 'first' and 'relisten'. Its listened_on is the day you added it;
-- the app shows it as "Heard before" rather than as a dated listen.
alter table public.entries drop constraint if exists entries_kind_check;
alter table public.entries add constraint entries_kind_check check (kind in ('first', 'relisten', 'before'));
