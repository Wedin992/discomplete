// Server-only: Discover — "Today's three" (and the genre version in genre.ts).
//
// Everything starts from a taste profile built from what the app already knows about you:
//   + ratings (5★ counts most), relistens, records you own, artists you follow ("I want to
//     hear more") or picked in the sign-up quiz — with recent listening weighing more;
//   − 1–2★ ratings and "Not for me", which push similar artists down.
// Three picks, each with its own role:
//   safe bet  — an artist close to the ones you love most, their best-known record
//   sidestep  — one step further out (similar to a similar artist)
//   wildcard  — loved by people who rate like you, or a deeper cut from the edges of your taste
import { baseTitle, getArtistAlbums, getRelatedArtists, type RelatedArtist } from "@/lib/deezer";

export const UNLOCK_AT = 5; // distinct records rated 3★+
export const SHUFFLES_PER_DAY = 3;
export const SLOTS = ["safe", "sidestep", "wildcard"] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_LABEL: Record<Slot, string> = { safe: "Safe bet", sidestep: "Sidestep", wildcard: "Wildcard" };

export type Pick = {
  slot: Slot;
  deezerId: number;
  artistId: number;
  artist: string;
  title: string;
  year: number | null;
  cover: string;
  reason: string;
};

type AlbumRef = { deezer_id: number | null; deezer_artist_id: number | null; artist: string; title: string };
export type Signals = {
  today: string; // YYYY-MM-DD (Stockholm)
  entries: { rating: number | null; kind: string; listened_on: string; album: AlbumRef }[];
  owned: AlbumRef[];
  exploring: { deezer_artist_id: number; artist: string }[];
  favourites: { deezer_artist_id: number; artist: string }[];
  queued: AlbumRef[];
  dismissed: { deezer_id: number; deezer_artist_id: number | null; created_at: string }[];
  recentArtistIds: Set<number>; // shown in the last week — not repeated
  neighbours: { deezer_id: number; deezer_artist_id: number | null; artist: string; title: string; cover: string | null; release_year: number | null; fans: number; score: number }[];
};

export type Taste = {
  id: number;
  name: string;
  weight: number; // > 0 loved, < 0 not for you
  best?: { title: string; rating: number }; // the record that says it best
  source: "rating" | "follow" | "quiz" | "owned";
};

const DAY = 86400000;
const DISMISS_DAYS = 120;

// ─────────────────────────────────────────────────────────────
// Taste profile
// ─────────────────────────────────────────────────────────────
export function tasteProfile(s: Signals): Map<number, Taste> {
  const now = Date.parse(s.today);
  const taste = new Map<number, Taste>();
  const add = (id: number | null, name: string, w: number, source: Taste["source"], best?: Taste["best"]) => {
    if (!id) return;
    const cur = taste.get(id) ?? { id, name, weight: 0, source };
    cur.weight += w;
    if (best && (!cur.best || best.rating > cur.best.rating)) cur.best = best;
    if (source === "rating" || !cur.source) cur.source = source;
    taste.set(id, cur);
  };

  for (const e of s.entries) {
    const r = e.rating;
    let w = r == null ? 0.3 : ({ 1: -2, 2: -1, 3: 1, 4: 2, 5: 3 } as Record<number, number>)[r] ?? 0;
    if ((e.kind === "relisten" || e.kind === "before") && w > 0) w += 1; // coming back to a record, or an old favourite: a strong signal
    // A record known from before Discomplete counts as taste, not as recent listening.
    const age = e.kind === "before" ? 365 : Math.max(0, (now - Date.parse(e.listened_on)) / DAY);
    w *= 0.5 + 0.5 * Math.exp(-age / 180); // what you've played lately counts more
    add(e.album.deezer_artist_id, e.album.artist, w, "rating", r && r >= 3 ? { title: e.album.title, rating: r } : undefined);
  }
  for (const o of s.owned) add(o.deezer_artist_id, o.artist, 1, "owned");
  for (const x of s.exploring) add(x.deezer_artist_id, x.artist, 2, "follow");
  for (const f of s.favourites) add(f.deezer_artist_id, f.artist, 2, "quiz");
  // Several records by one artist add up, but one artist shouldn't drown out everyone else.
  for (const t of taste.values()) t.weight = Math.max(-6, Math.min(8, t.weight));
  return taste;
}

