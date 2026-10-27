import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { longDate, todayIso, type Album } from "@/lib/format";
import { LogForm } from "./LogForm";

export const metadata: Metadata = { title: "Log a listen" };

export default async function LogRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await getUser();
  const [albumRes, countRes, collRes] = await Promise.all([
    supabase.from("albums").select("*").eq("id", id).maybeSingle(),
    supabase.from("entries").select("id", { count: "exact", head: true }).eq("album_id", id).eq("user_id", user!.id),
    supabase.from("collection").select("vinyl, cd").eq("album_id", id).eq("user_id", user!.id).maybeSingle(),
  ]);
  const album = albumRes.data as Album | null;
  if (!album) notFound();
  const before = countRes.count ?? 0;
  const owned = collRes.data as { vinyl: boolean; cd: boolean } | null;
  const defaultFormat = owned?.vinyl ? "vinyl" : owned?.cd ? "cd" : "stream";
  const today = todayIso();

  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 720 }}>
      <div className="row gap-16">
        <Cover album={album} size="96" />
        <div style={{ flex: "1 1 260px", minWidth: 0 }}>
          <p className="eyebrow">Logging · {longDate(today)}</p>
          <h1 className="title-m" style={{ marginTop: 4 }}>{album.title}</h1>
          <p className="muted" style={{ marginTop: 4 }}>{album.artist}{album.release_year ? ` · ${album.release_year}` : ""}</p>
        </div>
        <Link href="/log" className="btn">Change record</Link>
      </div>
      <LogForm
        albumId={album.id}
        today={today}
        loggedBefore={before}
        initial={{ format: defaultFormat, rating: 0, note: "", tags: [], isPrivate: false, isAnonymous: false, listenedOn: today }}
      />
    </section>
  );
}
