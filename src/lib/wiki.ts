// Server-only: a short artist intro from English Wikipedia (free, no key).
// Cached for 30 days per artist. Returns null if no page clearly about a music act is found.

const BASE = process.env.WIKIPEDIA_API_BASE ?? "https://en.wikipedia.org";
const MONTH = 60 * 60 * 24 * 30;
const HEADERS = { "User-Agent": "Discomplete/1.0 (https://www.discomplete.com)", Accept: "application/json" };
const MUSIC =
  /\b(band|musician|singer|rapper|songwriter|singer-songwriter|duo|trio|group|composer|dj|record producer|vocalist|guitarist|pianist|drummer|ensemble|orchestra|quartet|supergroup|music project|recording artist|hip hop|rock|pop|metal|jazz)\b/i;

type Summary = {
  type?: string;
  title: string;
  description?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
};
export type ArtistBio = { text: string; url: string };

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, next: { revalidate: MONTH }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const summary = (title: string) =>
  getJson<Summary>(`${BASE}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`);

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s*\(.*\)\s*$/, "").replace(/[^a-z0-9]+/g, " ").trim();

function isAbout(s: Summary | null, name: string): s is Summary & { extract: string } {
  if (!s || s.type !== "standard" || !s.extract) return false;
  if (norm(s.title) !== norm(name) && !norm(s.title).startsWith(norm(name))) return false;
  return MUSIC.test(`${s.description ?? ""} ${s.extract.slice(0, 280)}`);
}

/** First two or three sentences, at most ~420 characters. */
function shorten(text: string) {
  const sentences = text.replace(/\s+/g, " ").match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text];
  let out = "";
  for (const s of sentences) {
    if (out && out.length + s.length > 420) break;
    out += s;
    if (out.length > 260) break;
  }
  return (out || text.slice(0, 420)).trim();
}

export async function getArtistBio(name: string): Promise<ArtistBio | null> {
  const candidates = [name, `${name} (band)`, `${name} (musician)`, `${name} (singer)`, `${name} (rapper)`, `${name} (group)`];
  const results = await Promise.all(candidates.map(summary));
  let hit = results.find((s) => isAbout(s, name)) ?? null;

  if (!hit) {
    // Last try: a search, e.g. for names whose page has a different qualifier.
    type R = { query?: { search?: { title: string }[] } };
    const r = await getJson<R>(`${BASE}/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=${encodeURIComponent(`${name} music`)}`);
    for (const t of r?.query?.search ?? []) {
      if (!norm(t.title).startsWith(norm(name))) continue;
      const s = await summary(t.title);
      if (isAbout(s, name)) {
        hit = s;
        break;
      }
    }
  }
  if (!isAbout(hit, name)) return null;
  return {
    text: shorten(hit.extract),
    url: hit.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, "_"))}`,
  };
}
