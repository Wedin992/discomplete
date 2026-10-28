# Discomplete

**Live:** https://www.discomplete.com

A music diary. Log what you listened to, how you listened (stream, vinyl or CD), what you thought — and come back to see how it changed.

**Stack:** Next.js 16 (App Router) · Supabase (auth + Postgres with row-level security) · Deezer's open API for search and cover art · hosted on Vercel.

## What's in this first version

- Sign in with an email link (no passwords)
- Search any record via Deezer — editions (remasters, deluxe) are merged into one result
- Log a listen: format, rating, note, tags, date — edit or delete it later
- Visibility per entry: **public** (default), **public as Anonymous listener**, or **private only**
- First listen vs. relisten is detected automatically
- Diary (by day), month stats, "on repeat", relisten reminder
- Record page: community average + distribution, public notes, your own history
- To listen, collection (vinyl / CD / wishlist)

Not yet: "More like this" recommendations, Last.fm import, following friends.

## Setup (one time)

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com) (the free tier is fine; pick an EU region).
2. **SQL Editor → New query:** paste all of `supabase/migrations/0001_init.sql` and click **Run**.
3. **Authentication → URL Configuration:**
   - *Site URL:* your Vercel URL, e.g. `https://www.discomplete.com`
   - *Redirect URLs:* add `https://www.discomplete.com/auth/callback`, `https://discomplete.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`
4. **Project Settings → API:** copy the *Project URL* and the *anon public* key.
5. *(Optional)* **Translations:** run `supabase/migrations/0003_translations.sql` and add `DEEPL_API_KEY` in Vercel (DeepL API, free Developer plan). Public notes not in English get an English translation; private notes are never sent to DeepL.
6. *(Optional)* **Exact Spotify links:** create an app at developer.spotify.com and add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in Vercel. Without them the Spotify button opens a search.
7. **Discover — Today's three:** run `supabase/migrations/0006_discover_three.sql` (keeps the day's picks, Shuffle, "Not for me" and taste-neighbour picks). Genre picks are built but switched off; set `DISCOVER_GENRES=1` in Vercel to try them.
8. **"Remember this?" reminders:** run `supabase/migrations/0007_rediscover.sql` (lets "Not now" snooze a record for six months).
9. **"Heard it before":** run `supabase/migrations/0008_heard_before.sql` (lets entries be records you knew from before, with no date).
10. **Favourite tracks:** run `supabase/migrations/0009_favourite_tracks.sql` (up to three per entry, and the Fans' favourite tracks list on record pages).
11. **Spotify via Last.fm (optional):** run `supabase/migrations/0010_lastfm.sql` and add `LASTFM_API_KEY` in Vercel (free key from last.fm/api/account/create). Users connect their Last.fm username in Settings; whole-album sessions in their scrobbles become "Looks like you listened to …" suggestions in the diary.
6. **Sign-up quiz and artist suggestions:** run `0004_explore_artists.sql` and `0005_onboarding.sql`.
7. **Authentication → Emails → Templates:** in both *Magic Link* and *Confirm signup*, add the code so people can sign in inside the installed app (where email links open the browser instead):
   ```html
   <p>Your sign-in code: <strong>{{ .Token }}</strong></p>
   ```

### 2. Vercel
1. **Add New → Project →** import `Wedin992/discomplete`.
2. Under *Environment Variables* add:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon key
3. **Deploy.** Every push to `main` deploys automatically after this.

### Local development (optional)
```bash
cp .env.example .env.local   # fill in the two values
npm install
npm run dev
```

## How privacy works

Entries are readable only by their owner at table level. Other people's notes and ratings reach the record page only through two database functions:

- `album_public_notes` — non-private entries with a note; anonymous ones never include a name
- `album_stats` — rating average and distribution; private ratings are excluded

The service-role key is never needed by the app.

## Notes

- Supabase's built-in email sender is rate-limited (a few emails per hour). Fine for personal use; add your own SMTP (e.g. Resend) under *Authentication → Emails* before inviting others.
- Covers are loaded from Deezer's CDN, not copied.
