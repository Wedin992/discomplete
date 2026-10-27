import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { DeleteEntryButton } from "@/components/DeleteEntryButton";
import { kindLabel, longDate, todayIso, type EntryWithAlbum } from "@/lib/format";
import { LogForm } from "@/app/record/[id]/log/LogForm";

export const metadata: Metadata = { title: "Edit entry" };

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await getUser();
  const { data } = await supabase.from("entries").select("*, album:albums(*)").eq("id", id).eq("user_id", user!.id).maybeSingle();
  const entry = data as unknown as EntryWithAlbum | null;
  if (!entry) notFound();
  const album = entry.album;

  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 720 }}>
      <div className="row gap-16">
        <Cover album={album} size="96" />
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <p className="eyebrow">Editing · {kindLabel(entry.kind)} · {longDate(entry.listened_on)}</p>
          <h1 className="title-m" style={{ marginTop: 4 }}>{album.title}</h1>
          <p className="muted" style={{ marginTop: 4 }}>{album.artist}{album.release_year ? ` · ${album.release_year}` : ""}</p>
        </div>
        <Link href={`/record/${album.id}`} className="btn">View record</Link>
      </div>
      <LogForm
        albumId={album.id}
        entryId={entry.id}
        today={todayIso()}
        initial={{
          format: entry.format,
          rating: entry.rating ?? 0,
          note: entry.note ?? "",
          tags: entry.tags ?? [],
          isPrivate: entry.is_private,
          isAnonymous: entry.is_anonymous,
          listenedOn: entry.listened_on,
        }}
      />
      <div className="card-dashed row gap-12" style={{ justifyContent: "space-between" }}>
        <p className="muted">Changed your mind completely?</p>
        <DeleteEntryButton id={entry.id} title={album.title} label="Delete this entry" redirectTo="/" />
      </div>
    </section>
  );
}
