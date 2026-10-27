import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { isUuid, logPath } from "@/lib/format";
import { RecordView } from "../../RecordView";
import { LogView } from "../../LogView";
import { albumById, albumBySlug } from "../../load";

type Params = Promise<{ artist: string; title: string }>;

async function resolve(params: Params) {
  const { artist, title } = await params;
  // Old-style /record/<id>/log
  if (isUuid(artist) && title === "log") return { album: await albumById(artist), legacyLog: true };
  return { album: await albumBySlug(artist, title), legacyLog: false };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { album, legacyLog } = await resolve(params);
  if (!album) return { title: "Record" };
  return { title: legacyLog ? "Log a listen" : `${album.title} — ${album.artist}` };
}

export default async function RecordPage({ params }: { params: Params }) {
  const { album, legacyLog } = await resolve(params);
  if (!album) notFound();
  if (legacyLog) {
    if (album.artist_slug && album.title_slug) permanentRedirect(logPath(album));
    return <LogView album={album} />;
  }
  return <RecordView album={album} />;
}
