// Server-only: loads what Discover needs about you, and keeps today's three per scope
// ("daily" or "genre:<slug>") so they stay the same all day until you shuffle.
import type { getUser } from "@/lib/supabase/server";
import { buildThree, SHUFFLES_PER_DAY, type Exclude, type Pick, type Signals, type Slot } from "@/lib/discover";
import { buildGenreThree, genreFromSlug } from "@/lib/genre";
import { todayIso } from "@/lib/format";

type Supabase = Awaited<ReturnType<typeof getUser>>["supabase"];
type AlbumRef = { deezer_id: number | null; deezer_artist_id: number | null; artist: string; title: string };
type Stored = { day: string; scope: string; picks: Pick[]; shuffles: number };

export type PicksResult = {
  picks: Pick[];
  shufflesLeft: number;
  persisted: boolean; // false before migration 0006 — then shuffling isn't offered
  empty?: boolean; // genre has no records we know of
};

const ALBUM = "album:albums(deezer_id, deezer_artist_id, artist, title)";

function daysAgo(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

async function load(supabase: Supabase, userId: string, scope: string) {
  const today = todayIso();
  const [entries, coll, explore, favs, queued, dismissed, recent, neighbours] = await Promise.all([
    supabase.from("entries").select(`rating, kind, listened_on, ${ALBUM}`).eq("user_id", userId),
    supabase.from("collection").select(`vinyl, cd, ${ALBUM}`).eq("user_id", userId),
    supabase.from("explore_artists").select("deezer_artist_id, artist").eq("user_id", userId),
    supabase.from("favorite_artists").select("deezer_artist_id, artist").eq("user_id", userId),
    supabase.from("to_listen").select(ALBUM).eq("user_id", userId),
    supabase.from("discover_dismissed").select("deezer_id, deezer_artist_id, created_at").eq("user_id", userId),
    supabase.from("discover_picks").select("day, scope, picks, shuffles").eq("user_id", userId).gte("day", daysAgo(today, 7)),
    supabase.rpc("taste_neighbour_picks", { p_limit: 40 }),
  ]);
  const albumOf = (r: unknown) => (r as { album: AlbumRef | null }).album;
  const stored = recent.error ? [] : ((recent.data ?? []) as Stored[]);
  const current = stored.find((r) => r.day === today && r.scope === scope) ?? null;

  const recentArtistIds = new Set<number>();
  for (const r of stored) if (r !== current) for (const p of r.picks ?? []) recentArtistIds.add(p.artistId);

  const signals: Signals = {
    today,
    entries: ((entries.data ?? []) as unknown as { rating: number | null; kind: string; listened_on: string; album: AlbumRef | null }[])
      .filter((e) => e.album)
      .map((e) => ({ ...e, album: e.album! })),
    owned: ((coll.data ?? []) as unknown as { vinyl: boolean; cd: boolean; album: AlbumRef | null }[]).filter((c) => (c.vinyl || c.cd) && c.album).map((c) => c.album!),
    exploring: explore.error ? [] : ((explore.data ?? []) as Signals["exploring"]),
    favourites: favs.error ? [] : ((favs.data ?? []) as Signals["favourites"]),
    queued: (queued.data ?? []).map(albumOf).filter((a): a is AlbumRef => !!a),
    dismissed: dismissed.error ? [] : ((dismissed.data ?? []) as Signals["dismissed"]),
    recentArtistIds,
    neighbours: neighbours.error ? [] : ((neighbours.data ?? []) as Signals["neighbours"]),
  };
  return { today, signals, current, persisted: !recent.error };
}

async function build(signals: Signals, scope: string, seed: string, exclude: Exclude, only?: Slot[]) {
  if (scope === "daily") return { picks: await buildThree(signals, seed, exclude, only), empty: false };
  const genre = genreFromSlug(scope.replace(/^genre:/, ""));
  if (!genre) return { picks: [], empty: true };
  return buildGenreThree(signals, genre, seed, exclude, only);
}

const none = (): Exclude => ({ deezerIds: new Set(), artistIds: new Set() });
const excluding = (picks: Pick[]): Exclude => ({ deezerIds: new Set(picks.map((p) => p.deezerId)), artistIds: new Set(picks.map((p) => p.artistId)) });

/** Today's three for a scope: the stored ones, or new ones the first time today. */
export async function getPicks(supabase: Supabase, userId: string, scope: string): Promise<PicksResult> {
  const { today, signals, current, persisted } = await load(supabase, userId, scope);
  if (current?.picks?.length) return { picks: current.picks, shufflesLeft: Math.max(0, SHUFFLES_PER_DAY - current.shuffles), persisted };

  const { picks, empty } = await build(signals, scope, `${userId}|${today}|${scope}|0`, none());
  if (persisted && picks.length) {
    await supabase
      .from("discover_picks")
      .upsert({ user_id: userId, day: today, scope, picks, shuffles: current?.shuffles ?? 0, updated_at: new Date().toISOString() }, { onConflict: "user_id,day,scope" });
  }
  return { picks, shufflesLeft: Math.max(0, SHUFFLES_PER_DAY - (current?.shuffles ?? 0)), persisted, empty };
}

/** Shuffle: three new ones (a few times a day). */
export async function shufflePicks(supabase: Supabase, userId: string, scope: string) {
  const { today, signals, current, persisted } = await load(supabase, userId, scope);
  if (!persisted) return;
  const used = current?.shuffles ?? 0;
  if (used >= SHUFFLES_PER_DAY) return;
  const { picks } = await build(signals, scope, `${userId}|${today}|${scope}|${used + 1}`, excluding(current?.picks ?? []));
  await supabase
    .from("discover_picks")
    .upsert({ user_id: userId, day: today, scope, picks: picks.length ? picks : current?.picks ?? [], shuffles: used + 1, updated_at: new Date().toISOString() }, { onConflict: "user_id,day,scope" });
}

/** "Not for me": remember it, and swap just that one. */
export async function dismissPick(supabase: Supabase, userId: string, scope: string, slot: Slot, deezerId: number) {
  const before = await load(supabase, userId, scope);
  const pick = before.current?.picks.find((p) => p.slot === slot && p.deezerId === deezerId);
  if (!before.persisted || !before.current || !pick) return;
  await supabase
    .from("discover_dismissed")
    .upsert({ user_id: userId, deezer_id: pick.deezerId, deezer_artist_id: pick.artistId, artist: pick.artist }, { onConflict: "user_id,deezer_id" });

  const { today, signals, current } = await load(supabase, userId, scope);
  const all = current?.picks ?? [];
  const n = all.length + (signals.dismissed.length % 7);
  const { picks: fresh } = await build(signals, scope, `${userId}|${today}|${scope}|swap${n}|${deezerId}`, excluding(all), [slot]);
  const next = all.flatMap((p) => (p.slot === slot && p.deezerId === deezerId ? fresh.slice(0, 1) : [p]));
  await supabase
    .from("discover_picks")
    .update({ picks: next, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("day", today)
    .eq("scope", scope);
}
