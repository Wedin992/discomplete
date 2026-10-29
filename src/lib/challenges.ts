// Server-only: challenges — complete an artist's albums, or one of our curated lists.
// Progress comes from the diary (any entry counts, "Heard before" too), so nothing is ticked off twice.
import type { getUser } from "@/lib/supabase/server";
import { baseTitle, findAlbum, getArtistAlbums } from "@/lib/deezer";
import { listBySlug } from "@/lib/challenge-lists";
import { rng } from "@/lib/discover";
import { todayIso } from "@/lib/format";

type Supabase = Awaited<ReturnType<typeof getUser>>["supabase"];

export type Challenge = {
  id: string;
  kind: "artist" | "list";
  ref: string;
  title: string;
  created_at: string;
  draw_day: string | null;
  draw_deezer_id: number | null;
};
export type ChallengeAlbum = { deezerId: number; artist: string; title: string; year: number | null; cover: string };
export type Done = { rating: number | null; listenedOn: string };
export type DiaryIndex = Map<string, Done>;
export type ChallengeView = Challenge & {
  albums: ChallengeAlbum[];
  done: number;
  total: number;
  draw: ChallengeAlbum | null;
  latest: { album: ChallengeAlbum; on: string } | null; // the most recent one you ticked off
};

const loose = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const titleKey = (artist: string, title: string) => `t:${loose(artist)}|${loose(baseTitle(title) || title)}`;

export const challengeTitle = (c: Pick<Challenge, "kind" | "title">) => (c.kind === "artist" ? `Complete ${c.title}` : c.title);
export const challengePath = (c: Pick<Challenge, "id">) => `/challenges/${c.id}`;

/** Your active challenges (none before migration 0013). */
export async function getChallenges(supabase: Supabase, userId: string): Promise<{ list: Challenge[]; ready: boolean }> {
  const { data, error } = await supabase.from("challenges").select("id, kind, ref, title, created_at, draw_day, draw_deezer_id").eq("user_id", userId).order("created_at", { ascending: false });
  return { list: (data ?? []) as Challenge[], ready: !error };
}

/** Everything in your diary, keyed by Deezer id and by artist + title (so another edition counts too). */
export async function diaryIndex(supabase: Supabase, userId: string): Promise<DiaryIndex> {
  const { data } = await supabase.from("entries").select("rating, listened_on, album:albums!inner(deezer_id, artist, title)").eq("user_id", userId).order("listened_on", { ascending: false });
  const out: DiaryIndex = new Map();
  for (const e of (data ?? []) as unknown as { rating: number | null; listened_on: string; album: { deezer_id: number | null; artist: string; title: string } }[]) {
    const keys = [titleKey(e.album.artist, e.album.title), ...(e.album.deezer_id ? [`d:${e.album.deezer_id}`] : [])];
    for (const k of keys) {
      const prev = out.get(k);
      // newest date (entries come newest first), best rating
      out.set(k, { listenedOn: prev?.listenedOn ?? e.listened_on, rating: Math.max(prev?.rating ?? 0, e.rating ?? 0) || null });
    }
  }
  return out;
}

export const doneIn = (index: DiaryIndex, a: Pick<ChallengeAlbum, "deezerId" | "artist" | "title">) => index.get(`d:${a.deezerId}`) ?? index.get(titleKey(a.artist, a.title)) ?? null;

/** The albums in a challenge, oldest first. */
export async function challengeAlbums(c: Pick<Challenge, "kind" | "ref" | "title">): Promise<ChallengeAlbum[]> {
  if (c.kind === "artist") {
    const albums = await getArtistAlbums(Number(c.ref)).catch(() => []);
    return albums.map((a) => ({ deezerId: a.deezerId, artist: c.title, title: a.title, year: a.year, cover: a.cover })).sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
  }
  const list = listBySlug(c.ref);
  if (!list) return [];
  const found = await Promise.all(
    list.items.map(async (i) => {
      const hit = await findAlbum(i.artist, i.title, { relaxed: true }).catch(() => null);
      const a: ChallengeAlbum | null = hit ? { deezerId: hit.deezerId, artist: hit.artist, title: hit.title, year: i.year, cover: hit.cover } : null;
      return a;
    })
  );
  const seen = new Set<number>();
  return found.filter((a): a is ChallengeAlbum => !!a && !seen.has(a.deezerId) && !!seen.add(a.deezerId));
}

/**
 * A challenge with its progress and today's pick. The pick stays the same all day,
 * and moves on as soon as you've logged it.
 */
export async function viewChallenge(supabase: Supabase, userId: string, c: Challenge, index: DiaryIndex): Promise<ChallengeView> {
  const albums = await challengeAlbums(c);
  const left = albums.filter((a) => !doneIn(index, a));
  const today = todayIso();

  let draw: ChallengeAlbum | null = null;
  const kept = c.draw_day === today ? left.find((a) => a.deezerId === c.draw_deezer_id) : undefined;
  if (kept) draw = kept;
  else if (left.length) {
    const r = rng(`${userId}|${c.id}|${today}|${albums.length - left.length}`);
    draw = left[Math.floor(r() * left.length)];
    if (c.draw_day !== today || c.draw_deezer_id !== draw.deezerId) {
      await supabase.from("challenges").update({ draw_day: today, draw_deezer_id: draw.deezerId }).eq("id", c.id).eq("user_id", userId);
    }
  }

  let latest: ChallengeView["latest"] = null;
  for (const a of albums) {
    const d = doneIn(index, a);
    if (d && (!latest || d.listenedOn > latest.on)) latest = { album: a, on: d.listenedOn };
  }
  return { ...c, albums, done: albums.length - left.length, total: albums.length, draw, latest };
}

export async function viewChallenges(supabase: Supabase, userId: string, limit = 10) {
  const { list, ready } = await getChallenges(supabase, userId);
  if (!list.length) return { views: [] as ChallengeView[], ready, index: null as DiaryIndex | null };
  const index = await diaryIndex(supabase, userId);
  const views = await Promise.all(list.slice(0, limit).map((c) => viewChallenge(supabase, userId, c, index)));
  return { views, ready, index };
}