export function tasteReason(t: Taste) {
  if (t.best) return `Because you gave ${t.best.title} ${t.best.rating}★`;
  if (t.source === "follow") return `Because you're exploring ${t.name}`;
  if (t.source === "owned") return `Because you own ${t.name} records`;
  return `Because you love ${t.name}`;
}

// ─────────────────────────────────────────────────────────────
// Seeded randomness: the same day gives the same three; a shuffle gives new ones.
// ─────────────────────────────────────────────────────────────
export function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted random pick among the top `n` (higher score = likelier, but never certain). */
export function weightedPick<T extends { score: number }>(items: T[], rand: () => number, n = 6): T | null {
  const top = items.filter((i) => i.score > 0).slice(0, n);
  if (!top.length) return null;
  const total = top.reduce((s, i) => s + i.score, 0);
  let r = rand() * total;
  for (const i of top) if ((r -= i.score) <= 0) return i;
  return top[top.length - 1];
}

// ─────────────────────────────────────────────────────────────
// Today's three
// ─────────────────────────────────────────────────────────────
export type Exclude = { deezerIds: Set<number>; artistIds: Set<number> };

type Candidate = { id: number; name: string; score: number; root: Taste; via?: string };

export async function buildThree(s: Signals, seed: string, exclude: Exclude, only?: Slot[]): Promise<Pick[]> {
  const rand = rng(seed);
  const taste = tasteProfile(s);
  const loved = [...taste.values()].filter((t) => t.weight > 0).sort((a, b) => b.weight - a.weight).slice(0, 10);
  const disliked = [...taste.values()].filter((t) => t.weight < 0);
  const slots = only ?? [...SLOTS];

  const cutoff = Date.parse(s.today) - DISMISS_DAYS * DAY;
  const dismissedArtists = new Set(s.dismissed.filter((d) => Date.parse(d.created_at) >= cutoff && d.deezer_artist_id).map((d) => d.deezer_artist_id!));
  const blockedArtist = (id: number) =>
    taste.has(id) || dismissedArtists.has(id) || s.recentArtistIds.has(id) || exclude.artistIds.has(id);

  const knownIds = new Set<number>([...s.entries.map((e) => e.album.deezer_id), ...s.queued.map((q) => q.deezer_id), ...s.dismissed.map((d) => d.deezer_id)].filter((x): x is number => !!x));
  const knownTitles = new Set([...s.entries.map((e) => e.album), ...s.queued].map((a) => `${a.deezer_artist_id}|${baseTitle(a.title)}`));
  const isKnown = (artistId: number, deezerId: number, title: string) =>
    knownIds.has(deezerId) || exclude.deezerIds.has(deezerId) || knownTitles.has(`${artistId}|${baseTitle(title)}`);

  // One step out: artists similar to the ones you love.
  const relatedOf = new Map<number, RelatedArtist[]>();
  await Promise.all([...loved, ...disliked.slice(0, 5)].map(async (t) => relatedOf.set(t.id, await getRelatedArtists(t.id).catch(() => []))));

  const near = new Map<number, Candidate>();
  for (const t of loved) {
    (relatedOf.get(t.id) ?? []).forEach((a, pos) => {
      const add = t.weight * (1 - pos / 25);
      const cur = near.get(a.id);
      if (!cur) near.set(a.id, { id: a.id, name: a.name, score: add, root: t });
      else {
        cur.score += add;
        if (t.weight > cur.root.weight) cur.root = t;
      }
    });
  }
  // Artists close to what you rated low are pushed down.
  for (const t of disliked) {
    (relatedOf.get(t.id) ?? []).forEach((a, pos) => {
      const cur = near.get(a.id);
      if (cur) cur.score += t.weight * 0.8 * (1 - pos / 25);
    });
  }
  const nearRanked = [...near.values()].filter((c) => !blockedArtist(c.id)).sort((a, b) => b.score - a.score);

  const used = { artists: new Set<number>(), roots: new Set<number>() };
  const picks: Pick[] = [];

  /** First record by the artist you haven't heard: their best-known one, or a deeper cut. */
  const albumFor = async (artistId: number, deeper: boolean) => {
    const albums = (await getArtistAlbums(artistId).catch(() => [])).filter((a) => !isKnown(artistId, a.deezerId, a.title));
    return deeper && albums.length > 2 ? albums[1 + Math.floor(rand() * Math.min(3, albums.length - 1))] : albums[0];
  };
  const take = async (pool: Candidate[], slot: Slot, reason: (c: Candidate) => string, deeper = false, n = 6) => {
    let options = pool.filter((c) => !used.artists.has(c.id));
    const fresh = options.filter((c) => !used.roots.has(c.root.id)); // three different starting points
    if (fresh.length) options = fresh;
    for (let tries = 0; tries < 4 && options.length; tries++) {
      const c = weightedPick(options, rand, n);
      if (!c) return false;
      options = options.filter((o) => o !== c);
      const album = await albumFor(c.id, deeper);
      if (!album) continue;
      used.artists.add(c.id);
      used.roots.add(c.root.id);
      picks.push({ slot, deezerId: album.deezerId, artistId: c.id, artist: c.name, title: album.title, year: album.year, cover: album.cover, reason: reason(c) });
      return true;
    }
    return false;
  };

  // Safe bet
  if (slots.includes("safe")) await take(nearRanked, "safe", (c) => tasteReason(c.root));

  // Sidestep: similar to a similar artist.
  let far: Candidate[] = [];
  if (slots.includes("sidestep") || slots.includes("wildcard")) {
    const bridges = nearRanked.filter((c) => !used.artists.has(c.id)).slice(0, 5);
    const lists = await Promise.all(bridges.map((b) => getRelatedArtists(b.id).catch(() => [])));
    const farMap = new Map<number, Candidate>();
    bridges.forEach((b, i) =>
      lists[i].forEach((a, pos) => {
        if (near.has(a.id) || blockedArtist(a.id)) return;
        const add = b.score * (1 - pos / 25);
        const cur = farMap.get(a.id);
        if (!cur) farMap.set(a.id, { id: a.id, name: a.name, score: add, root: b.root, via: b.name });
        else cur.score += add;
      })
    );
    far = [...farMap.values()].sort((a, b) => b.score - a.score);
  }
  if (slots.includes("sidestep")) {
    const ok = await take(far, "sidestep", (c) => `One step on from ${c.root.name} — via ${c.via}`, false, 8);
    if (!ok) await take(nearRanked.slice(6), "sidestep", (c) => `A little further from ${c.root.name}`, false, 8);
  }

  // Wildcard: what people with your taste loved — or a deeper cut from the edges.
  if (slots.includes("wildcard")) {
    const community = s.neighbours
      .filter((n) => n.deezer_artist_id && !blockedArtist(n.deezer_artist_id) && !used.artists.has(n.deezer_artist_id) && !isKnown(n.deezer_artist_id, n.deezer_id, n.title))
      .map((n) => ({ ...n, score: Number(n.score) }));
    const c = weightedPick(community, rand, 5);
    if (c) {
      used.artists.add(c.deezer_artist_id!);
      picks.push({
        slot: "wildcard",
        deezerId: c.deezer_id,
        artistId: c.deezer_artist_id!,
        artist: c.artist,
        title: c.title,
        year: c.release_year,
        cover: c.cover ?? "",
        reason: `Loved by ${c.fans === 1 ? "someone" : `${c.fans} people`} who rate like you`,
      });
    } else {
      const edges = [...far.slice(8, 30), ...nearRanked.slice(10, 30)].map((x) => ({ ...x, score: 1 }));
      const ok = await take(edges.length ? edges : far, "wildcard", (x) => `A deeper cut from the edges of your taste — near ${x.via ?? x.root.name}`, true, 30);
      if (!ok) await take(nearRanked, "wildcard", (x) => `A deeper cut near ${x.root.name}`, true, 12);
    }
  }

  return SLOTS.flatMap((slot) => picks.filter((p) => p.slot === slot));
}
