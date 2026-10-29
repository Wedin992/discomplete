// Thin wrapper around Deezer's open API (no key needed). Server-side only:
// Deezer does not allow browser (CORS) requests, so the app calls it from its own API routes.

const BASE = process.env.DEEZER_API_BASE ?? "https://api.deezer.com";

type DzArtist = { id: number; name: string };
type DzAlbumLite = {
  id: number;
  title: string;
  cover_small: string;
  cover_medium: string;
  cover_xl: string;
  record_type?: string;
  nb_tracks?: number;
  artist: DzArtist;
};
type DzAlbumFull = DzAlbumLite & {
  release_date?: string;
  duration?: number;
  genres?: { data: { name: string }[] };
  error?: unknown;
};
type DzTrack = { id: number; title: string; artist: DzArtist; album: DzAlbumLite };

export type SearchAlbum = {
  deezerId: number;
  title: string;
  artist: string;
  year: number | null;
  recordType: string;
  cover: string;
  editions: number;
};
export type SearchTrack = {
  deezerId: number;
  title: string;
  artist: string;
  albumDeezerId: number;
  albumTitle: string;
  cover: string;
};
export type AlbumRecord = {
  deezer_id: number;
  title: string;
  artist: string;
  deezer_artist_id: number;
  release_year: number | null;
  record_type: string | null;
  genre: string | null;
  cover_small: string;
  cover_medium: string;
  cover_xl: string;
  track_count: number | null;
  duration_sec: number | null;
};

async function get<T>(path: string, revalidate = 3600): Promise<T> {
  const res = await fetch(BASE + path, { next: { revalidate } });
  if (!res.ok) throw new Error(`Deezer ${res.status}`);
  const json = await res.json();
  if (json && json.error) throw new Error(`Deezer error: ${JSON.stringify(json.error)}`);
  return json as T;
}

