import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { recordPath } from "@/lib/format";
import { RecordView } from "../RecordView";
import { albumById } from "../load";

// Old-style links: /record/<id>. Sends people on to the readable address.
export async function generateMetadata({ params }: { params: Promise<{ artist: string }> }): Promise<Metadata> {
  const album = await albumById((await params).artist);
  return { title: album ? `${album.title} — ${album.artist}` : "Record" };
}

export default async function RecordByIdPage({ params }: { params: Promise<{ artist: string }> }) {
  const album = await albumById((await params).artist);
  if (!album) notFound();
  if (album.artist_slug && album.title_slug) permanentRedirect(recordPath(album));
  return <RecordView album={album} />;
}
