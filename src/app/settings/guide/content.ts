// The owner's guide: how Discomplete works right now, plus what changed when.
// Update this whenever a feature changes — add a revision at the top and edit the sections.

export type Revision = { version: number; date: string; changes: string[] };
export type Section = { id: string; title: string; body: string[] };

export const REVISIONS: Revision[] = [
  {
    version: 7,
    date: "2026-10-29",
    changes: [
      "En påbörjad skiva upptäcks tidigare: spelar du minst 3 låtar i rad i skivans egen ordning (1, 2, 3 …) dyker “You started …” upp i dagboken, även om det är under 40 %.",
      "Låtar från samma skiva i blandad ordning (shuffle, spellistor) räknas fortfarande först från 40 %.",
    ],
  },
  {
    version: 6,
    date: "2026-10-29",
    changes: [
      "Nytt: Challenges. Fullborda en artist (“Complete it” på artistsidan) eller beta av en lista: Swedish classics, Debuts that changed everything och One album a year: 2000–2024.",
      "Allt i dagboken räknas, även “Heard before”, så skivor du redan hört bockas av direkt.",
      "Varje utmaning drar en skiva om dagen (“Today’s pick”). Den syns i dagboken, i Discover och överst i To listen. Sätt stjärnor direkt om du redan kan den.",
      "Skivsidan visar vilka utmaningar skivan ingår i (“Part of”), och dagboken visar “+1” när du nyss bockat av en.",
      "Hittas från dagboken, Records-sidan och /challenges. Inga streaks, ingen stress.",
    ],
  },
  {
    version: 5,
    date: "2026-10-29",
    changes: [
      "Förslag från Spotify kommer snabbare: appen väntar 20 minuter efter sista låten (tidigare 45) och kollar Last.fm var 10:e minut (tidigare 20). Har du spelat minst 90 % av skivan föreslås den direkt.",
      "En skiva på On the turntable räknas som klar när du har spelat 70 % och sedan pausat i 20 minuter (tidigare ett dygn).",
      "Har du valt “I’ll get back to it” eller “Not now” och sedan lyssnar igenom hela skivan en annan gång, föreslås den igen – tidigare blockerades den i en vecka.",
      "Skivor i To listen som du har spelat minst 70 % av – över flera tillfällen, eller med låtar du bockat i själv – dyker upp i dagboken som “You finished … — how was it?”.",
    ],
  },
  {
    version: 4,
    date: "2026-10-29",
    changes: [
      "Koppla Spotify är nu en guide i tre steg under Settings, med knappar som öppnar rätt sida på Last.fm direkt.",
      "När du har kopplat visar appen “✓ It’s working” och vad du spelar just nu (eller senast). Har inget dykt upp än står det “Waiting for your first song…” och appen kollar själv igen var 20:e sekund.",
      "Är din lyssning dold på Last.fm säger appen det och länkar till rätt inställning.",
    ],
  },
  {
    version: 3,
    date: "2026-10-29",
    changes: [
      "Låtlistan på skivsidan: tryck på ringen vid en låt för att markera den som spelad själv – om Last.fm missade den eller du hörde den någon annanstans. Tryck igen för att ångra.",
      "Dina egna markeringar räknas med i “x of y played”, i To listen och på On the turntable. Bockar från Last.fm går inte att ta bort.",
    ],
  },
  {
    version: 2,
    date: "2026-10-29",
    changes: [
      "“Add albums you already know” (tidigare “Add your most played albums”) visar bara skivor du har spelat ungefär hela – minst lika många spelningar som skivan har låtar, och minst 5. Två låtar från en skiva räcker inte längre.",
      "Skivor du redan har i dagboken ligger nu under “Already in your diary” med ditt betyg, i stället för att visa “Tap to rate” igen.",
      "Antalet heter nu “track plays”, eftersom Last.fm räknar spelade låtar, inte hela skivor.",
      "Ordet “shelf” är borta. Skivor utan datum hamnar under “Heard before” i dagboken, och det står nu så överallt (“Added to Heard before”).",
    ],
  },
  {
    version: 1,
    date: "2026-10-29",
    changes: [
      "Guiden finns nu i appen, under Settings, och syns bara för ditt konto.",
      "To listen: skivor du har börjat lyssna på (via Last.fm) ligger överst under “Started”, med “x of y tracks played”.",
      "Skivsidan: låtlistan visar en bock för låtar du har spelat på Spotify.",
      "Turntable: “Put it back” heter nu “Move to To listen” och visar en bekräftelse.",
      "Förslag från Spotify dyker upp från 40 % av skivan (tidigare 70 %).",
    ],
  },
];

