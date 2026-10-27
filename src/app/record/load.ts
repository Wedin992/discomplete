import { cache } from "react";
import { getUser } from "@/lib/supabase/server";
import { isUuid, type Album } from "@/lib/format";

export const albumById = cache(async (id: string) => {
  if (!isUuid(id)) return null;
  const { supabase } = await getUser();
  const { data } = await supabase.from("albums").select("*").eq("id", id).maybeSingle();
  return data as Album | null;
});

export const albumBySlug = cache(async (artist: string, title: string) => {
  if (!/^[a-z0-9-]{1,90}$/.test(artist) || !/^[a-z0-9-]{1,90}$/.test(title)) return null;
  const { supabase } = await getUser();
  const { data, error } = await supabase.from("albums").select("*").eq("artist_slug", artist).eq("title_slug", title).maybeSingle();
  if (error) return null;
  return data as Album | null;
});
