// The owner's guide: how Discomplete works right now, plus what changed when.
// Update this whenever a feature changes — add a revision at the top and edit the sections.

export type Revision = { version: number; date: string; changes: string[] };
export type Section = { id: string; title: string; body: string[] };

export const REVISIONS: Revision[] = [
  {
    version: 2,
    date: "2026-10-29",
    changes: [
      "“Add albums you already know” (tidigare “Add your most played albums”) visar bara skivor du har spelat ungefär hela – minst lika många spelningar som skivan har låtar, och minst 5. Två låtar från en skiva räcker inte längre.",
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
      "Skapa ett gratiskonto på last.fm, koppla Spotify under Last.fm → Settings → Applications, och skriv sedan ditt Last.fm-namn under Settings här i appen.",
      "“Add albums you already know” under Settings listar skivor du har spelat ungefär hela genom åren. Sätt stjärnor så hamnar de under “Heard before”.",
      "När du har spelat minst 40 % av en skiva (och minst 5 låtar) föreslår dagboken den. Från 70 % står det “Looks like you listened to …” – sätt stjärnor så loggas den på rätt dag.",
      "Har du bara börjat står det “You started …”. Välj “I’m on it” så hamnar den under “On the turntable” med en mätare, eller “I’ll get back to it” så flyttas den till To listen.",
      "Från 90 % räknas den som klar och appen frågar hur den var. Ligger den orörd i tre dagar flyttas den till To listen.",
      "To listen visar påbörjade skivor överst under “Started”, och skivsidans låtlista har bockar för det du har spelat.",
      "“Not an album listen” stänger av förslag för en skiva eller en artist. Utan Last.fm syns inget av detta.",
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
