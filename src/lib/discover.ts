// Server-only: "Discover" suggestions from the records you rated 3★ or more.
import { baseTitle, getArtistAlbums, getRelatedArtists } from "@/lib/deezer";

export const UNLOCK_AT = 5; // distinct records rated 3★+
const SEED_ARTISTS = 10; // how many liked artists to look outward from
const SUGGESTIONS = 12;

export type LikedRecord = { rating: number; artist: string; deezer_artist_id: number | null; deezer_id: number | null; title: string };
export type KnownRecord = { deezer_id: number | null; title: string; deezer_artist_id: number | null };

export type Suggestion = {
  artistId: number;
  artist: string;
  deezerId: number;
  title: string;
  year: number | null;
  cover: string;
  because: string[];
};

/**
 * 1. Take the artists you rated highest (3★ = 1 point, 4★ = 2, 5★ = 3).
 * 2. Ask Deezer for artists similar to each; nearer the top of that list counts more.
 * 3. Drop artists you've already logged or are exploring, and records you've logged or queued.
 * 4. For the best-scoring artists, suggest their most popular studio album.
 */
export async function buildSuggestions(
  liked: LikedRecord[],
  known: KnownRecord[],
  excludeArtistIds: Set<number>
): Promise<Suggestion[]> {
  const seeds = new Map<number, { name: string; weight: number }>();
  for (const r of liked) {
    if (!r.deezer_artist_id || r.rating < 3) continue;
    const weight = r.rating - 2;
    const cur = seeds.get(r.deezer_artist_id);
    if (!cur || weight > cur.weight) seeds.set(r.deezer_artist_id, { name: r.artist, weight });
  }
  const topSeeds = [...seeds.entries()].sort((a, b) => b[1].weight - a[1].weight).slice(0, SEED_ARTISTS);

  const relatedLists = await Promise.all(topSeeds.map(([id]) => getRelatedArtists(id).catch(() => [])));

  const scores = new Map<number, { name: string; score: number; because: Map<string, number> }>();
  topSeeds.forEach(([seedId, seed], i) => {
    relatedLists[i].forEach((a, pos) => {
      if (a.id === seedId || seeds.has(a.id) || excludeArtistIds.has(a.id)) return;
      const add = seed.weight * (1 - pos / 25);
      const cur = scores.get(a.id) ?? { name: a.name, score: 0, because: new Map() };
      cur.score += add;
      cur.because.set(seed.name, (cur.because.get(seed.name) ?? 0) + add);
      scores.set(a.id, cur);
    });
  });

  const knownIds = new Set(known.map((k) => k.deezer_id));
  const knownTitles = new Set(known.map((k) => `${k.deezer_artist_id}|${baseTitle(k.title)}`));
  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, SUGGESTIONS + 4);

  const picks = await Promise.all(
    ranked.map(async ([artistId, s]) => {
      const albums = await getArtistAlbums(artistId).catch(() => []);
      const album = albums.find((a) => !knownIds.has(a.deezerId) && !knownTitles.has(`${artistId}|${baseTitle(a.title)}`));
      if (!album) return null;
      const because = [...s.because.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([name]) => name);
      return { artistId, artist: s.name, deezerId: album.deezerId, title: album.title, year: album.year, cover: album.cover, because };
    })
  );
  return picks.filter((p): p is Suggestion => !!p).slice(0, SUGGESTIONS);
}
