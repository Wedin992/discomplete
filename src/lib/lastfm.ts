// Server-only: Last.fm (the bridge to Spotify and other players that scrobble).
// Reads public listening history with the app's API key — no Last.fm login needed per user.
import { baseTitle, findAlbum, getAlbum } from "@/lib/deezer";

const BASE = process.env.LASTFM_API_BASE ?? "https://ws.audioscrobbler.com/2.0/";
export const lastfmConfigured = () => !!process.env.LASTFM_API_KEY;

type LfmError = { error?: number; message?: string };

async function call<T>(method: string, params: Record<string, string | number>, revalidate = 0): Promise<T> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) throw new Error("Last.fm isn't set up yet");
  const qs = new URLSearchParams({ method, api_key: key, format: "json", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const res = await fetch(`${BASE}?${qs}`, {
    headers: { "User-Agent": "Discomplete/1.0 (https://www.discomplete.com)" },
    ...(revalidate ? { next: { revalidate } } : { cache: "no-store" as const }),
    signal: AbortSignal.timeout(8000),
  });
  const json = (await res.json().catch(() => ({}))) as T & LfmError;
  if (json.error) {
    // 6: no such user · 17: the user hides their recent listening
    throw new LastfmError(json.error, json.message ?? "Last.fm error");
  }
  if (!res.ok) throw new LastfmError(res.status, `Last.fm ${res.status}`);
  return json;
}

export class LastfmError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

/** Checks that a Last.fm user exists; returns their name as Last.fm spells it. */
export async function getLastfmUser(username: string): Promise<{ name: string; playcount: number }> {
  const r = await call<{ user?: { name: string; playcount?: string } }>("user.getinfo", { user: username });
  if (!r.user) throw new LastfmError(6, "User not found");
  return { name: r.user.name, playcount: Number(r.user.playcount ?? 0) };
}

export type Scrobble = { artist: string; album: string; track: string; uts: number };

/** Scrobbles since `fromUts` (oldest first), up to `maxPages` × 200. */
export async function getRecentScrobbles(username: string, fromUts: number, maxPages = 5, revalidate = 0): Promise<Scrobble[]> {
  type T = { artist?: { "#text"?: string; name?: string }; album?: { "#text"?: string }; name?: string; date?: { uts?: string }; "@attr"?: { nowplaying?: string } };
  type R = { recenttracks?: { track?: T[] | T; "@attr"?: { totalPages?: string } } };
  const out: Scrobble[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const r = await call<R>("user.getrecenttracks", { user: username, from: Math.floor(fromUts), limit: 200, page }, revalidate);
    const raw = r.recenttracks?.track;
    const tracks = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const t of tracks) {
      if (t["@attr"]?.nowplaying || !t.date?.uts) continue;
      const artist = t.artist?.["#text"] ?? t.artist?.name ?? "";
      const album = t.album?.["#text"] ?? "";
      if (!artist || !album || !t.name) continue;
      out.push({ artist, album, track: t.name, uts: Number(t.date.uts) });
    }
    const total = Number(r.recenttracks?.["@attr"]?.totalPages ?? 1);
    if (page >= total) break;
  }
  return out.sort((a, b) => a.uts - b.uts);
}

export type TopAlbum = { artist: string; album: string; plays: number };

export async function getTopAlbums(username: string, limit = 30): Promise<TopAlbum[]> {
  type R = { topalbums?: { album?: { name: string; playcount?: string; artist?: { name?: string } }[] } };
  const r = await call<R>("user.gettopalbums", { user: username, period: "overall", limit }, 3600);
  return (r.topalbums?.album ?? [])
    .filter((a) => a.name && a.artist?.name)
    .map((a) => ({ artist: a.artist!.name!, album: a.name, plays: Number(a.playcount ?? 0) }));
}

// ─────────────────────────────────────────────────────────────
// Spotting album listens
// ─────────────────────────────────────────────────────────────
const loose = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\(.*?\)|\[.*?\]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export const SESSION_GAP_H = 3; // a pause longer than this starts a new listening session
export const MIN_SHARE = 0.4; // share of the album's tracks played in one session
export const MIN_TRACKS = 5; // …and at least this many (or the whole album if it's shorter)
export const COMPLETE_SHARE = 0.7; // from here it counts as having heard the album
export const DONE_SHARE = 0.9; // an album you're "on" counts as finished from here
export const SETTLE_MIN = 20; // wait this long after the last track before suggesting (you may just be on a break) — unless the album is basically done

