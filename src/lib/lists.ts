import type { getUser } from "@/lib/supabase/server";
import { cover, type Album } from "@/lib/format";

type Supabase = Awaited<ReturnType<typeof getUser>>["supabase"];

export type List = { id: string; user_id: string; title: string; description: string | null; is_public: boolean; ranked: boolean; created_at: string; updated_at: string };
export type ListItem = { position: number; note: string | null; album: Album };
export type ListSummary = List & { count: number; covers: Album[] };

const LIST = "id, user_id, title, description, is_public, ranked, created_at, updated_at";

/** Your lists, newest first, each with a few covers. `ready` is false before migration 0018. */
export async function myLists(supabase: Supabase, userId: string): Promise<{ lists: ListSummary[]; ready: boolean }> {
  const { data, error } = await supabase.from("lists").select(`${LIST}, items:list_items(position, album:albums(*))`).eq("user_id", userId).order("updated_at", { ascending: false });
  if (error) return { lists: [], ready: false };
  return { lists: ((data ?? []) as unknown as (List & { items: ListItem[] })[]).map(summary), ready: true };
}

export function summary(l: List & { items: ListItem[] }): ListSummary {
  const items = [...(l.items ?? [])].sort((a, b) => a.position - b.position);
  const { items: _drop, ...rest } = l;
  void _drop;
  return { ...rest, count: items.length, covers: items.slice(0, 4).map((i) => i.album) };
}

export async function loadList(supabase: Supabase, id: string): Promise<{ list: List; items: ListItem[]; owner: { username: string; display_name: string | null } | null } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await supabase.from("lists").select(LIST).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const list = data as List;
  const [itemsRes, ownerRes] = await Promise.all([
    supabase.from("list_items").select("position, note, album:albums(*)").eq("list_id", id).order("position"),
    supabase.from("profiles").select("username, display_name").eq("id", list.user_id).maybeSingle(),
  ]);
  return { list, items: (itemsRes.data ?? []) as unknown as ListItem[], owner: ownerRes.data as { username: string; display_name: string | null } | null };
}

/** A few albums from your To listen, for quick picking. */
export async function queuedOptions(supabase: Supabase, userId: string, limit = 5) {
  const { data } = await supabase.from("to_listen").select("album:albums(deezer_id, title, artist, cover_small, cover_medium, cover_xl)").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as unknown as { album: { deezer_id: number | null; title: string; artist: string; cover_small: string | null; cover_medium: string | null; cover_xl: string | null } | null }[])
    .map((r) => r.album)
    .filter((a): a is NonNullable<typeof a> => !!a?.deezer_id)
    .map((a) => ({ deezerId: a.deezer_id!, title: a.title, artist: a.artist, cover: cover(a, "s") }));
}
