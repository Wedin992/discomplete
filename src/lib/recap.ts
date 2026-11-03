import type { getUser } from "@/lib/supabase/server";
import type { Album } from "@/lib/format";

type Supabase = Awaited<ReturnType<typeof getUser>>["supabase"];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "2026-10" (a month) or "2026" (a year). */
export function parsePeriod(p: string): { from: string; to: string; label: string; kind: "month" | "year"; year: string } | null {
  if (/^\d{4}$/.test(p)) return { from: `${p}-01-01`, to: `${p}-12-31`, label: p, kind: "year", year: p };
  const m = p.match(/^(\d{4})-(\d{2})$/);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null;
  const last = new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();
  return { from: `${p}-01`, to: `${p}-${String(last).padStart(2, "0")}`, label: `${MONTHS[Number(m[2]) - 1]} ${m[1]}`, kind: "month", year: m[1] };
}

export type Recap = {
  label: string;
  kind: "month" | "year";
  year: string;
  listens: number;
  albums: number;
  firstTimes: number;
  relistens: number;
  hours: number;
  days: number;
  vinylShare: number; // 0–100, of listens
  cdShare: number;
  topArtist: { name: string; plays: number } | null;
  genres: string[];
  best: { album: Album; rating: number | null; plays: number }[]; // highest rated first
  mostPlayed: { album: Album; plays: number } | null;
};

export async function getRecap(supabase: Supabase, userId: string, period: string): Promise<Recap | null> {
  const p = parsePeriod(period);
  if (!p) return null;
  const { data } = await supabase
    .from("entries")
    .select("album_id, listened_on, rating, kind, format, album:albums(*)")
    .eq("user_id", userId)
    .neq("kind", "before")
    .gte("listened_on", p.from)
    .lte("listened_on", p.to)
    .order("listened_on", { ascending: false })
    .limit(5000);
  const rows = (data ?? []) as unknown as { album_id: string; listened_on: string; rating: number | null; kind: string; format: string; album: Album }[];

  const byAlbum = new Map<string, { album: Album; rating: number | null; plays: number }>();
  const byArtist = new Map<string, number>();
  const byGenre = new Map<string, number>();
  let seconds = 0;
  for (const r of rows) {
    const cur = byAlbum.get(r.album_id) ?? { album: r.album, rating: null, plays: 0 };
    cur.plays++;
    if (r.rating !== null && Number(r.rating) > (cur.rating ?? 0)) cur.rating = Number(r.rating);
    byAlbum.set(r.album_id, cur);
    byArtist.set(r.album.artist, (byArtist.get(r.album.artist) ?? 0) + 1);
    if (r.album.genre) byGenre.set(r.album.genre, (byGenre.get(r.album.genre) ?? 0) + 1);
    seconds += r.album.duration_sec ?? 2700;
  }
  const albums = [...byAlbum.values()];
  const top = [...byArtist.entries()].sort((a, b) => b[1] - a[1])[0];
  const most = [...albums].sort((a, b) => b.plays - a.plays)[0];
  const share = (f: string) => (rows.length ? Math.round((rows.filter((r) => r.format === f).length / rows.length) * 100) : 0);
  return {
    label: p.label,
    kind: p.kind,
    year: p.year,
    listens: rows.length,
    albums: albums.length,
    firstTimes: rows.filter((r) => r.kind === "first").length,
    relistens: rows.filter((r) => r.kind === "relisten").length,
    hours: Math.round(seconds / 3600),
    days: new Set(rows.map((r) => r.listened_on)).size,
    vinylShare: share("vinyl"),
    cdShare: share("cd"),
    topArtist: top ? { name: top[0], plays: top[1] } : null,
    genres: [...byGenre.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g),
    best: [...albums].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.plays - a.plays).slice(0, p.kind === "year" ? 9 : 6),
    mostPlayed: most && most.plays > 1 ? { album: most.album, plays: most.plays } : null,
  };
}
