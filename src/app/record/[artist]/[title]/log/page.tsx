import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogView } from "../../../LogView";
import { albumBySlug } from "../../../load";

export const metadata: Metadata = { title: "Log a listen" };

export default async function LogRecordPage({ params }: { params: Promise<{ artist: string; title: string }> }) {
  const { artist, title } = await params;
  const album = await albumBySlug(artist, title);
  if (!album) notFound();
  return <LogView album={album} />;
}
