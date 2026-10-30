"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { TAGS, isRating, logPath, recordPath, todayIso, type Album } from "@/lib/format";
import { translateToEnglish } from "@/lib/translate";
import { getAlbum, getArtist } from "@/lib/deezer";
import { listBySlug } from "@/lib/challenge-lists";
import { dismissPick, shufflePicks } from "@/lib/discover-store";
import { getLastfmUser, LastfmError, looseName, trackKey } from "@/lib/lastfm";
import { logAlbumListen, parkInToListen, syncLastfm } from "@/lib/lastfm-sync";
import { SLOTS, type Slot } from "@/lib/discover";

async function requireUser() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

type Supabase = Awaited<ReturnType<typeof getUser>>["supabase"];

/** Follows or unfollows the record's artist, depending on the log form's checkbox. */
async function syncExplore(supabase: Supabase, userId: string, albumId: string, formData: FormData) {
  if (formData.get("explore_shown") !== "1") return;
  const { data: album } = await supabase.from("albums").select("deezer_artist_id, artist").eq("id", albumId).maybeSingle();
  if (!album?.deezer_artist_id) return;
  if (formData.get("explore_artist") === "on") {
    await supabase.from("explore_artists").upsert(
      { user_id: userId, deezer_artist_id: album.deezer_artist_id, artist: album.artist, from_album_id: albumId },
      { onConflict: "user_id,deezer_artist_id", ignoreDuplicates: true }
    );
  } else {
    await supabase.from("explore_artists").delete().eq("user_id", userId).eq("deezer_artist_id", album.deezer_artist_id);
  }
}

export async function stopExploring(formData: FormData) {
  const { supabase, user } = await requireUser();
  const artistId = Number(formData.get("deezer_artist_id"));
  if (!Number.isInteger(artistId)) return;
  await supabase.from("explore_artists").delete().eq("user_id", user.id).eq("deezer_artist_id", artistId);
  revalidatePath("/", "layout");
}

/** "+ To listen" on a suggestion that may not be in the catalogue yet. */
export async function queueFromDeezer(formData: FormData) {
  const { supabase, user } = await requireUser();
  const deezerId = Number(formData.get("deezer_id"));
  const source = String(formData.get("source") ?? "").slice(0, 200) || null;
  if (!Number.isInteger(deezerId) || deezerId <= 0) return;
  const albumId = await ensureAlbum(supabase, deezerId);
  if (!albumId) return;
  await supabase.from("to_listen").upsert({ user_id: user.id, album_id: albumId, source }, { onConflict: "user_id,album_id", ignoreDuplicates: true });
  revalidatePath("/", "layout");
}

/** "Log it" on a suggestion: save it to the catalogue, then open the log form. */
export async function logFromDeezer(formData: FormData) {
  const { supabase } = await requireUser();
  const deezerId = Number(formData.get("deezer_id"));
  if (!Number.isInteger(deezerId) || deezerId <= 0) return;
  const albumId = await ensureAlbum(supabase, deezerId);
  if (!albumId) return;
  const { data } = await supabase.from("albums").select("*").eq("id", albumId).maybeSingle();
  redirect(data ? logPath(data as Album) : "/log");
}

async function ensureAlbum(supabase: Supabase, deezerId: number): Promise<string | null> {
  const { data: existing } = await supabase.from("albums").select("id").eq("deezer_id", deezerId).maybeSingle();
  if (existing?.id) return existing.id as string;
  try {
    const record = await getAlbum(deezerId);
    const { data, error } = await supabase.rpc("upsert_album", { p: record });
    if (error) return null;
    return data as string;
  } catch {
    return null;
  }
}

/**
 * Once a record is in the diary (logged, rated, written about), whatever Spotify was following for it
 * is done: off the turntable, no more "you started …" or "how was it?".
 */
async function closeSuggestions(supabase: Supabase, userId: string, by: { albumId?: string; deezerId?: number }) {
  let deezerId = by.deezerId ?? null;
  if (!deezerId && by.albumId) {
    const { data } = await supabase.from("albums").select("deezer_id").eq("id", by.albumId).maybeSingle();
    deezerId = (data as { deezer_id: number | null } | null)?.deezer_id ?? null;
  }
  if (!deezerId) return;
  await supabase.from("lastfm_suggestions").update({ status: "logged" }).eq("user_id", userId).eq("deezer_id", deezerId).in("status", ["pending", "listening", "finished"]);
}