/** "Master of Puppets (Remastered Deluxe Box Set)" → "master of puppets" */
export function baseTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/\s*[\(\[][^\)\]]*(remaster|deluxe|edition|expanded|anniversary|version|live|bonus|mono|stereo)[^\)\]]*[\)\]]/g, "")
    .replace(/\s+-\s+(remaster|deluxe).*$/g, "")
    .replace(/[^a-z0-9åäöéü&]+/g, " ")
    .trim();
}
const isPlainTitle = (t: string) => !/[\(\[]/.test(t);

export async function getAlbum(deezerId: number): Promise<AlbumRecord> {
  const a = await get<DzAlbumFull>(`/album/${deezerId}`, 86400);
  const year = a.release_date ? parseInt(a.release_date.slice(0, 4), 10) : NaN;
  return {
    deezer_id: a.id,
    title: a.title,
    artist: a.artist.name,
    deezer_artist_id: a.artist.id,
    release_year: Number.isFinite(year) && year > 1800 ? year : null,
    record_type: a.record_type ?? null,
    genre: a.genres?.data?.[0]?.name ?? null,
    cover_small: a.cover_small,
    cover_medium: a.cover_medium,
    cover_xl: a.cover_xl,
    track_count: a.nb_tracks ?? null,
    duration_sec: a.duration ?? null,
  };
}

export async function search(q: string): Promise<{ albums: SearchAlbum[]; tracks: SearchTrack[] }> {
  const query = encodeURIComponent(q.trim());
  const [albumRes, trackRes] = await Promise.all([
    get<{ data: DzAlbumLite[] }>(`/search/album?q=${query}&limit=25`, 600),
    get<{ data: DzTrack[] }>(`/search/track?q=${query}&limit=6`, 600),
  ]);

  // Merge editions of the same record (original, remaster, deluxe…) into one result.
  const groups = new Map<string, DzAlbumLite[]>();
  for (const a of albumRes.data ?? []) {
    const key = a.artist.name.toLowerCase() + "|" + baseTitle(a.title);
    const g = groups.get(key);
    if (g) g.push(a);
    else groups.set(key, [a]);
  }
  const merged = [...groups.values()].slice(0, 8).map((g) => {
    const main = g.find((a) => isPlainTitle(a.title)) ?? g[0];
    return { main, editions: g.length };
  });

  // Search results don't include a release year. They're returned straight away and the
  // years are filled in afterwards by /api/search/years, so typing never waits on them.
  const albums: SearchAlbum[] = merged.map(({ main, editions }) => ({
    deezerId: main.id,
    title: main.title,
    artist: main.artist.name,
    year: null,
    recordType: main.record_type ?? "album",
    cover: main.cover_medium,
    editions,
  }));

  const tracks: SearchTrack[] = (trackRes.data ?? []).map((t) => ({
    deezerId: t.id,
    title: t.title,
    artist: t.artist.name,
    albumDeezerId: t.album.id,
    albumTitle: t.album.title,
    cover: t.album.cover_small,
  }));

  return { albums, tracks };
}

export type ArtistAlbum = {
  deezerId: number;
  title: string;
  year: number | null;
  cover: string;
  fans: number;
};

/**
 * An artist's studio albums, editions merged (the plain title wins), most popular first.
 * Singles, EPs and compilations are left out.
 */
export async function getArtistAlbums(artistId: number): Promise<ArtistAlbum[]> {
  type Row = DzAlbumLite & { release_date?: string; fans?: number };
  const res = await get<{ data: Row[] }>(`/artist/${artistId}/albums?limit=100`, 86400);
  const groups = new Map<string, Row[]>();
  for (const a of res.data ?? []) {
    if ((a.record_type ?? "album") !== "album") continue;
    const key = baseTitle(a.title);
    const g = groups.get(key);
    if (g) g.push(a);
    else groups.set(key, [a]);
  }
  return [...groups.values()]
    .map((g) => {
      const main = g.find((a) => isPlainTitle(a.title)) ?? g[0];
      const year = main.release_date ? parseInt(main.release_date.slice(0, 4), 10) : NaN;
      return {
        deezerId: main.id,
        title: main.title,
        year: Number.isFinite(year) ? year : null,
        cover: main.cover_medium,
        fans: Math.max(...g.map((a) => a.fans ?? 0)),
      };
    })
    .sort((a, b) => b.fans - a.fans);
}

export type RelatedArtist = { id: number; name: string; fans: number };

/** Artists Deezer considers similar, most similar first. */
export async function getRelatedArtists(artistId: number): Promise<RelatedArtist[]> {
  const res = await get<{ data: { id: number; name: string; nb_fan?: number }[] }>(`/artist/${artistId}/related?limit=20`, 86400);
  return (res.data ?? []).map((a) => ({ id: a.id, name: a.name, fans: a.nb_fan ?? 0 }));
}

export type ArtistHit = { id: number; name: string; picture: string; fans: number };

export async function searchArtists(q: string): Promise<ArtistHit[]> {
  const res = await get<{ data: { id: number; name: string; picture_medium: string; nb_fan?: number }[] }>(
    `/search/artist?q=${encodeURIComponent(q.trim())}&limit=8`,
    600
  );
  return (res.data ?? []).map((a) => ({ id: a.id, name: a.name, picture: a.picture_medium, fans: a.nb_fan ?? 0 }));
}

/** Release years for a handful of albums (cached for a day per album). */
export async function getYears(ids: number[]): Promise<Record<number, number | null>> {
  const rows = await Promise.all(ids.map((id) => getAlbum(id).then((a) => [id, a.release_year] as const).catch(() => [id, null] as const)));
  return Object.fromEntries(rows);
}

export type ArtistInfo = { id: number; name: string; picture: string; albums: number; fans: number };

export async function getArtist(artistId: number): Promise<ArtistInfo> {
  const a = await get<{ id: number; name: string; picture_xl?: string; picture_big?: string; nb_album?: number; nb_fan?: number }>(`/artist/${artistId}`, 86400);
  return { id: a.id, name: a.name, picture: a.picture_xl ?? a.picture_big ?? "", albums: a.nb_album ?? 0, fans: a.nb_fan ?? 0 };
}

export type FoundAlbum = { deezerId: number; artistId: number; artist: string; title: string; cover: string; tracks?: number };
const loose = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Find a specific record on Deezer by artist and title (e.g. one picked from Wikidata). */
export async function findAlbum(artist: string, title: string, opts: { relaxed?: boolean } = {}): Promise<FoundAlbum | null> {
  const a = loose(artist);
  const t = loose(baseTitle(title) || title);
  // Relaxed: "The Jimi Hendrix Experience" ≈ "Jimi Hendrix", and any record type.
  const sameArtist = (name: string) => {
    const n = loose(name);
    return n === a || (!!opts.relaxed && (n.includes(a.replace(/^the /, "")) || a.includes(n.replace(/^the /, ""))));
  };
  const pick = (rows: DzAlbumLite[]) => {
    const same = rows.filter((r) => sameArtist(r.artist.name) && (opts.relaxed || (r.record_type ?? "album") === "album"));
    const exact = same.filter((r) => loose(baseTitle(r.title) || r.title) === t);
    const hit = exact.find((r) => isPlainTitle(r.title)) ?? exact[0] ?? same.find((r) => loose(r.title).startsWith(t));
    return hit ? { deezerId: hit.id, artistId: hit.artist.id, artist: hit.artist.name, title: hit.title, cover: hit.cover_medium, tracks: hit.nb_tracks } : null;
  };
  const strict = await get<{ data: DzAlbumLite[] }>(`/search/album?q=${encodeURIComponent(`artist:"${artist}" album:"${title}"`)}&limit=10`, 2592000).catch(() => ({ data: [] }));
  const found = pick(strict.data ?? []);
  if (found) return found;
  const plain = await get<{ data: DzAlbumLite[] }>(`/search/album?q=${encodeURIComponent(`${artist} ${title}`)}&limit=10`, 2592000).catch(() => ({ data: [] }));
  const second = pick(plain.data ?? []);
  if (second || !opts.relaxed) return second;
  const byTitle = await get<{ data: DzAlbumLite[] }>(`/search/album?q=${encodeURIComponent(title)}&limit=25`, 2592000).catch(() => ({ data: [] }));
  return pick(byTitle.data ?? []);
}

export type AlbumTrack = { id: number; title: string; position: number; duration: number };

/** A record's tracklist, in order (for picking favourite tracks). */
export async function getAlbumTracks(deezerId: number): Promise<AlbumTrack[]> {
  type Row = { id: number; title: string; title_short?: string; track_position?: number; disk_number?: number; duration?: number };
  const res = await get<{ data: Row[] }>(`/album/${deezerId}/tracks?limit=200`, 86400);
  return (res.data ?? []).map((t, i) => ({ id: t.id, title: t.title_short || t.title, position: t.track_position ?? i + 1, duration: t.duration ?? 0 }));
}
