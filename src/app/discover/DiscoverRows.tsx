import { getUser } from "@/lib/supabase/server";
import { myClubs } from "@/lib/clubs";
import { viewChallenges, challengeTitle, doneIn } from "@/lib/challenges";
import { AlbumRow, type RowItem } from "@/components/AlbumRow";
import type { Album } from "@/lib/format";

/** Swipeable rows under Today's three — all from your own world: parties, challenges, lists, To listen. */
export async function DiscoverRows() {
  const { supabase, user } = await getUser();
  const [{ clubs }, { views, index }, listsRes, queueRes] = await Promise.all([
    myClubs(supabase, user!.id),
    viewChallenges(supabase, user!.id, 8),
    supabase.from("list_items").select("note, list:lists!inner(id, title, user_id), album:albums(*)").eq("list.user_id", user!.id).limit(200),
    supabase.from("to_listen").select("source, album:albums(*)").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(15),
  ]);

  const parties: RowItem[] = clubs.filter((c) => c.current).map((c) => ({
    album: c.current!.album,
    sub: `${c.name} · ${c.members.filter((m) => m.listened).length}/${c.members.length}`,
    href: `/parties/${c.id}`,
  }));

  const picks: RowItem[] = views.filter((v) => v.draw).map((v) => ({
    album: { id: `d${v.draw!.deezerId}`, deezer_id: v.draw!.deezerId, title: v.draw!.title, artist: v.draw!.artist, cover_small: v.draw!.cover, cover_medium: v.draw!.cover, cover_xl: v.draw!.cover } as unknown as Album,
    sub: `${challengeTitle(v)} · ${v.done}/${v.total}`,
    href: `/open/${v.draw!.deezerId}`,
  }));

  const fromLists: RowItem[] = [];
  if (!listsRes.error) {
    const seen = new Set<string>();
    for (const r of (listsRes.data ?? []) as unknown as { list: { id: string; title: string } | null; album: Album | null }[]) {
      if (!r.album || seen.has(r.album.id)) continue;
      if (index && doneIn(index, { deezerId: r.album.deezer_id ?? 0, artist: r.album.artist, title: r.album.title })) continue;
      seen.add(r.album.id);
      fromLists.push({ album: r.album, sub: r.list?.title ?? r.album.artist });
    }
  }

  const queue: RowItem[] = ((queueRes.data ?? []) as unknown as { source: string | null; album: Album | null }[])
    .filter((r) => r.album)
    .map((r) => ({ album: r.album!, sub: r.album!.artist }));

  return (
    <>
      <AlbumRow title="Your listening parties" href="/parties" linkLabel="Parties" items={parties} />
      <AlbumRow title="Today’s picks from your challenges" href="/challenges" linkLabel="Challenges" items={picks} />
      <AlbumRow title="Not heard yet, from your lists" href="/lists" linkLabel="Lists" items={fromLists.slice(0, 15)} />
      <AlbumRow title="Next up · To listen" href="/to-listen" linkLabel="To listen" items={queue} />
    </>
  );
}