/** The newest album listen Spotify is following for this record (on the turntable, or suggested), if any. */
async function activeListenDay(supabase: Supabase, userId: string, deezerId: number): Promise<string | null> {
  const { data, error } = await supabase
    .from("lastfm_suggestions")
    .select("played_on")
    .eq("user_id", userId)
    .eq("deezer_id", deezerId)
    .in("status", ["pending", "listening", "finished"])
    .order("played_on", { ascending: false })
    .limit(1);
  if (error) return null;
  return ((data ?? []) as { played_on: string }[])[0]?.played_on ?? null;
}

export async function saveEntry(formData: FormData) {
  const { supabase, user } = await requireUser();
  const albumId = String(formData.get("album_id") ?? "");
  const entryId = String(formData.get("entry_id") ?? "");
  const format = String(formData.get("format") ?? "stream");
  const ratingRaw = Number(formData.get("rating") ?? 0);
  const rating = isRating(ratingRaw) ? ratingRaw : null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 5000) || null;
  const tags = formData.getAll("tags").map(String).filter((t) => TAGS.includes(t));
  const isPrivate = formData.get("is_private") === "on";
  const isAnonymous = !isPrivate && formData.get("is_anonymous") === "on";
  const listenedOnRaw = String(formData.get("listened_on") ?? "");
  const listenedOn = /^\d{4}-\d{2}-\d{2}$/.test(listenedOnRaw) && listenedOnRaw <= todayIso() ? listenedOnRaw : todayIso();

  const kindChoice = String(formData.get("kind_choice") ?? "");
  let favTracks: { id: number; title: string; position: number }[] | null = null;
  try {
    const raw = JSON.parse(String(formData.get("fav_tracks") ?? "null"));
    if (Array.isArray(raw))
      favTracks = raw
        .filter((t) => t && Number.isInteger(t.id) && t.id > 0 && typeof t.title === "string")
        .slice(0, 3)
        .map((t) => ({ id: t.id, title: String(t.title).slice(0, 200), position: Number.isInteger(t.position) ? t.position : 0 }));
  } catch {
    favTracks = null;
  }
  const fields: Record<string, unknown> = {
    listened_on: listenedOn,
    rating,
    format: ["stream", "vinyl", "cd"].includes(format) ? format : "stream",
    note,
    tags,
    is_private: isPrivate,
    is_anonymous: isAnonymous,
    ...(favTracks ? { fav_tracks: favTracks } : {}),
  };

  // English translation for others to read: only for public notes, made once when the
  // note is written, changed, or goes from private to public. Private notes are never sent.
  let before: { note?: string | null; note_lang?: string | null; is_private?: boolean } | null = null;
  if (entryId) {
    const { data } = await supabase.from("entries").select("*").eq("id", entryId).eq("user_id", user.id).maybeSingle();
    before = data;
  }
  if (isPrivate || !note) {
    fields.note_lang = null;
    fields.note_en = null;
  } else {
    const needsTranslation = !before || before.note !== note || before.is_private || !before.note_lang;
    if (needsTranslation) {
      const t = await translateToEnglish(note);
      fields.note_lang = t.lang;
      fields.note_en = t.english;
    }
  }

  // An older database may lack a column (translations: 0003, favourite tracks: 0009). Then save
  // again without just that column, so the rest — the translation included — is still saved.
  type Result = { error: { code?: string; message?: string } | null };
  const OPTIONAL: Record<string, string[]> = { fav_tracks: ["fav_tracks"], note_lang: ["note_lang", "note_en"], note_en: ["note_lang", "note_en"] };
  const saveWith = async (run: (values: Record<string, unknown>) => PromiseLike<Result>, values: Record<string, unknown>) => {
    let current = { ...values };
    let res = await run(current);
    for (let i = 0; i < 3 && res.error && (res.error.code === "PGRST204" || res.error.code === "42703"); i++) {
      const msg = res.error.message ?? "";
      const col = Object.keys(OPTIONAL).find((c) => msg.includes(c) && c in current);
      if (!col) break;
      current = { ...current };
      for (const c of OPTIONAL[col]) delete current[c];
      res = await run(current);
    }
    return { ...res, saved: current };
  };

  if (entryId) {
    // Editing: first listen / relisten stays as it was logged.
    const update = (values: Record<string, unknown>) =>
      supabase.from("entries").update({ ...values, updated_at: new Date().toISOString() }).eq("id", entryId).eq("user_id", user.id);
    // The first entry of a record can switch between "first listen" and "heard it before".
    if ((kindChoice === "first" || kindChoice === "before") && (before as { kind?: string } | null)?.kind !== "relisten") fields.kind = kindChoice;
    let { error, saved } = await saveWith(update, fields);
    if (error && fields.kind === "before") ({ error } = await saveWith(update, { ...saved, kind: "first" })); // before migration 0008
    if (error) throw new Error("Could not save your changes.");
    await closeSuggestions(supabase, user.id, { albumId });
    await syncExplore(supabase, user.id, albumId, formData);
    revalidatePath("/", "layout");
    redirect("/?saved=edited");
  }

  const { count } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("album_id", albumId);

  const insert = (values: Record<string, unknown>) =>
    supabase.from("entries").insert({
      ...values,
      user_id: user.id,
      album_id: albumId,
      kind: (count ?? 0) > 0 ? "relisten" : kindChoice === "before" ? "before" : "first",
    });
  let { error, saved } = await saveWith(insert, fields);
  if (error && kindChoice === "before" && !count) {
    // Before migration 0008 'before' isn't allowed yet: save it as a first listen.
    ({ error } = await saveWith((v) => supabase.from("entries").insert({ ...v, user_id: user.id, album_id: albumId, kind: "first" }), saved));
  }
  if (error) throw new Error("Could not save the entry.");

  await supabase.from("to_listen").delete().eq("user_id", user.id).eq("album_id", albumId);
  const suggestionId = String(formData.get("suggestion_id") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(suggestionId)) await supabase.from("lastfm_suggestions").update({ status: "logged" }).eq("id", suggestionId).eq("user_id", user.id);
  await closeSuggestions(supabase, user.id, { albumId });
  await syncExplore(supabase, user.id, albumId, formData);
  revalidatePath("/", "layout");
  redirect(kindChoice === "before" && !count ? "/?saved=before" : "/?saved=1");
}