/** How a scrobble's album is recognised across syncs. */
export const albumKey = (artist: string, album: string) => `${loose(artist)}|${loose(baseTitle(album) || album)}`;
export const trackKey = (track: string) => loose(track);

export type AlbumListen = {
  deezerId: number;
  deezerArtistId: number;
  title: string;
  artist: string;
  cover: string;
  playedOn: string; // YYYY-MM-DD, Stockholm
  tracksPlayed: number;
  totalTracks: number;
  key: string; // albumKey of the scrobbles
  tracks: string[]; // trackKey of each distinct track played
  lastUts: number;
  startUts: number;
};

const stockholmDay = (uts: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date(uts * 1000));

/** Groups scrobbles into sessions per album and keeps the ones that look like playing the album. */
export async function spotAlbumListens(scrobbles: Scrobble[], skip: Set<string> = new Set()): Promise<AlbumListen[]> {
  type Session = { key: string; artist: string; album: string; start: number; last: number; tracks: Set<string> };
  const open = new Map<string, Session>();
  const done: Session[] = [];
  for (const s of scrobbles) {
    const key = albumKey(s.artist, s.album);
    if (skip.has(key)) continue; // already being followed
    const cur = open.get(key);
    if (cur && s.uts - cur.last <= SESSION_GAP_H * 3600) {
      cur.tracks.add(loose(s.track));
      cur.last = s.uts;
    } else {
      if (cur) done.push(cur);
      open.set(key, { key, artist: s.artist, album: s.album, start: s.uts, last: s.uts, tracks: new Set([loose(s.track)]) });
    }
  }
  done.push(...open.values());

  // Only sessions with a handful of different tracks are worth a Deezer lookup — and only once
  // they've settled: a session that's still going (or on a short break) waits.
  const settled = Date.now() / 1000 - SETTLE_MIN * 60;
  const candidates = done.filter((s) => s.tracks.size >= Math.min(4, MIN_TRACKS)).slice(-40);
  const found = await Promise.all(
    candidates.map(async (s) => {
      const hit = await findAlbum(s.artist, s.album).catch(() => null);
      if (!hit) return null;
      const full = await getAlbum(hit.deezerId).catch(() => null);
      const total = full?.track_count ?? 0;
      if (!total) return null;
      const played = Math.min(s.tracks.size, total);
      if (played < Math.min(MIN_TRACKS, total) || played / total < MIN_SHARE) return null;
      if (s.last > settled && played / total < DONE_SHARE) return null; // still going (or a short break) — unless it's basically done
      return {
        deezerId: hit.deezerId,
        deezerArtistId: hit.artistId,
        title: hit.title,
        artist: hit.artist,
        cover: hit.cover,
        playedOn: stockholmDay(s.start),
        tracksPlayed: played,
        totalTracks: total,
        key: s.key,
        tracks: [...s.tracks],
        lastUts: s.last,
        startUts: s.start,
      } satisfies AlbumListen;
    })
  );
  return found.filter((x): x is AlbumListen => !!x);
}

export const looseName = loose;

export type LatestPlay = { artist: string; track: string; uts: number | null; nowPlaying: boolean };

/** The newest thing on someone's Last.fm (playing right now, or their last scrobble) — to show the connection works. */
export async function getLatestPlay(username: string): Promise<LatestPlay | null> {
  type T = { artist?: { "#text"?: string; name?: string }; name?: string; date?: { uts?: string }; "@attr"?: { nowplaying?: string } };
  const r = await call<{ recenttracks?: { track?: T[] | T } }>("user.getrecenttracks", { user: username, limit: 1 });
  const raw = r.recenttracks?.track;
  const t = (Array.isArray(raw) ? raw : raw ? [raw] : [])[0];
  if (!t?.name) return null;
  return {
    artist: t.artist?.["#text"] ?? t.artist?.name ?? "",
    track: t.name,
    uts: t.date?.uts ? Number(t.date.uts) : null,
    nowPlaying: t["@attr"]?.nowplaying === "true",
  };
}
