import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { Quiz } from "./Quiz";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const { supabase, user } = await getUser();
  const [profileRes, favRes] = await Promise.all([
    supabase.from("profiles").select("goals, display_name, onboarded_at").eq("id", user!.id).maybeSingle(),
    supabase.from("favorite_artists").select("deezer_artist_id, artist, picture").eq("user_id", user!.id).order("created_at"),
  ]);
  const profile = profileRes.data as { goals?: string[]; display_name?: string | null; onboarded_at?: string | null } | null;
  const favourites = ((favRes.data ?? []) as { deezer_artist_id: number; artist: string; picture: string | null }[]).map((f) => ({
    id: f.deezer_artist_id,
    name: f.artist,
    picture: f.picture ?? undefined,
  }));

  return (
    <Quiz
      name={profile?.display_name ?? null}
      initialGoals={profile?.goals ?? []}
      initialArtists={favourites}
      retaking={!!profile?.onboarded_at}
    />
  );
}