export async function deleteEntry(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const { data: gone } = await supabase.from("entries").select("listened_on, album:albums(deezer_id)").eq("id", id).eq("user_id", user.id).maybeSingle();
  await supabase.from("entries").delete().eq("id", id).eq("user_id", user.id);
  // Logged from Spotify (by you or automatically) and then deleted: it goes back to being a suggestion,
  // e.g. "You started …" when you hadn't really finished it.
  const g = gone as unknown as { listened_on: string; album: { deezer_id: number | null } | null } | null;
  if (g?.album?.deezer_id)
    await supabase.from("lastfm_suggestions").update({ status: "pending" }).eq("user_id", user.id).eq("deezer_id", g.album.deezer_id).eq("played_on", g.listened_on).eq("status", "logged");
  revalidatePath("/", "layout");
  if (formData.get("redirect_to") === "/") redirect("/?saved=deleted");
}

export async function toggleToListen(formData: FormData) {
  const { supabase, user } = await requireUser();
  const albumId = String(formData.get("album_id") ?? "");
  const source = String(formData.get("source") ?? "").slice(0, 200) || null;
  const { data } = await supabase.from("to_listen").select("album_id").eq("user_id", user.id).eq("album_id", albumId).maybeSingle();
  if (data) await supabase.from("to_listen").delete().eq("user_id", user.id).eq("album_id", albumId);
  else await supabase.from("to_listen").insert({ user_id: user.id, album_id: albumId, source });
  revalidatePath("/", "layout");
}

