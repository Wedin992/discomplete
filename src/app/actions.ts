"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { TAGS, logPath, todayIso, type Album } from "@/lib/format";
import { translateToEnglish } from "@/lib/translate";
import { getAlbum } from "@/lib/deezer";

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

export async function saveEntry(formData: FormData) {
  const { supabase, user } = await requireUser();
  const albumId = String(formData.get("album_id") ?? "");
  const entryId = String(formData.get("entry_id") ?? "");
  const format = String(formData.get("format") ?? "stream");
  const ratingRaw = Number(formData.get("rating") ?? 0);
  const rating = Number.isInteger(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 5000) || null;
  const tags = formData.getAll("tags").map(String).filter((t) => TAGS.includes(t));
  const isPrivate = formData.get("is_private") === "on";
  const isAnonymous = !isPrivate && formData.get("is_anonymous") === "on";
  const listenedOnRaw = String(formData.get("listened_on") ?? "");
  const listenedOn = /^\d{4}-\d{2}-\d{2}$/.test(listenedOnRaw) && listenedOnRaw <= todayIso() ? listenedOnRaw : todayIso();

  const fields: Record<string, unknown> = {
    listened_on: listenedOn,
    rating,
    format: ["stream", "vinyl", "cd"].includes(format) ? format : "stream",
    note,
    tags,
    is_private: isPrivate,
    is_anonymous: isAnonymous,
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

  // Until migration 0003 has run, the translation columns don't exist: save without them.
  const withoutTranslation = () => {
    const rest = { ...fields };
    delete rest.note_lang;
    delete rest.note_en;
    return rest;
  };
  const missingColumn = (e: { code?: string; message?: string } | null) =>
    !!e && (e.code === "PGRST204" || e.code === "42703" || /note_(en|lang)/.test(e.message ?? ""));

  if (entryId) {
    // Editing: first listen / relisten stays as it was logged.
    const update = (values: Record<string, unknown>) =>
      supabase.from("entries").update({ ...values, updated_at: new Date().toISOString() }).eq("id", entryId).eq("user_id", user.id);
    let { error } = await update(fields);
    if (missingColumn(error)) ({ error } = await update(withoutTranslation()));
    if (error) throw new Error("Could not save your changes.");
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
      kind: (count ?? 0) > 0 ? "relisten" : "first",
    });
  let { error } = await insert(fields);
  if (missingColumn(error)) ({ error } = await insert(withoutTranslation()));
  if (error) throw new Error("Could not save the entry.");

  await supabase.from("to_listen").delete().eq("user_id", user.id).eq("album_id", albumId);
  await syncExplore(supabase, user.id, albumId, formData);
  revalidatePath("/", "layout");
  redirect("/?saved=1");
}

export async function deleteEntry(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") ?? "");
  await supabase.from("entries").delete().eq("id", id).eq("user_id", user.id);
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
