// Server-only: Discover by genre — three records within a genre, picked like "Today's three".
// The genre catalogue comes from Wikidata (free, no key): albums tagged with the genre,
// ranked by how widely they're covered (number of Wikipedia language editions). Each pick
// is then matched to Deezer for cover art, links and logging.
import { findAlbum, getRelatedArtists } from "@/lib/deezer";
import { baseTitle } from "@/lib/deezer";
import { rng, tasteProfile, weightedPick, type Exclude, type Pick, type Signals, type Slot } from "@/lib/discover";
import { slugify } from "@/lib/format";

/** Genre picks are switched off until they've been tried against real Wikidata. Set DISCOVER_GENRES=1 to turn them on. */
export const GENRES_ENABLED = process.env.DISCOVER_GENRES === "1";

export type Genre = { slug: string; name: string; labels: string[] };

const g = (name: string, ...more: string[]): Genre => ({ slug: slugify(name), name, labels: [name.toLowerCase(), ...more] });

/** Shown as quick picks. Any other genre can be typed in. */
export const GENRES: Genre[] = [
  g("Progressive rock", "prog rock"),
  g("Psychedelic rock"),
  g("Hard rock"),
  g("Classic rock"),
  g("Alternative rock"),
  g("Indie rock"),
  g("Indie pop"),
  g("Post-punk"),
  g("Punk rock", "punk"),
  g("Grunge"),
  g("Shoegaze"),
  g("Dream pop"),
  g("Post-rock"),
  g("Krautrock"),
  g("Heavy metal"),
  g("Thrash metal"),
  g("Progressive metal"),
  g("Black metal"),
  g("Doom metal"),
  g("Stoner rock"),
  g("Folk rock"),
  g("Folk", "folk music"),
  g("Americana"),
  g("Country", "country music"),
  g("Singer-songwriter"),
  g("Synth-pop", "synthpop"),
  g("New wave", "new wave music"),
  g("Pop", "pop music"),
  g("Art pop"),
  g("Soul", "soul music"),
  g("Funk"),
  g("R&B", "rhythm and blues", "contemporary r&b"),
  g("Disco"),
  g("Jazz"),
  g("Jazz fusion"),
  g("Blues", "blues music"),
  g("Hip hop", "hip-hop", "hip hop music"),
  g("Trip hop"),
  g("Electronic", "electronic music"),
  g("House", "house music"),
  g("Techno"),
  g("Ambient", "ambient music"),
  g("IDM", "intelligent dance music"),
  g("Drum and bass"),
  g("Reggae"),
  g("Afrobeat"),
  g("Bossa nova"),
  g("Classical", "classical music"),
];

export function genreFromSlug(slug: string): Genre | null {
  const known = GENRES.find((x) => x.slug === slug);
  if (known) return known;
  const words = slug.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  if (!/^[a-z0-9 &]{2,40}$/.test(words)) return null;
  return { slug, name: words.charAt(0).toUpperCase() + words.slice(1), labels: [words, words.replace(/ /g, "-")] };
}

// ─────────────────────────────────────────────────────────────
// Wikidata
// ─────────────────────────────────────────────────────────────
const SPARQL = process.env.WIKIDATA_SPARQL ?? "https://query.wikidata.org/sparql";
const MONTH = 60 * 60 * 24 * 30;
type Row = { album: string; title: string; artist: string; year: number | null; links: number };

export async function genreCatalogue(genre: Genre): Promise<Row[]> {
  const labels = [...new Set(genre.labels)].map((l) => JSON.stringify(l) + "@en").join(" ");
  // Studio albums (or albums) whose genre is the named genre, best-covered first.
  const query = `SELECT DISTINCT ?album ?albumLabel ?artistLabel ?date ?links WHERE {
  VALUES ?label { ${labels} }
  { ?genre rdfs:label ?label } UNION { ?genre skos:altLabel ?label }
  VALUES ?type { wd:Q482994 wd:Q208569 }
  ?album wdt:P136 ?genre ; wdt:P31 ?type ; wdt:P175 ?artist ; wikibase:sitelinks ?links .
  OPTIONAL { ?album wdt:P577 ?date }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
} ORDER BY DESC(?links) LIMIT 400`;
  type R = { results?: { bindings?: Record<string, { value: string }>[] } };
  let json: R | null = null;
  try {
    const res = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": "Discomplete/1.0 (https://www.discomplete.com)" },
      next: { revalidate: MONTH },
      signal: AbortSignal.timeout(9000),
    });
    if (res.ok) json = (await res.json()) as R;
  } catch {
    json = null;
  }
  const seen = new Map<string, Row>();
  for (const b of json?.results?.bindings ?? []) {
    const title = b.albumLabel?.value ?? "";
    const artist = b.artistLabel?.value ?? "";
    if (!title || !artist || /^Q\d+$/.test(title) || /^Q\d+$/.test(artist)) continue; // no English name
    const key = b.album.value;
    if (seen.has(key)) continue;
    const year = b.date?.value ? parseInt(b.date.value.slice(0, 4), 10) : NaN;
    seen.set(key, { album: key, title, artist, year: Number.isFinite(year) ? year : null, links: Number(b.links?.value ?? 0) });
  }
  return [...seen.values()];
}