export async function toggleCollection(formData: FormData) {
  const { supabase, user } = await requireUser();
  const albumId = String(formData.get("album_id") ?? "");
  const field = String(formData.get("field") ?? "");
  if (!["vinyl", "cd", "wishlist"].includes(field)) return;
  const { data } = await supabase.from("collection").select("vinyl, cd, wishlist").eq("user_id", user.id).eq("album_id", albumId).maybeSingle();
  const current = (data ?? { vinyl: false, cd: false, wishlist: false }) as Record<string, boolean>;
  const next = { ...current, [field]: !current[field] };
  await supabase.from("collection").upsert({ user_id: user.id, album_id: albumId, ...next, updated_at: new Date().toISOString() });
  revalidatePath("/", "layout");
}

export type ProfileState = { ok?: boolean; error?: string };

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const { supabase, user } = await requireUser();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const displayName = String(formData.get("display_name") ?? "").trim().slice(0, 60) || null;
  if (!/^[a-z0-9._]{3,24}$/.test(username)) return { error: "Username: 3–24 characters, lowercase letters, numbers, dots or underscores." };
  const { error } = await supabase.from("profiles").update({ username, display_name: displayName }).eq("id", user.id);
  if (error) return { error: error.code === "23505" ? "That username is taken." : "Could not save your profile." };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOut() {
  const { supabase } = await getUser();
  await supabase.auth.signOut();
  redirect("/login");
}

const GOALS = ["diary", "discover", "collection"];

export async function completeOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser();
  const goals = formData.getAll("goals").map(String).filter((g) => GOALS.includes(g));
  type Pick = { id: number; name: string; picture?: string };
  let artists: Pick[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("artists") ?? "[]"));
    if (Array.isArray(parsed))
      artists = parsed
        .filter((a) => Number.isInteger(a?.id) && typeof a?.name === "string")
        .slice(0, 30)
        .map((a) => ({ id: a.id, name: String(a.name).slice(0, 300), picture: typeof a.picture === "string" ? a.picture.slice(0, 500) : undefined }));
  } catch {
    artists = [];
  }

  // Replace the favourites with what was picked (the quiz can be retaken from Settings).
  await supabase.from("favorite_artists").delete().eq("user_id", user.id);
  if (artists.length)
    await supabase.from("favorite_artists").insert(
      artists.map((a) => ({ user_id: user.id, deezer_artist_id: a.id, artist: a.name, picture: a.picture ?? null }))
    );
  await supabase.from("profiles").update({ goals, onboarded_at: new Date().toISOString() }).eq("id", user.id);
  revalidatePath("/", "layout");
  redirect(goals.includes("discover") && artists.length ? "/discover?welcome=1" : "/?welcome=1");
}

export async function skipOnboarding() {
  const { supabase, user } = await requireUser();
  await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", user.id);
  revalidatePath("/", "layout");
  redirect("/");
}

/** Tapping a record on an artist page: save it to the catalogue if needed, then open its page. */
export async function openFromDeezer(formData: FormData) {
  const { supabase } = await requireUser();
  const deezerId = Number(formData.get("deezer_id"));
  if (!Number.isInteger(deezerId) || deezerId <= 0) return;
  const albumId = await ensureAlbum(supabase, deezerId);
  if (!albumId) return;
  const { data } = await supabase.from("albums").select("*").eq("id", albumId).maybeSingle();
  redirect(data ? recordPath(data as Album) : "/");
}

/** "I want to hear more" on an artist page. */
export async function setExploring(formData: FormData) {
  const { supabase, user } = await requireUser();
  const artistId = Number(formData.get("deezer_artist_id"));
  const artist = String(formData.get("artist") ?? "").slice(0, 300);
  if (!Number.isInteger(artistId) || artistId <= 0 || !artist) return;
  if (formData.get("on") === "1") {
    await supabase
      .from("explore_artists")
      .upsert({ user_id: user.id, deezer_artist_id: artistId, artist }, { onConflict: "user_id,deezer_artist_id", ignoreDuplicates: true });
  } else {
    await supabase.from("explore_artists").delete().eq("user_id", user.id).eq("deezer_artist_id", artistId);
  }
  revalidatePath("/", "layout");
}

// ─────────────────────────────────────────────────────────────
// Discover: Shuffle and "Not for me"
// ─────────────────────────────────────────────────────────────
const validScope = (s: string) => s === "daily" || /^genre:[a-z0-9-]{2,60}$/.test(s);