export const SECTIONS: Section[] = [
  {
    id: "start",
    title: "Kom igång",
    body: [
      "Skapa konto på www.discomplete.com och välj några artister du gillar i den korta quizen. De styr dina tips i Discover direkt.",
      "Lägg appen på hemskärmen: iPhone – Safari → Dela → “Lägg till på hemskärmen”. Android – Chrome → ⋮ → “Installera app”.",
      "Under Settings → Public profile väljer du namnet som står under dina publika anteckningar.",
    ],
  },
  {
    id: "log",
    title: "Logga en skiva",
    body: [
      "Sök fram skivan, öppna den och tryck “Log this listen”. Välj datum, format (Stream, Vinyl eller CD), stjärnor och skriv gärna en anteckning.",
      "Lyssnat för länge sedan och minns inte när? Välj “Heard it before” – då hamnar den under “Heard before” i dagboken, utan datum. Med en anteckning syns den också i dagboken.",
      "Snabbt läge: i sökningen och på artistsidan kan du sätta stjärnor direkt under en skiva utan att öppna den.",
      "Välj upp till tre favoritlåtar per lyssning om du vill. Skivsidan visar sedan “Fans’ favourite tracks”.",
      "Har du redan loggat skivan visar skivsidan ditt betyg i stället för “Log this listen”. Du kan alltid lägga till en ny lyssning.",
    ],
  },
  {
    id: "notes",
    title: "Anteckningar och översättning",
    body: [
      "Anteckningar är publika som standard. Välj Private för att bara du ska se den, eller Anonymous för att visa den utan ditt namn.",
      "Publika anteckningar översätts automatiskt till engelska så att fler kan läsa dem. Privata anteckningar skickas aldrig för översättning.",
    ],
  },
  {
    id: "discover",
    title: "Discover – dagens tre",
    body: [
      "Varje dag får du tre skivor: ett säkert kort, ett sidosteg och ett vilt kort. De bygger på dina betyg, omlyssningar, skivor du äger, artister du följer och quizen.",
      "Shuffle ger tre nya (några gånger per dag). “Not for me” byter ut ett tips och kommer ihåg det.",
      "“Already heard it” låter dig sätta betyg direkt – tipset byts mot ett nytt.",
      "Tryck på omslaget eller titeln för skivan, och på artistnamnet för artistsidan. “+ To listen” sparar den i din lista.",
    ],
  },
  {
    id: "diary",
    title: "Dagboken",
    body: [
      "Startsidan är din dagbok med alla lyssningar i datumordning.",
      "“Remember this?” påminner då och då om skivor du gett 4★ eller mer, så att du kan lyssna igen eller skjuta upp påminnelsen.",
    ],
  },
  {
    id: "lastfm",
    title: "Spotify via Last.fm (valfritt)",
    body: [
      "Under Settings → Spotify finns tre steg med knappar: skapa ett gratiskonto på Last.fm, koppla Spotify där (Applications → Spotify Scrobbling → Connect) och skriv in ditt Last.fm-namn. Därefter visar appen “✓ It’s working” och vad du spelar.",
      "“Add albums you already know” under Settings listar skivor du har spelat ungefär hela genom åren. Sätt stjärnor så hamnar de under “Heard before”.",
      "När du har spelat minst 40 % av en skiva (och minst 5 låtar) – eller 3 låtar i rad i skivans ordning – föreslår dagboken den, cirka 20 minuter efter sista låten – direkt om du spelat 90 %. Från 70 % står det “Looks like you listened to …” – sätt stjärnor så loggas den på rätt dag.",
      "Har du bara börjat står det “You started …”. Välj “I’m on it” så hamnar den under “On the turntable” med en mätare, eller “I’ll get back to it” så flyttas den till To listen.",
      "Från 90 % – eller 70 % följt av en paus på 20 minuter – räknas den som klar och appen frågar hur den var. Ligger den orörd i tre dagar flyttas den till To listen.",
      "Har du spelat minst 70 % av en skiva i To listen frågar dagboken hur den var. To listen visar påbörjade skivor överst under “Started”, och skivsidans låtlista har bockar för det du har spelat. Saknas en låt trycker du på ringen och bockar i den själv.",
      "“Not an album listen” stänger av förslag för en skiva eller en artist. Utan Last.fm syns inget av detta.",
    ],
  },
  {
    id: "challenges",
    title: "Challenges",
    body: [
      "Två sorter: fullborda en artist – tryck “Complete it” på artistsidan – eller starta en av våra listor under Challenges (länk från dagboken och Records).",
      "Allt i dagboken räknas, även “Heard before”. En annan utgåva av samma skiva räknas också.",
      "Varje utmaning drar en skiva om dagen, “Today’s pick”. Den visas i dagboken, i Discover och i To listen och byts när du har loggat den. Kan du den redan sätter du stjärnor direkt.",
      "Skivsidan visar “Part of” med de utmaningar skivan ingår i. “Stop this challenge” längst ned på utmaningens sida tar bort den – dina loggar påverkas inte.",
    ],
  },
  {
    id: "artist",
    title: "Artistsidan",
    body: [
      "Bild, en kort text från Wikipedia och alla skivor. Följ artisten för att påverka dina tips, och sätt snabbt betyg på skivor du redan har hört.",
    ],
  },
];