// ─────────────────────────────────────────────────────────────
// Three within a genre
// ─────────────────────────────────────────────────────────────
const loose = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * safe bet — in the genre and close to your taste (an artist you love, or one similar to them)
 * sidestep — one of the genre's classics you haven't heard
 * wildcard — a lesser-known record from the genre
 */
export async function buildGenreThree(s: Signals, genre: Genre, seed: string, exclude: Exclude, only?: Slot[]): Promise<{ picks: Pick[]; empty: boolean }> {
  const catalogue = await genreCatalogue(genre);
  if (!catalogue.length) return { picks: [], empty: true };
  const rand = rng(seed);
  const slots = only ?? (["safe", "sidestep", "wildcard"] as Slot[]);

  const taste = tasteProfile(s);
  const loved = [...taste.values()].filter((t) => t.weight > 0).sort((a, b) => b.weight - a.weight).slice(0, 10);
  const lovedByName = new Map(loved.map((t) => [loose(t.name), t]));
  const dislikedNames = new Set([...taste.values()].filter((t) => t.weight < 0).map((t) => loose(t.name)));
  const nearByName = new Map<string, { score: number; root: (typeof loved)[number] }>();
  const lists = await Promise.all(loved.map((t) => getRelatedArtists(t.id).catch(() => [])));
  loved.forEach((t, i) =>
    lists[i].forEach((a, pos) => {
      const k = loose(a.name);
      const cur = nearByName.get(k);
      const add = t.weight * (1 - pos / 25);
      if (!cur) nearByName.set(k, { score: add, root: t });
      else cur.score += add;
    })
  );

  const knownTitles = new Set([...s.entries.map((e) => e.album), ...s.queued].map((a) => `${loose(a.artist)}|${baseTitle(a.title)}`));
  const dismissedIds = new Set(s.dismissed.map((d) => d.deezer_id));
  const usable = catalogue.filter((r) => !knownTitles.has(`${loose(r.artist)}|${baseTitle(r.title)}`) && !dislikedNames.has(loose(r.artist)));

  const usedArtists = new Set<string>();
  const picks: Pick[] = [];
  const take = async (pool: (Row & { score: number })[], slot: Slot, reason: (r: Row) => string, n: number) => {
    let options = pool.filter((r) => !usedArtists.has(loose(r.artist)));
    for (let tries = 0; tries < 6 && options.length; tries++) {
      const r = weightedPick(options, rand, n);
      if (!r) return false;
      options = options.filter((o) => o !== r);
      const found = await findAlbum(r.artist, r.title).catch(() => null);
      if (!found || dismissedIds.has(found.deezerId) || exclude.deezerIds.has(found.deezerId) || exclude.artistIds.has(found.artistId)) continue;
      if (s.recentArtistIds.has(found.artistId) && slot !== "safe") continue;
      usedArtists.add(loose(r.artist));
      picks.push({ slot, deezerId: found.deezerId, artistId: found.artistId, artist: found.artist, title: found.title, year: r.year, cover: found.cover, reason: reason(r) });
      return true;
    }
    return false;
  };

  const rank = (r: Row) => Math.log2(2 + r.links);
  if (slots.includes("safe")) {
    const close = usable
      .map((r) => {
        const k = loose(r.artist);
        const love = lovedByName.get(k);
        const near = nearByName.get(k);
        return { ...r, score: (love ? love.weight * 2 : 0) + (near?.score ?? 0) > 0 ? ((love ? love.weight * 2 : 0) + (near?.score ?? 0)) * rank(r) : 0 };
      })
      .sort((a, b) => b.score - a.score);
    const reason = (r: Row) => {
      const k = loose(r.artist);
      const love = lovedByName.get(k);
      if (love) return love.best ? `You gave ${love.best.title} ${love.best.rating}★ — here's more ${genre.name.toLowerCase()} from them` : `${genre.name} from an artist you love`;
      const near = nearByName.get(k);
      return near ? `${genre.name} close to ${near.root.name}` : `A ${genre.name.toLowerCase()} favourite`;
    };
    const ok = await take(close, "safe", reason, 6);
    if (!ok) await take(usable.slice(0, 12).map((r) => ({ ...r, score: rank(r) })), "safe", () => `A great place to start with ${genre.name.toLowerCase()}`, 12);
  }
  if (slots.includes("sidestep")) {
    await take(usable.slice(0, 25).map((r) => ({ ...r, score: rank(r) })), "sidestep", () => `A ${genre.name.toLowerCase()} classic you haven't logged`, 25);
  }
  if (slots.includes("wildcard")) {
    const deeper = usable.slice(25, 200).map((r) => ({ ...r, score: 1 }));
    const ok = await take(deeper, "wildcard", () => `A lesser-known ${genre.name.toLowerCase()} record`, 200);
    if (!ok) await take(usable.map((r) => ({ ...r, score: 1 })), "wildcard", () => `A wildcard from ${genre.name.toLowerCase()}`, usable.length);
  }
  return { picks: (["safe", "sidestep", "wildcard"] as Slot[]).flatMap((sl) => picks.filter((p) => p.slot === sl)), empty: false };
}
