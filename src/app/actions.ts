"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { TAGS, todayIso } from "@/lib/format";

async function requireUser() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/login");
  return { supabase, user };
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

  const fields = {
    listened_on: listenedOn,
    rating,
    format: ["stream", "vinyl", "cd"].includes(format) ? format : "stream",
    note,
    tags,
    is_private: isPrivate,
    is_anonymous: isAnonymous,
  };

  if (entryId) {
    // Editing: first listen / relisten stays as it was logged.
    const { error } = await supabase
      .from("entries")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", entryId)
      .eq("user_id", user.id);
    if (error) throw new Error("Could not save your changes.");
    revalidatePath("/", "layout");
    redirect("/?saved=edited");
  }

  const { count } = await supabase
    .from("entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("album_id", albumId);

  const { error } = await supabase.from("entries").insert({
    ...fields,
    user_id: user.id,
    album_id: albumId,
    kind: (count ?? 0) > 0 ? "relisten" : "first",
  });
  if (error) throw new Error("Could not save the entry.");

  await supabase.from("to_listen").delete().eq("user_id", user.id).eq("album_id", albumId);
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
