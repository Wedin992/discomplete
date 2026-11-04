import { Suspense } from "react";
import { getUser } from "@/lib/supabase/server";
import { YouMayLike } from "@/app/artist/[slug]/YouMayLike";
import { ExploreArtists } from "@/app/to-listen/ExploreArtists";

/**
 * Discover is only for finding something new. Under Today's three:
 * "If you like <the artist you loved most recently>…" and new albums from artists you're exploring.
 * (Your parties, challenges and queue live under Listening.)
 */
export async function DiscoverRows() {
  const { supabase, user } = await getUser();
  const { data } = await supabase
    .from("entries")
    .select("rating, album:albums!inner(artist, deezer_artist_id)")
    .eq("user_id", user!.id)
    .gte("rating", 4)
    .not("album.deezer_artist_id", "is", null)
    .order("listened_on", { ascending: false })
    .limit(1);
  const loved = ((data ?? []) as unknown as { album: { artist: string; deezer_artist_id: number } }[])[0]?.album;
  return (
    <>
      {loved ? <YouMayLike artistId={loved.deezer_artist_id} artistName={loved.artist} /> : null}
      <Suspense fallback={null}>
        <ExploreArtists />
      </Suspense>
    </>
  );
}
