# Discomplete – dokumentation

> **Levande dokument.** Uppdateras varje gång något läggs till, ändras eller tas bort i appen (se *Så hålls dokumentationen uppdaterad* längst ned).
> Källan finns i repot som `docs/DOCUMENTATION.md`. En kopia finns i Claude-projektet "Discomplete" som `claude/discomplete-dokumentation.md`.
>
> **Senast uppdaterad:** 2026-11-03 · **Guideversion:** 28 · **Senaste migrering:** 0017 (ska köras)

---

## 1. Översikt

**Discomplete** är Kevin Wedins app för att lyssna på hela album igen: www.discomplete.com. Man hittar nästa skiva (Today's three), tar sig igenom skivor och diskografier (Challenges), lyssnar tillsammans (Album clubs) och för en dagbok över varje lyssning: format (Stream, Vinyl eller CD), betyg och anteckningar.

**Identitet (beslut 3 nov 2026):** *"Listen to whole albums again."* Record Club handlar om vad man tycker om skivor. Discomplete handlar om att faktiskt lyssna på hela album: hitta nästa, ta sig igenom den, minnas den. Allt ska fungera manuellt; Last.fm (och senare Spotify-synk) gör det bara bekvämare. Vi bygger inte ikapp Record Club (ingen favorithylla, rotation, flikprofil eller följflöde just nu).

- **Gränssnittet är på engelska.** Kommunikationen med Kevin, guiden och den här dokumentationen är på svenska.
- **Appen kan installeras som PWA** på hemskärmen. Det finns ingen App Store-app ännu (planen är iOS via TestFlight, se strategidokumentet).
- **Strategin** (konkurrens, Record Club, creators, monetisering) beskrivs i `claude/discomplete-strategi-nov-2026.md` i projektet.
- **Repot** är `Wedin992/discomplete` (GitHub). Det deployas automatiskt till Vercel vid push till `main`.

### Säkerhetsregler (gäller alltid)
- Hemliga nycklar klistras **aldrig** in i chatten. Det gäller DeepL, Resend, Supabase service role, `LASTFM_API_KEY`, Last.fm shared secret och Spotify secrets. Kevin lägger in dem själv i Vercel.
- Supabase publishable/anon key får delas.
- **Privata anteckningar skickas aldrig till DeepL.**
- Appen behöver aldrig service role-nyckeln. Allt går via inloggad användare och RLS.

---

## 2. Teknik

| Del | Val |
|---|---|
| Ramverk | Next.js 16 (App Router, Turbopack, Server Actions), TypeScript |
| Databas och inloggning | Supabase (Postgres med row-level security, e-postlänk eller kod) via `@supabase/ssr` |
| Hosting | Vercel Hobby, team *Matchkit*, projekt *discomplete*, region `dub1` |
| Supabase-projekt | ref `ucfjfwtlwhiauxxbrnkr` |
| Skivdata och omslag | Deezer öppna API (ingen nyckel) |
| Artistbio | Wikipedia REST (gratis, cache 30 dagar) |
| Genrer (avstängt) | Wikidata SPARQL |
| "Listen on"-länkar | Odesli/song.link, iTunes Search, ev. Spotify Web API |
| Översättning | DeepL (gratis Developer-nyckel) |
| Spotify-lyssningar | Last.fm API (bara API-nyckel, ingen inloggning per användare) |

### Miljövariabler (Vercel)
| Variabel | Krav | Syfte |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Krävs | Supabase |
| `DEEPL_API_KEY` | Valfri | Översättning av publika anteckningar |
| `LASTFM_API_KEY` | Valfri | Spotify via Last.fm (Kevin har lagt in den) |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Valfri | Exakta Spotify-länkar. Utan dem blir det en sökning. |
| `DISCOVER_GENRES=1` | Valfri | Slår på genreläget i Discover (avstängt) |
| `OWNER_EMAILS` | Valfri | Vem som ser ägarguiden. Default `kevinwedin@gmail.com` (profil kevinwedin_3326). |
| `LASTFM_API_BASE`, `DEEZER_API_BASE`, `WIKIPEDIA_API_BASE`, `WIKIDATA_SPARQL` | Bara test | Pekar om API:er mot mock-servern |

### Kodstruktur
- `src/app/` innehåller sidor, `actions.ts` (alla Server Actions), `globals.css` och API-routes.
- `src/components/` innehåller delade komponenter.
- `src/lib/` innehåller logik och integrationer:
  - `deezer.ts`, `lastfm.ts`, `lastfm-sync.ts`, `progress.ts`
  - `discover.ts`, `discover-store.ts`, `genre.ts`
  - `challenges.ts`, `challenge-lists.ts`
  - `listen.ts`, `translate.ts`, `wiki.ts`, `format.ts`, `owner.ts`
  - `supabase/`
- `src/proxy.ts` är middleware: den skickar alla till rätt domän och förnyar sessionen.
- `supabase/migrations/` innehåller alla migreringar, numrerade. Kevin kör dem själv i Supabase → SQL Editor.
- `src/app/settings/guide/content.ts` innehåller ägarguiden, med versioner och sektioner.

---

## 3. Navigering och layout

- **Flikar på mobil (bottenmeny):** Diary · Discover · **+** (Log a listen) · To listen · Records. På dator: toppmeny med Diary, Discover, Records, To listen, Clubs, Settings och knappen "Log a listen".
- **Profilikonen** uppe till höger öppnar Settings.
- **Tillbaka-pil (‹)** i sidhuvudet finns på alla sidor under huvudflikarna:
  - Har man kommit från en annan sida i appen går den dit, som `router.back()`.
  - Har man öppnat sidan direkt går den till sidan ovanför: logg till skiva, utmaning till Challenges, klubb till Clubs, guide och Last.fm till Settings, annars Diary.
- **Log-arket** ("+") öppnar sökningen ovanpå den sida man står på och visar "Recently logged".
- **URL:er är läsbara:**
  - `/record/<artist>/<titel>` och `/record/<artist>/<titel>/log`
  - `/artist/<namn>-<deezerId>`
  - `/challenges/<id>` och `/challenges/list/<slug>`
  - `/clubs`, `/clubs/<id>` och inbjudningar `/clubs/join/<kod>`
- `/open/<deezerId>` sparar skivan i katalogen och skickar vidare till skivsidan. Den tar emot `then=log`, `date` och `suggestion`.

---

## 4. Funktioner

### 4.1 Inloggning och kom igång
- Inloggningssidan säger "Listen to whole albums again" med tre albumförslag om dagen, dagbok, utmaningar och ett album i veckan med vänner.
- Inloggning sker med e-postlänk eller 6-siffrig kod. Koden behövs i den installerade appen, där länkar öppnas i webbläsaren.
- **Sign-up-quiz** (`/welcome`, går att hoppa över): man väljer artister man gillar och mål. Det styr Discover direkt.

### 4.2 Logga en skiva
- **Sökning** via Deezer. Utgåvor som remaster och deluxe slås ihop till en träff.
- **Logg-formuläret:** datum, format (Stream/Vinyl/CD), betyg, anteckning, taggar, synlighet och upp till 3 favoritlåtar.
- **Betyg:** halva stjärnor från ½ till 5. Vänster halva av en stjärna ger en halv, höger halva en hel. Visas som `★★★½☆`. I databasen sparas `numeric(2,1)`.
  - Etiketter: Not for me / Meh / Good / Great / All-time, med "+" för halvor (t.ex. 3½ = "Good+").
- **Första lyssning eller omlyssning** avgörs automatiskt (kind `first`/`relisten`).
- **"Heard it before"** (kind `before`): skivor man kände till innan, utan datum.
  - Snabbläge i sökningen och på artistsidan: bara stjärnor.
  - De visas under "Heard before" i dagbokens sidokolumn.
  - Med en anteckning hamnar de också i dagboken.
- **Synlighet:** Public (standard), Public as "Anonymous listener" eller Private.
- **Översättning:** publika anteckningar som inte är på engelska översätts automatiskt med DeepL. Den egna översättningen visas **inte** i ens egen dagbok, bara för andra på skivsidan.

### 4.3 Dagboken (startsidan)
Sidans ordning uppifrån:
1. **Vyväxlare:** List · Shelf · Calendar, med egna ikoner.
1. **Album clubs:** ett kort per klubb med veckans album, om du har lyssnat (med stjärnor) och "2/3". Utan klubb visas länken "New: Album clubs". Döljs i filtret `?todo=1`.
2. **To do-panelen** (hopfälld). Rubriken säger rakt ut vad som väntar, t.ex. *"2 listens need stars · 2 could use a few words"*, med knappen **Sort it**. Utfälld visar den:
   - **Give these stars:** lyssningar utan betyg, med stjärnor direkt på raden. Betyget sparas direkt.
   - **A few words?:** lyssningar med betyg men utan text, bara från de senaste 14 dagarna. Varje rad har **Write** och **No thanks**, och det finns **Stars are enough for all** för alla på en gång (sätter `entries.no_words`).
   - **Also waiting:** On the turntable, förslag från Spotify, Challenges, och Remember this? eller relisten-påminnelse.
3. **Listan:**
   - Grupperad i *This week*, *Last week*, *Earlier in <månad>* och sedan en rubrik per månad.
   - Äldre månader är hopfällda.
   - Varje grupp har en statistikrad: lyssningar · skivor · vanligaste genrer (från Deezer) · mest spelade artist.
   - **Kompakta rader:** omslag, titel · artist, dag, stjärnor eller "☆ not rated", början av texten. Tryck på raden så fälls hela inlägget ut, med text, favoritlåtar, taggar, Edit och Delete.
   - **Omlyssningar utan eget betyg eller text** visas som en liten streckad rad: `↻ Played again · 3rd listen · ★★★★` med skivans bästa betyg. De räknas inte som att göra.
   - **Badges** i utfällt läge: "☆ Not rated · Rate it" (stjärnorna öppnas på kortet) och "✎ No review yet · Write one". Den andra visas inte om man har valt `no_words`.
4. **Shelf-vyn:** alla skivor man spelat, per månad, som stora omslag med ens stjärnor, titel och artist. Har man spelat en skiva flera gånger samma månad står "2×" på omslaget.
5. **Calendar-vyn:** varje månad som en kalender med måndag först och ett omslag per dag. "+n" visas om flera skivor spelats samma dag. Upp till 12 månader.
6. **Sidokolumnen** (nedanför på mobil): månadssiffror, On repeat this month, Heard before (12 senaste plus "+ Add"), Next up · To listen.
- **Remember this?** visar en skiva med 4★ eller mer som man inte spelat på 6 veckor eller mer. Den väljs slumpmässigt med vikt och visas en per dag. "Not now" snoozar skivan i 6 månader.
- **Relisten-påminnelse:** en första lyssning med 3★ eller mindre som är minst 14 dagar gammal och aldrig lyssnats om.
- Filtret `?todo=1` visar bara lyssningar som behöver stjärnor eller text.

### 4.4 Skivsidan
- Visar omslag, meta (år, genre), spår och längd, och "Listen on" (Spotify, Apple Music, YouTube Music, Deezer). Länkarna är exakta där det går, annars en sökning.
- **Statusruta** om man redan har skivan: "Heard before · no date" eller "In your diary · logged …", med knapparna "Write about it"/"Edit what you wrote", "Log a new listen" och "Log another listen"/"Edit latest". Inga ifyllda knappar, eftersom de såg förvalda ut.
- **Part of:** chips för de utmaningar skivan ingår i, med framsteg.
- **Tracklist** med bockar:
  - En fast bock betyder att låten spelats på Spotify via Last.fm de senaste 30 dagarna.
  - Tryck på ringen för att bocka i en låt själv (tabell `track_marks`, gäller 30 dagar).
  - Rubriken visar "✓ x of y played".
- **Fans' favourite tracks**, community-snitt med fördelning, publika anteckningar (med översättning) och ens egen historik.
- **In your collection:** Vinyl, CD och Wishlist.

### 4.5 Artistsidan
- Visar bild och kort bio från Wikipedia.
- Studioalbum från Deezer, där utgåvor slås ihop. Filter: All / Logged / Not yet.
- Snabbstjärnor ("Heard before") under ologgade album.
- **Complete it** startar en artistutmaning.
- **I want to hear more** följer artisten. Det påverkar Discover och To listen ("More from artists you're exploring").

### 4.6 Discover – Today's three
- **Upplåses** när man har betygsatt 5 skivor med 3★ eller mer, eller valt artister i quizen.
- **Tre förslag per dag** med roller: *safe bet* (nära det man älskar), *sidestep* (ett steg ut, via liknande artist) och *wildcard* (älskat av folk som betygsätter som en, eller en djupare skiva).
  - Smakprofilen bygger på betyg (5★ väger mest), omlyssningar, ägda skivor, följda artister och quizen. Nyare lyssningar väger mer.
  - 1–2★ och "Not for me" trycker ner liknande artister.
  - Källor: Deezers relaterade artister (1–2 steg) och SQL-funktionen `taste_neighbour_picks`.
- Förslagen sparas per dag i `discover_picks`. **Shuffle** finns 3 gånger per dag. **Not for me** byter förslaget och kommer ihåg valet.
- **"✓ I've listened to it":** stjärnor som loggas som dagens lyssning, eller på den dag Spotify såg skivan. **"Knew it already":** sparas som Heard before och förslaget kan bytas ut.
- **Status på korten:**
  - Lyssnad: orange ram runt hela kortet, "✓ Heard" på omslaget, "✓ Listened today" med stjärnor och "Write about it".
  - Spelas nu: streckad ram, "▶ Playing" och "On your turntable · x of y" med en mätare.
- **From your challenges:** dagens förslag från ens utmaningar visas under de tre.
- **Genreläget** är byggt (Wikidata) men avstängt. Slås på med `DISCOVER_GENRES=1`.

### 4.7 To listen
- **Next in your challenges** överst.
- **Started · from Spotify, last 30 days:** påbörjade skivor med "x of y tracks played" och en mätare.
- **Queued:** resten, med källa (t.ex. "Discover · …", "Started on Spotify").
- **More from artists you're exploring.**

### 4.8 Records
- Allt man loggat eller äger, med filter för Vinyl, CD och Wishlist. Knapp till Challenges.

### 4.9 Challenges (`/challenges`)
- **Två sorter:**
  - *Complete <artist>:* hela studiodiskografin, startas från artistsidan.
  - *Kurerade listor* (Kevins egna val, i koden i `challenge-lists.ts`): **Swedish classics** (30), **Debuts that changed everything** (30) och **One album a year: 2000–2024** (25). Varje lista kan förhandsvisas ("See the albums") innan man startar den.
- **Framsteg** räknas från dagboken: alla lyssningar och Heard before. En annan utgåva räknas också. Inget bockas av separat.
- **Today's pick:** en slumpad ohörd skiva per utmaning och dag. Den syns i dagboken (Also waiting), Discover och To listen.
- **"+1"** i dagboken när man nyss bockat av en skiva. "Stop this challenge" tar bort utmaningen men rör inte loggarna.
- Listskivor matchas mot Deezer med `findAlbum(..., { relaxed: true })`. Skivor som inte hittas hoppas över.
- Inga streaks och inget straff, avsiktligt.

### 4.9b Album clubs (`/clubs`)
- **Idén:** ett album i veckan som en grupp vänner lyssnar på, var och en i sin egen takt. Socialt kring själva lyssnandet, inte kring profiler. Fungerar helt utan Last.fm.
- **Starta:** namn på klubben → du blir medlem → välj första albumet → dela inbjudningslänken (`/clubs/join/<kod>`, knappen Share använder telefonens delningsmeny eller kopierar).
- **Gå med:** öppna länken, eller klistra in länk/kod på `/clubs`. Öppnas länken utloggad sparas den i cookien `dc_next` och man skickas tillbaka till inbjudan efter inloggningen.
- **Veckans album:** veckan börjar på måndag. Vem som helst i klubben kan välja veckans album om inget är valt, och nästa veckas. Val görs via sökning eller från ens To listen, med en valfri rad "Why this one?". Den som valde eller den som startade klubben kan ta bort ett val. Finns inget val för veckan visas det senaste albumet tills någon väljer.
- **Vem har lyssnat:** en lyssning (inte Heard before) av albumet från veckans måndag och framåt räknas. Knappen "I've listened — log it" öppnar loggformuläret.
- **Låst tills du hört den:** andras stjärnor och anteckningar syns först när du själv har skivan i dagboken. Privata lyssningar visas bara som "listened".
- **Earlier weeks:** tidigare veckors album. **Leave this club** längst ned.

### 4.10 Spotify via Last.fm (valfritt)
**Koppla:** Settings → Spotify har en guide i tre steg med knappar:
1. Skapa Last.fm-konto.
2. Last.fm → Applications → Spotify Scrobbling → Connect.
3. Fyll i Last.fm-namnet.

Efter det visar rutan **"✓ It's working – Playing right now / Last heard …"**. Annars står det "Waiting for your first song…" och sidan kollar själv igen var 20:e sekund. Om lyssningen är dold på Last.fm visas en länk till integritetsinställningen.

**Sync:**
- Körs i bakgrunden när dagboken öppnas (`/api/lastfm/sync`), högst var 10:e minut. Knappen "Check now" i Settings kör direkt.
- Första gången hämtas 14 dagars historik.

**Upptäckt av albumlyssning:**
- Scrobbles delas upp i sessioner. En paus på mer än 3 timmar startar en ny session.
- En skiva räknas som påbörjad om något av detta gäller:
  - minst **40 %** av låtarna och minst **5 låtar** i samma session, eller
  - minst **3 låtar i rad i skivans egen ordning**, eller
  - **hälften** av skivan (minst 4 låtar) utspritt över **14 dagar**, i vilken ordning som helst.
- **Hörd** (komplett) = minst **85 %**. **Klar** på turntable = minst 90 %, eller minst 85 % följt av 20 minuters paus.

**Livscykel** (`lastfm_suggestions.status`):
- **Spelas nu eller påbörjad** → `listening` = **On the turntable** med mätare, även om man nästan är klar.
  - Knappar: What's left (låtlistan), Done? Rate it, Move to To listen.
  - Under ⋯: Hide this, Never suggest this album, Never suggest <artist>.
- **Klar** (minst 85 % och 20 minuters paus) → `pending` "Looks like you listened to …" med stjärnor, eller med **Log full albums automatically** påslaget → loggas (`logged`).
  - Första lyssningen syns i To do som "Give these stars".
  - En omlyssning loggas tyst och visas som en liten ↻-rad, utan fråga om betyg.
- Har en skiva loggats automatiskt för tidigt och man fortfarande spelar den, utan att ha satt betyg eller skrivit något, tas loggen bort och skivan flyttas tillbaka till turntable.
- Turntable-skivor som inte rörs på 72 timmar flyttas till To listen.
- En skiva i To listen som spelats till minst 85 % (över flera tillfällen eller med egna bockar) dyker upp som "You finished … how was it?".
- När en skiva hamnar i dagboken, på vilket sätt som helst, stängs alla aktiva förslag för den skivan.
- Stjärnor (t.ex. i Discover) på en skiva som spelas just nu loggas som en riktig lyssning på rätt dag, inte som Heard before.
- Heard before hindrar inte att dagens lyssning följs och loggas.
- En gång per vecka per skiva. Undantaget är en ny, nästan hel lyssning efter "I'll get back to it", "Not now" eller en loggning.
- Om man raderar en lyssning som kom från Spotify blir den ett förslag igen.
- **Remove — wasn't an album listen:** Just remove it / Never log this album / Never log <artist>. Under Settings → "Never logged from Spotify" visas listan med knappen **Allow again**.

**Add albums you already know** (`/lastfm/top`):
- Visar mest spelade skivor genom tiderna, men bara skivor med minst lika många spelningar som skivan har låtar, och minst 5.
- Det som redan finns i dagboken listas under "Already in your diary".

### 4.11 Settings
- Public profile (namn under publika anteckningar).
- Spotify via Last.fm (se ovan).
- Your taste (gör om quizen).
- Get the app (installera som PWA).
- **Guide · only you:** ägarguiden, se nedan.
- Signed in as / Sign out.

### 4.12 Ägarguiden (`/settings/guide`)
- Syns bara för ägaren (`OWNER_EMAILS`, default kevinwedin@gmail.com).
- Skriven på svenska. Visar "Nytt i version X", sektioner med snabblänkar och tidigare versioner.
- Innehållet finns i `src/app/settings/guide/content.ts`.

---

## 5. Datamodell (Supabase)

| Tabell / funktion | Innehåll | Migrering |
|---|---|---|
| `profiles` | användarnamn, visningsnamn, `goals`, `onboarded_at` | 0001, 0005 |
| `albums` | delad katalog: deezer_id, artist, titel, omslag, år, genre, track_count, slugs | 0001, 0002 |
| `entries` | lyssningar: `listened_on`, `rating numeric(2,1)` ½–5, `kind` first/relisten/before, format, note, tags, `is_private`, `is_anonymous`, `note_lang`/`note_en`, `fav_tracks` (≤3), `no_words` | 0001, 0003, 0008, 0009, 0015, 0016 |
| `to_listen`, `collection` | kö (med källa); vinyl/cd/wishlist | 0001 |
| `explore_artists`, `favorite_artists` | "I want to hear more" och quiz-artister | 0004, 0005 |
| `discover_picks`, `discover_dismissed` | dagens tre per dag och scope; "Not for me" | 0006 |
| `rediscover_snoozed` | "Not now" på Remember this? | 0007 |
| `lastfm_links` | Last.fm-namn, autolog, synced_at (privat) | 0010 |
| `lastfm_suggestions` | status pending/listening/finished/logged/dismissed, `lfm_key`, `tracks[]`, `last_played_at`, `review` ask/later | 0010, 0011, 0014 |
| `lastfm_muted` | aldrig föreslå/logga album eller artist | 0010 |
| `track_marks` | egna låtbockar | 0012 |
| `challenges` | artist- och listutmaningar plus dagens pick (`draw_day`, `draw_deezer_id`) | 0013 |
| `clubs`, `club_members`, `club_picks` | albumklubbar: namn och `invite_code`; medlemmar; ett album per klubb och vecka (`week_start` = måndag, `note`) | 0017 |
| `is_club_member()`, `create_club()`, `join_club()`, `club_by_code()`, `club_week()` | medlemskoll för RLS; skapa/gå med; vad en inbjudan visar; veckans lista över medlemmar med lyssnat, stjärnor och ord (låsta tills du hört skivan, privata dolda) | 0017 |
| `upsert_album()`, `slugify()` | katalog och slugs | 0001, 0002 |
| `album_public_notes()` | publika anteckningar (anonyma utan namn) | 0001, 0003, 0015 |
| `album_stats()` | snitt och fördelning, privata exkluderade, en halva räknas mot stjärnan under | 0001, 0015 |
| `taste_neighbour_picks()` | skivor älskade av folk med liknande smak | 0006 |
| `album_top_tracks()` | Fans' favourite tracks | 0009 |

- **RLS:** allt är privat per användare.
- Andras data når skivsidan bara via `security definer`-funktionerna ovan.
- Koden faller tillbaka snällt om en migrering inte är körd: funktionen syns då inte eller sparas utan den nya kolumnen.

**Migreringar 0001–0016 är körda av Kevin. 0017 (album clubs) ska köras.**

---

## 6. Test och arbetssätt (för Claude)
- **Testmiljö** (scratchpad i sessionen):
  - `mock-discover.js` på port 54327 mockar Supabase REST, Deezer (`/dz`), Wikipedia, Wikidata, Last.fm (`/lfm/`) och debug-endpoints (`/debug/sug`, `/debug/autolog`, `/debug/relisten`, `/debug/autoplaying` m.fl.).
  - `restart.sh <port>` bygger och startar appen mot mocken.
  - Playwright-skript tar skärmbilder i mobilstorlek.
- **Typkontroll:** `./node_modules/.bin/tsc --noEmit -p .`
- **Commits:**
  - Görs med `git -c user.name="Kevin Wedin" -c user.email="kevin.wedin@ci.se" commit …` och pushas med `git push -q origin main`.
  - Varje commit avslutas med `Co-Authored-By` och `Claude-Session`.
- **Nya databasändringar** blir en ny numrerad migrering i `supabase/migrations/`. SQL-koden ges till Kevin i chatten, och README:s setup-lista uppdateras.
- Kevin testar själv på mobilen och skickar skärmbilder. Svaren till Kevin ska vara på svenska.

---

## 7. Beslut och principer
- **Inspiration utan att dränera:** tre förslag per dag, inga streaks, inget straff.
- **Spotify-API direkt är stängt för små appar** (5 användare i dev-läge, extended kräver organisation och 250 000 MAU). Därför används Last.fm som brygga, och appen fungerar fullt ut utan den.
- **Ingen manuell låtloggning.** Kevin valde bort det eftersom det blir för mycket manuellt jobb.
- **Discover visar bara nya skivor.** Påbörjade skivor syns på turntable och i To listen, inte i Discover.
- **Betyg och recension är frivilliga.** Det ska alltid finnas ett sätt att säga "stjärnorna räcker" eller "skippa".
- **Omlyssningar ska inte se ut som nya skivor.**
- **Tydlighet före antal val:** få knappar synliga, resten under ⋯.
- **Identitet: albumlyssnande, inte en Record Club-kopia** (3 nov). Ingen Top 5/"My five", rotation, flikprofil eller följflöde nu. Det sociala byggs kring lyssnandet (klubbar, gemensamma utmaningar, delade framsteg).
- **Allt ska fungera utan Last.fm.** Last.fm och kommande Spotify-synk är bekvämlighet, inte identitet.

## 8. Uppskjutet / väntar
- **Logga och utseende:** Kevin gillar logga **D** (ordmärke där O:et är en skiva). Riktningarna A–F finns på designytan "Discomplete — logo & look" (https://claude.ai/artifact/Cu9yT2aQ6babwUYqLLQtL1). Designsystem: https://claude.ai/artifact/DiLnkpsvZy3KQzRLgGzEZ8.
- Taggar vid betyg ("Grower", "Front to back" …) diskuterades men lades på is.
- **Nästa idéer i den nya riktningen:** "On this day" i dagboken, utmaningar man gör tillsammans, delbart framstegskort ("14 av 30"), full export, välja klubbalbum direkt från skivsidan, Spotify-synk.
- Influencer- och creator-profiler, delningskort, AI-humörläge, monetisering och App Store, se strategidokumentet.
- Exakta Spotify-länkar via Spotify API (kräver nycklar).
- Genreläget i Discover (avstängt).

## 9. Ändringslogg (i korthet)
Detaljerad versionshistorik finns i ägarguiden (`/settings/guide`).

| Datum | Ändring |
|---|---|
| okt 2026 | Grund: logga, dagbok, skivsida, artistsida, quiz, Discover "Today's three", Remember this?, Heard before, favoritlåtar, Last.fm-förslag, turntable, låtbockar |
| 29 okt | Ägarguide i appen. Last.fm top albums: bara hela skivor och "Already in your diary". "shelf" ersattes med "Heard before". Egna låtbockar. Guide i tre steg för Last.fm med kontrollen "It's working". |
| 29 okt | To listen-skivor som spelats klart frågar "how was it?". Challenges (artist och listor, Today's pick, Part of) med förhandsvisning av listor. 3 låtar i ordning eller hälften utspritt räknas som påbörjad. 85 % räknas som hörd. Review later och Skip review. Remove, wasn't an album listen, med "Allow again". Påbörjade skivor går direkt till turntable. Loggade skivor lämnar turntable. |
| 30 okt | Turntable live medan man lyssnar och räknas som klar först efter en paus. För tidigt autologgade skivor flyttas tillbaka. Discover markerar lyssnade (orange ram) och spelas-nu. Halva stjärnor (0015). |
| 1–2 nov | En fråga per skiva. Omlyssningar loggas tyst som små ↻-rader. Badges för obetygsatta. Ny dagbok med To do, kompakta rader, vecka och månad med genrestatistik, och vyerna List/Shelf/Calendar. Ingen egen översättning. Tillbaka-pil. |
| 2–3 nov | "No thanks" och "Stars are enough for all" (0016). Text efterfrågas bara för de senaste 14 dagarna. Den här dokumentationen skapades. |
| 3 nov | Ny identitet "Listen to whole albums again" (inloggning och appbeskrivning). Album clubs (0017): ett album i veckan med vänner, inbjudningslänk, låsta omdömen tills man hört skivan, kort överst i dagboken. |

---

## Så hålls dokumentationen uppdaterad
**Varje gång något läggs till, ändras eller tas bort i appen, i samma arbetspass:**
1. Uppdatera **det här dokumentet** (`docs/DOCUMENTATION.md` i repot): rätt avsnitt i kapitel 4, datamodellen om databasen ändrats, miljövariabler, beslut och uppskjutet samt en rad i ändringsloggen. Uppdatera även "Senast uppdaterad", "Guideversion" och "Senaste migrering" överst.
2. **Ladda upp** samma fil till Claude-projektet "Discomplete" som `claude/discomplete-dokumentation.md`, så att hela projektet har tillgång till den.
3. Lägg till en ny version i **ägarguiden** (`src/app/settings/guide/content.ts`, svenska) och justera berörda sektioner.
4. Ny migrering: lägg till den i README:s setup-lista och i tabellen i kapitel 5.
5. Committa och pusha allt tillsammans.