export async function shuffleDiscover(formData: FormData) {
  const { supabase, user } = await requireUser();
  const scope = String(formData.get("scope") ?? "");
  if (!validScope(scope)) return;
  await shufflePicks(supabase, user.id, scope);
  revalidatePath("/discover", "layout");
}

export async function notForMe(formData: FormData) {
  const { supabase, user } = await requireUser();
  const scope = String(formData.get("scope") ?? "");
  const slot = String(formData.get("slot") ?? "") as Slot;
  const deezerId = Number(formData.get("deezer_id"));
  if (!validScope(scope) || !SLOTS.includes(slot) || !Number.isInteger(deezerId) || deezerId <= 0) return;
  await dismissPick(supabase, user.id, scope, slot, deezerId);
  revalidatePath("/discover", "layout");
}

/** After "Already heard it": a new pick in that slot, without marking the old one "Not for me". */
export async function swapPick(formData: FormData) {
  const { supabase, user } = await requireUser();
  const scope = String(formData.get("scope") ?? "");
  const slot = String(formData.get("slot") ?? "") as Slot;
  const deezerId = Number(formData.get("deezer_id"));
  if (!validScope(scope) || !SLOTS.includes(slot) || !Number.isInteger(deezerId) || deezerId <= 0) return;
  await dismissPick(supabase, user.id, scope, slot, deezerId, false);
  revalidatePath("/discover", "layout");
}

