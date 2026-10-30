// The owner's guide: how Discomplete works right now, plus what changed when.
// Update this whenever a feature changes — add a revision at the top and edit the sections.

export type Revision = { version: number; date: string; changes: string[] };
export type Section = { id: string; title: string; body: string[] };

export const REVISIONS: Revision[] = [
  {
    version: 17,
    date: "2026-10-30",
    changes: [
      "Halva stjärnor: betyg från ½ till 5. Tryck på vänstra halvan av en stjärna för en halv, högra för en hel. Fungerar överallt där du sätter betyg.",
      "Betyg visas som ★★★½☆, och snittbetyget på skivsidan räknar med halvorna. Gamla betyg ligger kvar som de var.",
    ],
  },
  {
    version: 16,
    date: "2026-10-30",
    changes: [
      "Discover visar om du har lyssnat på dagens förslag: “✓ Listened today” (med stjärnor att sätta och “Write about it”) – oavsett om du loggat själv eller Spotify gjort det.",
      "Spelar du ett förslag just nu står det “▶ On your turntable · x of y” med en mätare.",
      "Ny knapp “✓ I’ve listened to it”: sätt stjärnor så loggas det som dagens lyssning. “Knew it already” sparar det som Heard before i stället (och kan byta ut förslaget).",
    ],
  },
  {
    version: 15,
    date: "2026-10-30",
    changes: [
      "En skiva du lyssnar på just nu hamnar direkt på On the turntable med en mätare – även om du nästan är klar. Den räknas som färdig först när du har spelat minst 85 % och sedan pausat i 20 minuter.",
      "Med “Log full albums automatically” loggas skivan först när den är färdig (efter pausen), och dagboken frågar då “how was it?”.",
      "Har en skiva loggats automatiskt för tidigt och du lyssnar fortfarande (utan att ha satt betyg eller skrivit något), plockas loggen bort och skivan flyttas tillbaka till On the turntable.",
      "Knapparna på “how was it?” heter nu: Journal this listen, Review later (väntar längst ned under “Waiting for your review”), Skip review (behåll i dagboken utan betyg och text) och Remove — wasn’t an album listen.",
    ],
  },
  {
    version: 14,
    date: "2026-10-29",
    changes: [
      "Listorna under Challenges går att klicka på innan du startar dem (“See the albums”): du ser alla skivor, vilka du redan hört och hur långt du skulle ha kommit direkt.",
    ],
  },
  {
    version: 13,
    date: "2026-10-29",
    changes: [
      "När en skiva hamnar i dagboken – loggad, betygsatt eller “Heard before” – försvinner den från On the turntable och förslagen. Inget dubbelt längre.",
      "Sätter du stjärnor (t.ex. “Already heard it” i Discover) på en skiva som Spotify ser att du spelar just nu, loggas den som en riktig lyssning på dagen du spelade den – inte som “Heard before”.",
      "Skivsidans ruta för skivor du redan har: knapparna är inte längre ifyllda (de såg förvalda ut). “Played it again” heter nu “Log a new listen”, och “Edit what you wrote” visas om du har skrivit något.",
    ],
  },
  {
    version: 12,
    date: "2026-10-29",
    changes: [
      "Påbörjade skivor hamnar direkt på “On the turntable” – inget “I’m on it” behövs längre. Där finns What’s left, Done? Rate it och Move to To listen.",
      "“Heard enough? Log it anyway” är borttaget. Vill du logga en skiva du inte lyssnat klart på gör du det på skivsidan, eller med “Done? Rate it”.",
      "Under ⋯ på varje skiva på turntable: Hide this, Never suggest this album och Never suggest artisten.",
    ],
  },
  {
    version: 11,
    date: "2026-10-29",
    changes: [
      "På automatiskt loggade skivor heter knappen nu “Remove — wasn’t an album listen”, med tre val: bara ta bort, ta bort och aldrig logga skivan igen, eller ta bort och aldrig logga artisten igen.",
      "Under Settings → Spotify finns “Never logged from Spotify”, där du ser allt du stängt av och kan välja “Allow again”.",
    ],
  },
  {
    version: 10,
    date: "2026-10-29",
    changes: [
      "Skivor som loggas automatiskt från Spotify frågar nu “how was it?” överst i dagboken: sätt stjärnor, “Journal this listen” för att skriva, eller “Review later”.",
      "“Review later” lägger skivan längst ned i dagboken under “Waiting for your review”, där du kan sätta stjärnor eller skriva när du har tid.",
      "“Remove — wasn’t an album listen” tar bort den automatiska loggen ur dagboken (och kan stänga av skivan eller artisten).",
      "“Skip review” behåller lyssningen i dagboken utan betyg eller text och slutar fråga. Finns både överst och under “Waiting for your review”.",
    ],
  },
  {
    version: 9,
    date: "2026-10-29",
    changes: [
      "En skiva räknas som hörd först från 85 % (tidigare 70 %). 12 av 15 låtar är alltså “You started …”, inte en färdig lyssning – och loggas inte automatiskt.",
      "Tar du bort en lyssning som kom från Spotify blir den ett förslag igen (t.ex. “You started …”) i stället för att försvinna.",
      "Förslagen i dagboken: tryck på omslaget eller titeln för skivsidan. “See what’s left” (och “What’s left” på On the turntable) går direkt till låtlistan med bockar.",
    ],
  },
  {
    version: 8,
    date: "2026-10-29",
    changes: [
      "Skivor du hört lite i taget räknas nu: har du under de senaste två veckorna spelat minst hälften av en skivas låtar (och minst 4), i vilken ordning och vid hur många tillfällen som helst, dyker den upp i dagboken.",
    ],
  },
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
      "Sök fram skivan, öppna den och tryck “Log this listen”. Välj datum, format (Stream, Vinyl eller CD), stjärnor (halva går också – tryck på vänstra halvan) och skriv gärna en anteckning.",
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
      "“✓ I’ve listened to it” loggar förslaget som dagens lyssning med stjärnor; “Knew it already” sparar det som Heard before. Har du lyssnat (själv eller via Spotify) visar kortet “✓ Listened today”.",
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
      "När du har spelat minst 40 % av en skiva (och minst 5 låtar) – eller 3 låtar i rad i skivans ordning, eller hälften av skivan utspritt över två veckor – föreslår dagboken den, cirka 20 minuter efter sista låten – direkt om du spelat 90 %. Från 85 % står det “Looks like you listened to …” – sätt stjärnor så loggas den på rätt dag.",
      "Har du bara börjat hamnar skivan direkt under “On the turntable” med en mätare. Därifrån: “What’s left” (låtlistan), “Done? Rate it”, “Move to To listen”, och under ⋯ Hide this / Never suggest.",
      "Från 90 % – eller 85 % följt av en paus på 20 minuter – räknas den som klar och appen frågar hur den var. Ligger den orörd i tre dagar flyttas den till To listen.",
      "Har du spelat minst 85 % av en skiva i To listen frågar dagboken hur den var. To listen visar påbörjade skivor överst under “Started”, och skivsidans låtlista har bockar för det du har spelat. Saknas en låt trycker du på ringen och bockar i den själv.",
      "Med “Log full albums automatically” påslaget loggas hela skivor direkt – dagboken frågar sedan “how was it?”. Välj stjärnor, “Journal this listen”, “Skip review” (behåll utan betyg) eller “Review later” (hamnar under “Waiting for your review” längst ned).",
      "“Not an album listen” på förslag stänger av förslag för en skiva eller en artist. Allt avstängt syns under Settings → “Never logged from Spotify”, där du kan slå på det igen. Utan Last.fm syns inget av detta.",
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
