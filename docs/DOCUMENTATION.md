# Discomplete – dokumentation

> **Levande dokument.** Uppdateras varje gång något läggs till, ändras eller tas bort i appen (se *Så hålls dokumentationen uppdaterad* längst ned).
> Källan finns i repot som `docs/DOCUMENTATION.md`. En kopia finns i Claude-projektet "Discomplete" som `claude/discomplete-dokumentation.md`.
>
> **Senast uppdaterad:** 2026-11-04 · **Guideversion:** 36 · **Senaste migrering:** 0019

---

## 1. Översikt

**Discomplete** är Kevin Wedins app för att lyssna på hela album igen: www.discomplete.com. Man hittar nästa skiva (Today's three), tar sig igenom skivor, diskografier och listor (Challenges, Lists), lyssnar tillsammans (Listening parties) och för en dagbok över varje lyssning: format (Stream, Vinyl eller CD), betyg och anteckningar.

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
| `RESEND_API_KEY`, `PARTY_MAIL_KEY`, `CRON_SECRET`, `MAIL_FROM` | Valfri | Mejl om listening parties (se 4.9g). `PARTY_MAIL_KEY` = samma värde som `party_mail_key` i `app_secrets`. `MAIL_FROM` kräver verifierad domän i Resend |
| `NEXT_PUBLIC_SITE_URL` | Valfri | Länkar i mejl, default https://www.discomplete.com |
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

- **Flikar på mobil (bottenmeny):** en svävande, rundad "pill" med ikoner och små etiketter: **Diary · Discover · + · Listening · You**. Göms på loggsidan, när man redigerar en lyssning och under /welcome. På dator: toppmeny Diary, Discover, Listening, You och knappen "Log a listen".
- **Principen (4 nov): en plats per sak.** Diary = det du har lyssnat på. Discover = nytt att hitta. Listening = det du jobbar dig igenom. You = du själv (recap, profil, samling, inställningar).
- **Listening** (`/listening`) samlar: On the turntable (Last.fm), Listening parties, To listen (5 senaste + "All"; skivor som ligger på turntable visas inte igen här), Challenges (kort med framsteg och dagens pick) och Your lists. Är allt tomt visas i stället ett startblock: Start a listening party · Take on Swedish classics · Find something in Discover. Under fliken ligger även `/to-listen`, `/challenges`, `/lists`, `/parties`.
- **You** (`/you`) samlar: namn, bio och antal lyssningar; "In albums" (recap för denna månad, förra, hela året); "Yours" (profilen, Collection, Settings). Under fliken ligger även `/records`, `/settings`, `/recap`, `/u/…`. Det finns ingen profilikon i sidhuvudet längre.
- **Tillbaka-pil (‹)** i sidhuvudet finns på alla sidor under huvudflikarna:
  - Har man kommit från en annan sida i appen går den dit, som `router.back()`.
  - Har man öppnat sidan direkt går den till sidan ovanför: logg till skiva, utmaning till Challenges, party till Parties, lista till Lists, guide och Last.fm till Settings, To listen/Challenges/Lists/Parties till Listening, Records/Settings/Recap/profil till You, annars Diary.
- **Log-arket** ("+") öppnar sökningen ovanpå den sida man står på och visar "Recently logged".
- **URL:er är läsbara:**
  - `/record/<artist>/<titel>` och `/record/<artist>/<titel>/log`
  - `/artist/<namn>-<deezerId>`
  - `/challenges/<id>` och `/challenges/list/<slug>`
  - `/parties`, `/parties/<id>` och inbjudningar `/parties/join/<kod>` (gamla `/clubs/…` omdirigeras)
  - `/lists`, `/lists/<id>`; `/recap/<ÅÅÅÅ-MM>` och `/recap/<ÅÅÅÅ>` (bild: `/recap/<period>/image`); `/u/<användarnamn>`; `/settings/import`; export `/api/export?format=csv|json`
- `/open/<deezerId>` sparar skivan i katalogen och skickar vidare till skivsidan. Den tar emot `then=log`, `date` och `suggestion`.

---

## 4. Funktioner

### 4.1 Inloggning och kom igång
- Inloggningssidan säger "Listen to whole albums again" med tre albumförslag om dagen, dagbok, utmaningar och ett album i veckan med vänner.
- Inloggning sker med e-postlänk eller 6-siffrig kod. Koden behövs i den installerade appen, där länkar öppnas i webbläsaren.
- **Sign-up-quiz** (`/welcome`, går att hoppa över): man väljer artister man gillar och mål. Det styr Discover direkt.
- **Första minuten** (`/welcome/rate`): efter quizen, och även om man hoppar över den, visas "Rate five albums you like": upp till 18 skivor från de valda artisterna (deras mest kända), annars från Deezers topplista. Stjärnor sparar som Heard before. En fast rad räknar "x of 5 you like" – bara 3★ eller mer räknas, samma regel som låser upp Discover; efter fem: "See my three →" till Discover. "Skip for now" går till dagboken.

### 4.2 Logga en skiva
- **Sökning** via Deezer. Utgåvor som remaster och deluxe slås ihop till en träff.
- **Logg-formuläret** är ett lugnt ark (samma för ny lyssning och redigering):
  - Fast rad överst: **Cancel · Log a listen · Save**. Under: skivans typ och år, titel, artist, "Change record" och omslaget till höger.
  - Stora stjärnor, ett textfält ("What did you think? A line is plenty — or nothing at all."), **How did you listen?** (Stream/Vinyl/CD) och vid första loggningen **First listen / Heard it before**.
  - Rader att trycka upp: **Listened** (Today eller datum), **Favourite tracks** (upp till 3), **Tags**, **Who sees it** (Public / Anonymous / Private) och kryssrutan "I want to hear more from <artist>".
  - "Save to diary" även längst ned. "Listen on"-länkarna visas inte längre på loggsidan (finns på skivsidan).
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
2. **To do-panelen** är det enda ovanför listan. Den är hopfälld, men öppnas av sig själv när det är din tur i ett party eller när Spotify frågar "how was it?". Utan något att betygsätta heter den "Waiting for you". Rubriken säger rakt ut vad som väntar, t.ex. *"2 listens need stars · 2 could use a few words"*, med knappen **Sort it**. Utfälld visar den:
   - **Give these stars:** lyssningar utan betyg, med stjärnor direkt på raden. Betyget sparas direkt.
   - **A few words?:** lyssningar med betyg men utan text, bara från de senaste 14 dagarna. Varje rad har **Write** och **No thanks**, och det finns **Stars are enough for all** för alla på en gång (sätter `entries.no_words`).
   - **Also waiting:** "Your turn in <party>" (veckans album som du inte hört), "▶ On the turntable" (en rad som länkar till Listening), förslag från Spotify ("how was it?"), "Your <månad> in albums is ready" (de första tio dagarna i månaden), och Remember this? eller relisten-påminnelse.
3. **Listan:**
   - Grupperad i *This week*, *Last week*, *Earlier in <månad>* och sedan en rubrik per månad.
   - Äldre månader är hopfällda.
   - Varje grupp har en statistikrad: lyssningar · skivor · vanligaste genrer (från Deezer) · mest spelade artist.
   - **Kompakta rader:** omslag, titel · artist, dag, stjärnor eller "☆ not rated", början av texten. Tryck på raden så fälls hela inlägget ut, med text, favoritlåtar, taggar, Edit och Delete.
   - **Omlyssningar utan eget betyg eller text** visas som en liten streckad rad: `↻ Played again · 3rd listen · ★★★★` med skivans bästa betyg. De räknas inte som att göra.
   - **Badges** i utfällt läge: "☆ Not rated · Rate it" (stjärnorna öppnas på kortet) och "✎ No review yet · Write one". Den andra visas inte om man har valt `no_words`.
4. **Shelf-vyn:** alla skivor man spelat, per månad, som stora omslag med ens stjärnor, titel och artist. Har man spelat en skiva flera gånger samma månad står "2×" på omslaget.
5. **Calendar-vyn:** varje månad som en kalender med måndag först och ett omslag per dag. "+n" visas om flera skivor spelats samma dag. Upp till 12 månader.
6. **Sidokolumnen** (nedanför på mobil): månadssiffror, On repeat this month och Heard before (12 senaste plus "+ Add"). To listen visas inte här längre (finns under Listening).
- **Remember this?** visar en skiva med 4★ eller mer som man inte spelat på 6 veckor eller mer. Den väljs slumpmässigt med vikt och visas en per dag. "Not now" snoozar skivan i 6 månader.
- **Relisten-påminnelse:** en första lyssning med 3★ eller mindre som är minst 14 dagar gammal och aldrig lyssnats om.
- Filtret `?todo=1` visar bara lyssningar som behöver stjärnor eller text.

### 4.4 Skivsidan
- Visar omslag (mindre på mobil), en metarad (typ · år · genre · antal låtar · längd), titel och artist. Knappar: **Log this listen** och **+ To listen** (vanlig storlek).
- **▶ Listen** är en liten knapp som fäller ut Spotify, Apple Music, YouTube Music och Deezer, var och en med en färgprick (inte tjänsternas logotyper). Länkarna är exakta där det går, annars en sökning.
- **Lists** och **In your collection** (Vinyl/CD/Wishlist, små knappar) ligger samlade under en tunn linje.
- **What others think:** betygsrutan visas bara när det finns betyg. Saknas både betyg och publika anteckningar står en kort rad i stället för en tom ruta.
- **Statusruta** om man redan har skivan: "Heard before · no date" eller "In your diary · logged …", alltid två knappar: **Log it** / **Log it again** och **Edit**. Inga ifyllda knappar, eftersom de såg förvalda ut.
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
- **If you like <artist>, you may like…** längst ned: tre skivor, en från vardera tre liknande artister (Deezers relaterade artister, de tio första provas i tur och ordning). För varje artist väljs den mest kända studioskivan som inte finns i din dagbok (Heard before räknas). Klick öppnar skivsidan, "+ To listen" sparar med källan "Similar to <artist>". Varje förslag har snabbstjärnor ("Heard it? Rate it") som sparar skivan som Heard before med betyget; den byts mot ett nytt förslag vid nästa besök. På mobil visas förslagen som rader (omslag till vänster).
- **I want to hear more** följer artisten. Det påverkar Discover och To listen ("More from artists you're exploring").

### 4.6 Discover – Today's three
- **Upplåses** när man har betygsatt 5 skivor med 3★ eller mer, eller valt artister i quizen.
- **Tre förslag per dag** med roller: *safe bet* (nära det man älskar), *sidestep* (ett steg ut, via liknande artist) och *wildcard* (älskat av folk som betygsätter som en, eller en djupare skiva).
  - Smakprofilen bygger på betyg (5★ väger mest), omlyssningar, ägda skivor, följda artister och quizen. Nyare lyssningar väger mer.
  - 1–2★ och "Not for me" trycker ner liknande artister.
  - Källor: Deezers relaterade artister (1–2 steg) och SQL-funktionen `taste_neighbour_picks`.
- **Kortens knappar:** **+ To listen** (fylld) och **✓ Just listened** syns; under **⋯** finns **Heard it before** och **Not for me**. "Log it" finns inte på kortet.
- **Under dagens tre** (bara sådant som är nytt): "If you like <artisten du senast gav 4★ eller mer>, you may like…" (samma tre förslag som på artistsidan) och "More from artists you're exploring" (flyttat hit från To listen).
- Förslagen sparas per dag i `discover_picks`. **Shuffle** finns 3 gånger per dag. **Not for me** byter förslaget och kommer ihåg valet.
- **"✓ Just listened":** stjärnor som loggas som dagens lyssning, eller på den dag Spotify såg skivan. **"Heard it before":** sparas som Heard before och förslaget kan bytas ut.
- **Status på korten:**
  - Lyssnad: orange ram runt hela kortet, "✓ Heard" på omslaget, "✓ Listened today" med stjärnor och "Write about it".
  - Spelas nu: grå streckad ram, "▶ Playing" och "On your turntable · x of y" med en mätare.
- **Genreläget** är byggt (Wikidata) men avstängt. Slås på med `DISCOVER_GENRES=1`.

### 4.7 To listen
- **Started · from Spotify, last 30 days:** påbörjade skivor med "x of y tracks played" och en mätare.
- **Queued:** resten, med källa (t.ex. "Discover · …", "Started on Spotify").

### 4.8 Collection (`/records`)
- Flikar med antal: **Vinyl** (standard), **CD**, **Wishlist** och **Heard before**. Märks på skivsidan. Allt man har spelat finns i dagbokens Shelf-vy, inte här. Nås via You.

### 4.9 Challenges (`/challenges`)
- **Två sorter:**
  - *Complete <artist>:* hela studiodiskografin, startas från artistsidan.
  - *Kurerade listor* (Kevins egna val, i koden i `challenge-lists.ts`): **Swedish classics** (30), **Debuts that changed everything** (30) och **One album a year: 2000–2024** (25). Varje lista kan förhandsvisas ("See the albums") innan man startar den.
- **Framsteg** räknas från dagboken: alla lyssningar och Heard before. En annan utgåva räknas också. Inget bockas av separat.
- **Today's pick:** en slumpad ohörd skiva per utmaning och dag. Den syns under Listening (Challenges-kortet) och på utmaningens sida.
- **"+1"** i dagboken när man nyss bockat av en skiva. "Stop this challenge" tar bort utmaningen men rör inte loggarna.
- Listskivor matchas mot Deezer med `findAlbum(..., { relaxed: true })`. Skivor som inte hittas hoppas över.
- Inga streaks och inget straff, avsiktligt.

### 4.9b Listening parties (`/parties`)
- **Idén:** ett album i veckan som en grupp vänner lyssnar på, var och en i sin egen takt. Socialt kring själva lyssnandet, inte kring profiler. Fungerar helt utan Last.fm.
- **Starta:** namn på klubben → du blir medlem → välj första albumet → dela inbjudningslänken (`/parties/join/<kod>`, knappen Share använder telefonens delningsmeny eller kopierar).
- **Gå med:** öppna länken, eller klistra in länk/kod på `/parties`. Öppnas länken utloggad sparas den i cookien `dc_next` och man skickas tillbaka till inbjudan efter inloggningen.
- **Veckans album:** veckan börjar på måndag. Vem som helst i klubben kan välja veckans album om inget är valt, och nästa veckas. Val görs via sökning eller från ens To listen, med en valfri rad "Why this one?". Den som valde eller den som startade klubben kan ta bort ett val. Finns inget val för veckan visas det senaste albumet tills någon väljer.
- **Vem har lyssnat:** en lyssning (inte Heard before) av albumet från veckans måndag och framåt räknas. Knappen "I've listened — log it" öppnar loggformuläret.
- **Låst tills du hört den:** andras stjärnor och anteckningar syns först när du själv har skivan i dagboken. Privata lyssningar visas bara som "listened".
- **Earlier weeks:** tidigare veckors album. **Leave this club** längst ned.

### 4.9c Listor (`/lists`, kräver 0018)
- Nås via Records → Lists, Challenges ("Make your own list") och skivsidan (raden **Lists**: "On …" och en väljare + **Add**, eller "Start a list").
- **Skapa:** namn → listan öppnas. Lägg till via sökning eller To listen (samma väljare som för parties) med en valfri rad "Why is it here?".
- **Redigera (ägaren):** rad per skiva med anteckningsfält + Save, ↑ ↓ för ordning, × för att ta bort. *List settings*: namn, beskrivning, **Public** (standard på) och **Ranked** (numrering). *Delete this list*. Publika listor har en delningslänk.
- **Andra:** ser "A list by <namn>" (länk till profilen), anteckningarna och "✓ In your diary" på skivor de hört. Överst "You've heard x of y".
- **Take it on as a challenge:** skapar en utmaning med kind `user_list` (ref = listans id). Den beter sig som övriga utmaningar (framsteg från dagboken, Today's pick) och länkar tillbaka till listan.

### 4.9d Recap och delning (`/recap/<period>`)
- Länk längst ned i varje månadssektion i dagboken ("See October in albums · share →", för innevarande månad "This month so far · share →"). Bläddra föregående/nästa månad, "All of <år>".
- Visar album, lyssningar, timmar (albumens längd, 45 min om okänd), dagar med musik, första/omlyssningar, mest spelad artist, "On repeat", genrer, andel vinyl/CD och de bästa skivorna (6 för månad, 9 för år, högst betyg först). Heard before räknas inte.
- **Delningsbild** 1080×1350 (`next/og`): titel, siffror, 6 omslag med stjärnor (ritade som former), "Listen to whole albums again · discomplete.com". **Share** använder telefonens delningsmeny med bilden, annars nedladdning.

### 4.9e Publik profil (`/u/<användarnamn>`, kräver 0018)
- Av som standard. Slås på i Settings → Profile (**Public profile**) tillsammans med en rad om dig (`bio`, max 200 tecken). Länk "See/Preview your public profile".
- Visar: namn, bio, "x albums in the diary · y in <år>", **The last 30 days** (ett omslag per dag), **Working through** (utmaningar med framsteg), **Lately** (10 senaste lyssningar med stjärnor och början av anteckningen) och publika **Lists**.
- **Aldrig med:** privata och anonyma lyssningar. Är profilen inte publik ser andra bara "This profile is private". Du själv ser alltid en förhandsvisning.
- Medvetet *inte* med: favorithylla, rotation, följare, flikar.

### 4.9f Export och import (Settings → Your data)
- **Export:** "Download diary (CSV)" (datum, artist, album, år, betyg, format, sort, anteckning, taggar, privat, deezer_id) och "Download everything (JSON)" (profil, dagbok, To listen, samling, utmaningar, listor).
- **Import** (`/settings/import`): en Rate Your Music-export eller valfri CSV med kolumnerna Artist och Album (valfritt Rating, Date, Review; komma eller semikolon; betyg 0–5 eller 0–10). Filen läses i webbläsaren och skickas i omgångar om 15. Varje rad matchas mot Deezer (`findAlbum`, relaxed).
  - Med datum → en lyssning det datumet. Utan → Heard before. Betyg avrundas till halva stjärnor.
  - Skivor som redan finns i dagboken hoppas över. "Keep imported reviews private" är förvalt.
  - RYM: ägd vinyl/CD → samlingen, "w" → wishlist.
  - Resultat: antal tillagda, redan fanns och inte hittade (med lista).

### 4.9g Mejl om listening parties (valfritt, kräver 0019)
- **Måndagar 06:00 UTC** (Vercel Cron, `vercel.json` → `/api/cron/parties`, skyddad med `CRON_SECRET`): varje medlem får ett mejl per party med veckans album (omslag, vem som valde, raden om varför) eller "No album yet this week — pick one".
- **När någon väljer ett album** (`pickForClub`): de andra medlemmarna får "<namn> picked <album> for this week/next week". Skickas efter svaret (`after`), så valet väntar aldrig på mejlet.
- Mejl skickas via Resend (`src/lib/mail.ts`). Utan `RESEND_API_KEY` och `PARTY_MAIL_KEY` skickas inget och inget går sönder.
- **Säkerhet:** medlemmarnas e-post hämtas med SQL-funktionen `party_mail_list(p_key, …)`, som bara svarar om nyckeln matchar `app_secrets.party_mail_key`. Tabellen `app_secrets` har RLS utan policies och kan inte läsas via API:t. Appen använder fortfarande inte service role-nyckeln.
- **Avstängning:** Settings → Emails → "Listening parties" (`profiles.party_emails`, på som standard). Varje mejl har en rad om hur man stänger av.
- **Inte byggt än:** mejl när alla i partyt har lyssnat.

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

## 4.11 Ordlista (gäller all text i appen)
| Ord | Betyder | Används |
|---|---|---|
| **Heard it? Rate it** | snabbstjärnor på en skiva du känner sedan tidigare, sparas som *Heard before* (utan datum) | sökningen, artistsidan, "You may like", första minuten, utmaningar |
| **Heard before** | samlingen av skivor du kände till innan, utan datum | sidokolumnen, statusrutan på skivsidan |
| **Heard it before** | samma val i Discover och i loggarket | Discover-korten, "Is it new to you?" |
| **Log it** / **Log it again** | öppna loggarket för en lyssning | skivsidan, To listen, Listening, partyn |
| **Edit** | ändra en lyssning du redan loggat | skivsidans statusruta, dagboken |
| **Just listened** | stjärnor direkt på ett Discover-kort, loggas som dagens lyssning | Discover |
| **Done? Rate it** | turntable-skiva du lyssnat klart på | On the turntable |
| **To do** / **Waiting for you** | panelen överst i dagboken | dagboken |

Nya texter ska följa ordlistan. Mono-typsnittet används bara för siffror och datum. Orange ram betyder alltid "klart".

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
| `clubs`, `club_members`, `club_picks` | listening parties (tabellerna heter fortfarande clubs): namn och `invite_code`; medlemmar; ett album per klubb och vecka (`week_start` = måndag, `note`) | 0017 |
| `is_club_member()`, `create_club()`, `join_club()`, `club_by_code()`, `club_week()` | medlemskoll för RLS; skapa/gå med; vad en inbjudan visar; veckans lista över medlemmar med lyssnat, stjärnor och ord (låsta tills du hört skivan, privata dolda) | 0017 |
| `lists`, `list_items` | egna listor (titel, beskrivning, `is_public`, `ranked`); skivor med `position` och `note`. Publika listor läsbara för alla inloggade | 0018 |
| `challenges.kind` | nu även `user_list` (ref = listans id) | 0018 |
| `profiles.is_public`, `profiles.bio` | publik profil av/på och en rad om dig | 0018 |
| `app_secrets` | serverhemligheter (RLS utan policies, oläsbar via API) | 0019 |
| `profiles.party_emails` | mejl om listening parties av/på | 0019 |
| `party_mail_list()`, `party_week_picks()` | e-post per party-medlem och veckans album, bara med serverns nyckel | 0019 |
| `profile_listens()`, `profile_challenges()` | en publik profils lyssningar (utan privata och anonyma) och utmaningar, bara om profilen är publik eller din egen | 0018 |
| `upsert_album()`, `slugify()` | katalog och slugs | 0001, 0002 |
| `album_public_notes()` | publika anteckningar (anonyma utan namn) | 0001, 0003, 0015 |
| `album_stats()` | snitt och fördelning, privata exkluderade, en halva räknas mot stjärnan under | 0001, 0015 |
| `taste_neighbour_picks()` | skivor älskade av folk med liknande smak | 0006 |
| `album_top_tracks()` | Fans' favourite tracks | 0009 |

- **RLS:** allt är privat per användare.
- Andras data når skivsidan bara via `security definer`-funktionerna ovan.
- Koden faller tillbaka snällt om en migrering inte är körd: funktionen syns då inte eller sparas utan den nya kolumnen.

**Alla migreringar (0001–0019) är körda av Kevin. Nyckeln `party_mail_key` sätts separat (SQL 2) och samma värde läggs i Vercel som `PARTY_MAIL_KEY`.**

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
- **Grundkrav finns, men är inte identiteten** (4 nov): export/import, listor, recap och en enkel publik profil. Profilen är en dagbokssida (senaste 30 dagarna, utmaningar, lyssningar, listor), inte ett arkiv.
- **Layout** (4 nov): renare och lugnare, platta listor med tunna linjer i stället för boxar, inspirerat av Record Club men eget: rubriker i normal skrift (inte versaler), sektionsrubriker i fet sans i stället för mono-versaler, mindre knappar (42/36 px), enkolumnssidor centrerade. Ordmärket DISCOMPLETE och mörkt + orange behålls.
- **Allt ska fungera utan Last.fm.** Last.fm och kommande Spotify-synk är bekvämlighet, inte identitet.

## 8. Uppskjutet / väntar
- **Logga och utseende:** Kevin gillar logga **D** (ordmärke där O:et är en skiva). Riktningarna A–F finns på designytan "Discomplete — logo & look" (https://claude.ai/artifact/Cu9yT2aQ6babwUYqLLQtL1). Designsystem: https://claude.ai/artifact/DiLnkpsvZy3KQzRLgGzEZ8.
- Taggar vid betyg ("Grower", "Front to back" …) diskuterades men lades på is.
- **Nästa idéer i den nya riktningen:** "On this day" i dagboken, utmaningar man gör tillsammans, delbart framstegskort ("14 av 30"), välja party-album direkt från skivsidan, valfri starttid för en listening party ("söndag 20:00"), Spotify-synk.
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
| 3 nov | Ny identitet "Listen to whole albums again" (inloggning och appbeskrivning). Listening parties (0017): ett album i veckan med vänner, inbjudningslänk, låsta omdömen tills man hört skivan, kort överst i dagboken. |
| 4 nov | Album clubs → Listening parties (`/parties`). Export (CSV/JSON) och import (RYM/CSV). Egna listor som andra kan ta sig an (0018). Recap per månad/år med delningsbild. Publik profil (0018). Renare layout. |
| 4 nov | Challenges och recap-knuff överst i dagboken; recaplänkar i sidokolumnen. Plattare layout: dagboksrader med linjer i stället för boxar, sidokolumn utan boxar, lugnare sidhuvud. |
| 4 nov | Svävande bottenmeny, loggning som ett lugnt ark, svepbara rader i Discover, glidande bekräftelser, mindre rubriker på mobil (inspirerat av Record Clubs mobilflöde men med vårt innehåll). |
| 4 nov | Artistsidan: "If you like <artist>, you may like…" med tre skivor från liknande artister. |
| 4 nov | Lugnare skivsida: metarad, mindre omslag och knappar, "▶ Listen"-meny i stället för fyra knappar, tomma lägen som en rad. |
| 4 nov | Ny navigering Diary · Discover · + · Listening · You. Listening-hub och You-sida. En plats per sak (dubbletter borttagna). Ordlista: Heard it / Log it. Mono bara för siffror. Första minuten: "Rate five albums you already know". Flödeskarta: https://claude.ai/artifact/VjwBrSYwfiFxBRSR64Kriv |
| 4 nov | Genomgång 2: Rate five räknar 3★+, ingen turntable-dubblett under Listening, Discover-kort med ⋯, Records → Collection, färre recap-ingångar, startblock under Listening, To do öppnas själv, statusrutan Log it/Edit, mejl om listening parties (0019). |

---

## Så hålls dokumentationen uppdaterad
**Varje gång något läggs till, ändras eller tas bort i appen, i samma arbetspass:**
1. Uppdatera **det här dokumentet** (`docs/DOCUMENTATION.md` i repot): rätt avsnitt i kapitel 4, datamodellen om databasen ändrats, miljövariabler, beslut och uppskjutet samt en rad i ändringsloggen. Uppdatera även "Senast uppdaterad", "Guideversion" och "Senaste migrering" överst.
2. **Ladda upp** samma fil till Claude-projektet "Discomplete" som `claude/discomplete-dokumentation.md`, så att hela projektet har tillgång till den.
3. Lägg till en ny version i **ägarguiden** (`src/app/settings/guide/content.ts`, svenska) och justera berörda sektioner.
4. Ny migrering: lägg till den i README:s setup-lista och i tabellen i kapitel 5.
5. Committa och pusha allt tillsammans.