/** "Not now" on a "Remember this?" reminder: don't bring that record up again for six months. */
export async function snoozeRediscover(formData: FormData) {
  const { supabase, user } = await requireUser();
  const albumId = String(formData.get("album_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(albumId)) return;
  const until = new Date(todayIso() + "T12:00:00Z");
  until.setUTCMonth(until.getUTCMonth() + 6);
  await supabase.from("rediscover_snoozed").upsert({ user_id: user.id, album_id: albumId, until: until.toISOString().slice(0, 10) }, { onConflict: "user_id,album_id" });
  revalidatePath("/");
}

/**
 * Quick mode, "records you know": rate a record straight from search or the artist page.
 * Saved as heard-before (no date, no note). If it's already on your shelf the rating is updated;
 * a record already logged with a date is left as it is.
 */
export async function quickRate(deezerId: number, rating: number): Promise<{ status: "added" | "updated" | "logged" | "diary" | "error" }> {
  const { supabase, user } = await requireUser();
  if (!Number.isInteger(deezerId) || deezerId <= 0 || !isRating(rating)) return { status: "error" };
  const albumId = await ensureAlbum(supabase, deezerId);
  if (!albumId) return { status: "error" };
  // Spotify says you're playing it right now (on the turntable, or suggested): that's a real listen,
  // logged on the day you played it — not "heard before".
  const playing = await activeListenDay(supabase, user.id, deezerId);
  if (playing) {
    if (!(await logAlbumListen(supabase, user.id, deezerId, playing, rating))) return { status: "error" };
    await closeSuggestions(supabase, user.id, { deezerId });
    revalidatePath("/", "layout");
    return { status: "diary" };
  }
  const { data: existing } = await supabase.from("entries").select("id, kind").eq("user_id", user.id).eq("album_id", albumId);
  const rows = (existing ?? []) as { id: string; kind: string }[];
  if (rows.some((r) => r.kind !== "before")) return { status: "logged" };
  if (rows.length) {
    const { error } = await supabase.from("entries").update({ rating, updated_at: new Date().toISOString() }).eq("id", rows[0].id).eq("user_id", user.id);
    if (error) return { status: "error" };
    revalidatePath("/", "layout");
    return { status: "updated" };
  }
  let { error } = await supabase.from("entries").insert({ user_id: user.id, album_id: albumId, rating, kind: "before", listened_on: todayIso() });
  if (error) ({ error } = await supabase.from("entries").insert({ user_id: user.id, album_id: albumId, rating, kind: "first", listened_on: todayIso() })); // before migration 0008
  if (error) return { status: "error" };
  await supabase.from("to_listen").delete().eq("user_id", user.id).eq("album_id", albumId);
  revalidatePath("/", "layout");
  return { status: "added" };
}

// ─────────────────────────────────────────────────────────────
// Spotify via Last.fm
// ─────────────────────────────────────────────────────────────
export async function connectLastfm(formData: FormData) {
  const { supabase, user } = await requireUser();
  const raw = String(formData.get("username") ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?last\.fm\/user\//i, "").replace(/\/.*$/, "");
  if (!/^[A-Za-z0-9_-]{2,32}$/.test(raw)) redirect("/settings?lastfm=invalid#lastfm");
  let name = raw;
  try {
    name = (await getLastfmUser(raw)).name;
  } catch (e) {
    redirect(`/settings?lastfm=${e instanceof LastfmError && e.code === 6 ? "notfound" : "unavailable"}#lastfm`);
  }
  const { error } = await supabase.from("lastfm_links").upsert({ user_id: user.id, username: name, synced_at: null }, { onConflict: "user_id" });
  if (error) redirect("/settings?lastfm=setup#lastfm");
  await syncLastfm(supabase, user.id, { force: true });
  revalidatePath("/", "layout");
  redirect("/settings?lastfm=connected#lastfm");
}

export async function disconnectLastfm() {
  const { supabase, user } = await requireUser();
  await supabase.from("lastfm_suggestions").delete().eq("user_id", user.id).eq("status", "pending");
  await supabase.from("lastfm_links").delete().eq("user_id", user.id);
  revalidatePath("/", "layout");
  redirect("/settings#lastfm");
}

export async function setLastfmAutolog(formData: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from("lastfm_links").update({ autolog: formData.get("on") === "1" }).eq("user_id", user.id);
  revalidatePath("/settings");
}

export async function syncLastfmNow() {
  const { supabase, user } = await requireUser();
  const res = await syncLastfm(supabase, user.id, { force: true });
  revalidatePath("/", "layout");
  redirect(`/settings?lastfm=${res.error ? "unavailable" : `synced-${res.added}`}#lastfm`);
}

/** Stars on a "Looks like you listened to …" suggestion: logs it on the day it was played. */
export async function rateSuggestion(id: string, rating: number): Promise<{ status: "added" | "updated" | "logged" | "error" }> {
  const { supabase, user } = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !isRating(rating)) return { status: "error" };
  const { data } = await supabase.from("lastfm_suggestions").select("deezer_id, played_on, status").eq("id", id).eq("user_id", user.id).maybeSingle();
  const s = data as { deezer_id: number; played_on: string; status: string } | null;
  if (!s) return { status: "error" };
  if (s.status === "logged") return { status: "logged" };
  if (!(await logAlbumListen(supabase, user.id, s.deezer_id, s.played_on, rating))) return { status: "error" };
  await supabase.from("lastfm_suggestions").update({ status: "logged" }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/", "layout");
  return { status: "added" };
}

/** "Not now", or never suggest this album / artist again. */
export async function dismissSuggestion(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  const mute = String(formData.get("mute") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const { data } = await supabase.from("lastfm_suggestions").select("deezer_id, title, artist").eq("id", id).eq("user_id", user.id).maybeSingle();
  const s = data as { deezer_id: number; title: string; artist: string } | null;
  if (!s) return;
  await supabase.from("lastfm_suggestions").update({ status: "dismissed" }).eq("id", id).eq("user_id", user.id);
  if (mute === "album") await supabase.from("lastfm_muted").upsert({ user_id: user.id, kind: "album", key: String(s.deezer_id), label: s.title });
  if (mute === "artist") {
    await supabase.from("lastfm_muted").upsert({ user_id: user.id, kind: "artist", key: looseName(s.artist), label: s.artist });
    await supabase.from("lastfm_suggestions").update({ status: "dismissed" }).eq("user_id", user.id).eq("status", "pending").eq("artist", s.artist);
  }
  revalidatePath("/", "layout");
}

/** "I'm on it": the album goes on the turntable and its progress follows your scrobbles. */
export async function onTheTurntable(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await supabase.from("lastfm_suggestions").update({ status: "listening" }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/", "layout");
}

/** "I'll get back to it" / "Put it back": into To listen, off the diary. */
export async function backToToListen(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const { data } = await supabase.from("lastfm_suggestions").select("deezer_id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!data) return;
  await parkInToListen(supabase, user.id, (data as { deezer_id: number }).deezer_id);
  await supabase.from("lastfm_suggestions").update({ status: "dismissed" }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/", "layout");
  redirect("/?saved=tolisten");
}

/** Mark a track as played yourself (Last.fm missed it, or you heard it some other way) — or take your mark back. */
export async function markTrack(deezerId: number, track: string, on: boolean): Promise<{ ok: boolean }> {
  const { supabase, user } = await requireUser();
  const key = trackKey(String(track ?? ""));
  if (!Number.isInteger(deezerId) || deezerId <= 0 || !key || key.length > 300) return { ok: false };
  if (on) {
    const { error } = await supabase.from("track_marks").upsert({ user_id: user.id, deezer_id: deezerId, track: key }, { onConflict: "user_id,deezer_id,track", ignoreDuplicates: true });
    if (error) return { ok: false };
    // An album you're on (or were just suggested) counts it too, so its progress — and "finished" — follow.
    const { data } = await supabase.from("lastfm_suggestions").select("id, tracks, total_tracks").eq("user_id", user.id).eq("deezer_id", deezerId).in("status", ["pending", "listening"]);
    for (const r of (data ?? []) as { id: string; tracks: string[] | null; total_tracks: number }[]) {
      const tracks = [...new Set([...(r.tracks ?? []), key])];
      await supabase.from("lastfm_suggestions").update({ tracks, tracks_played: Math.min(tracks.length, r.total_tracks) }).eq("id", r.id).eq("user_id", user.id);
    }
  } else {
    const { error } = await supabase.from("track_marks").delete().eq("user_id", user.id).eq("deezer_id", deezerId).eq("track", key);
    if (error) return { ok: false };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Challenges
// ─────────────────────────────────────────────────────────────
/** Start a challenge: "artist" (ref = Deezer artist id) or "list" (ref = curated list slug). */
export async function startChallenge(formData: FormData) {
  const { supabase, user } = await requireUser();
  const kind = String(formData.get("kind") ?? "");
  const ref = String(formData.get("ref") ?? "");
  let title: string | null = null;
  if (kind === "list") title = listBySlug(ref)?.title ?? null;
  if (kind === "artist" && /^\d{1,12}$/.test(ref)) title = await getArtist(Number(ref)).then((a) => a.name).catch(() => null);
  if (!title) redirect("/challenges");
  const { data: existing } = await supabase.from("challenges").select("id").eq("user_id", user.id).eq("kind", kind).eq("ref", ref).maybeSingle();
  let id = (existing as { id: string } | null)?.id;
  if (!id) {
    const { data, error } = await supabase.from("challenges").insert({ user_id: user.id, kind, ref, title }).select("id").single();
    if (error || !data) redirect("/challenges?error=setup");
    id = (data as { id: string }).id;
  }
  revalidatePath("/", "layout");
  redirect(`/challenges/${id}?started=1`);
}

export async function stopChallenge(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(id)) await supabase.from("challenges").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/", "layout");
  redirect("/challenges");
}

// ─────────────────────────────────────────────────────────────
// Logged automatically from Spotify: "how was it?"
// ─────────────────────────────────────────────────────────────
async function autoLogged(supabase: Supabase, userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await supabase.from("lastfm_suggestions").select("id, deezer_id, played_on, title, artist").eq("id", id).eq("user_id", userId).eq("status", "logged").maybeSingle();
  const s = data as { id: string; deezer_id: number; played_on: string; title: string; artist: string } | null;
  if (!s) return null;
  const { data: e } = await supabase
    .from("entries")
    .select("id, album:albums!inner(deezer_id)")
    .eq("user_id", userId)
    .eq("listened_on", s.played_on)
    .eq("album.deezer_id", s.deezer_id)
    .limit(1)
    .maybeSingle();
  return { s, entryId: (e as { id: string } | null)?.id ?? null };
}

/** Stars on an album that was logged automatically. */
export async function rateLogged(id: string, rating: number): Promise<{ status: "added" | "updated" | "logged" | "error" }> {
  const { supabase, user } = await requireUser();
  if (!isRating(rating)) return { status: "error" };
  const found = await autoLogged(supabase, user.id, id);
  if (!found?.entryId) return { status: "error" };
  const { error } = await supabase.from("entries").update({ rating, updated_at: new Date().toISOString() }).eq("id", found.entryId).eq("user_id", user.id);
  if (error) return { status: "error" };
  await supabase.from("lastfm_suggestions").update({ review: null }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/", "layout");
  return { status: "added" };
}

/** "I'll do it later": it waits at the bottom of the diary. */
export async function reviewLater(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(id)) await supabase.from("lastfm_suggestions").update({ review: "later" }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/");
}

/**
 * Logged automatically, but it wasn't really an album listen: take it out of the diary —
 * and, if you like, never log that album (or anything by that artist) from Spotify again.
 */
export async function undoAutoLog(formData: FormData) {
  const { supabase, user } = await requireUser();
  const found = await autoLogged(supabase, user.id, String(formData.get("id") ?? ""));
  if (!found) return;
  const mute = String(formData.get("mute") ?? "");
  if (found.entryId) await supabase.from("entries").delete().eq("id", found.entryId).eq("user_id", user.id);
  await supabase.from("lastfm_suggestions").update({ status: "dismissed", review: null }).eq("id", found.s.id).eq("user_id", user.id);
  if (mute === "album") await supabase.from("lastfm_muted").upsert({ user_id: user.id, kind: "album", key: String(found.s.deezer_id), label: found.s.title });
  if (mute === "artist") await supabase.from("lastfm_muted").upsert({ user_id: user.id, kind: "artist", key: looseName(found.s.artist), label: found.s.artist });
  revalidatePath("/", "layout");
}

/** "Just listened": keep it in the diary as it is — no stars, no words — and stop asking. */
export async function keepAsListened(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (/^[0-9a-f-]{36}$/i.test(id)) await supabase.from("lastfm_suggestions").update({ review: null }).eq("id", id).eq("user_id", user.id);
  revalidatePath("/");
}

/** Settings: undo "never log this album / artist". */
export async function unmuteLastfm(formData: FormData) {
  const { supabase, user } = await requireUser();
  const kind = String(formData.get("kind") ?? "");
  const key = String(formData.get("key") ?? "");
  if ((kind === "album" || kind === "artist") && key) await supabase.from("lastfm_muted").delete().eq("user_id", user.id).eq("kind", kind).eq("key", key);
  revalidatePath("/settings");
}

/** Discover: "I listened to it" — logs today's listen (on the day Spotify saw it, if it did) with your stars. */
export async function logListenToday(deezerId: number, rating: number): Promise<{ status: "diary" | "updated" | "error" }> {
  const { supabase, user } = await requireUser();
  if (!Number.isInteger(deezerId) || deezerId <= 0 || !isRating(rating)) return { status: "error" };
  const day = (await activeListenDay(supabase, user.id, deezerId)) ?? todayIso();
  const { data: existing } = await supabase
    .from("entries")
    .select("id, album:albums!inner(deezer_id)")
    .eq("user_id", user.id)
    .eq("listened_on", day)
    .neq("kind", "before")
    .eq("album.deezer_id", deezerId)
    .limit(1)
    .maybeSingle();
  if (existing) {
    await supabase.from("entries").update({ rating, updated_at: new Date().toISOString() }).eq("id", (existing as { id: string }).id).eq("user_id", user.id);
    revalidatePath("/", "layout");
    return { status: "updated" };
  }
  if (!(await logAlbumListen(supabase, user.id, deezerId, day, rating))) return { status: "error" };
  await closeSuggestions(supabase, user.id, { deezerId });
  revalidatePath("/", "layout");
  return { status: "diary" };
}

/** Stars on an entry that's already in the diary. */
export async function rateEntry(entryId: string, rating: number): Promise<{ status: "updated" | "error" }> {
  const { supabase, user } = await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(entryId) || !isRating(rating)) return { status: "error" };
  const { error } = await supabase.from("entries").update({ rating, updated_at: new Date().toISOString() }).eq("id", entryId).eq("user_id", user.id);
  if (error) return { status: "error" };
  revalidatePath("/", "layout");
  return { status: "updated" };
}
