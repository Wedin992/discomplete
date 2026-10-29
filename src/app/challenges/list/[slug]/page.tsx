/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { startChallenge } from "@/app/actions";
import { stars } from "@/lib/format";
import { listBySlug } from "@/lib/challenge-lists";
import { challengeAlbums, diaryIndex, doneIn } from "@/lib/challenges";
import { PendingButton } from "@/components/PendingButton";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: listBySlug((await params).slug)?.title ?? "Challenge" };
}

/** A list before you start it: every album in it, and which ones you've already heard. */
export default async function ListPreviewPage({ params }: { params: Params }) {
  const { slug } = await params;
  const list = listBySlug(slug);
  if (!list) notFound();
  const { supabase, user } = await getUser();
  const { data: started } = await supabase.from("challenges").select("id").eq("user_id", user!.id).eq("kind", "list").eq("ref", slug).maybeSingle();
  if (started) redirect(`/challenges/${(started as { id: string }).id}`);

  const [albums, index] = await Promise.all([challengeAlbums({ kind: "list", ref: slug, title: list.title }), diaryIndex(supabase, user!.id)]);
  const heard = albums.filter((a) => doneIn(index, a)).length;
  const pct = albums.length ? Math.round((heard / albums.length) * 100) : 0;

  const start = (
    <form action={startChallenge}>
      <input type="hidden" name="kind" value="list" />
      <input type="hidden" name="ref" value={slug} />
      <PendingButton className="btn btn-primary" pending="Starting…">Start this list</PendingButton>
    </form>
  );

  return (
    <section className="stack gap-28">
      <div className="stack gap-8" style={{ maxWidth: 720 }}>
        <Link href="/challenges" className="btn-text small" style={{ alignSelf: "flex-start" }}>← Challenges</Link>
        <p className="eyebrow">List · {albums.length} albums</p>
        <h1 className="title-xl">{list.title}</h1>
        <p className="muted">{list.blurb}</p>
      </div>

      <div className="card stack gap-12" style={{ maxWidth: 720 }}>
        <p style={{ fontWeight: 700 }}>{heard ? `You’ve already heard ${heard} of them — they’d count right away.` : "None of these are in your diary yet — a clean start."}</p>
        <div className="bar" style={{ height: 10 }} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        <p className="muted small">Start it and you get one album a day from the list — or go in any order you like.</p>
        {start}
      </div>

      <div className="grid-covers challenge-grid">
        {albums.map((a) => {
          const d = doneIn(index, a);
          return (
            <Link key={a.deezerId} href={`/open/${a.deezerId}`} prefetch={false} className="tile">
              <span className={`disc-cover${d ? " logged" : ""}`}>
                <img src={a.cover} alt="" className="cover cover-full" width={250} height={250} loading="lazy" />
                {d ? <span className="disc-badge" aria-hidden="true">✓</span> : null}
              </span>
              <span style={{ fontWeight: 700, lineHeight: 1.25 }}>{a.title}</span>
              <span className="muted" style={{ fontSize: 14 }}>{a.artist}{a.year ? ` · ${a.year}` : ""}</span>
              {d ? <span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>{d.rating ? `${stars(d.rating)} · ` : ""}Heard</span> : null}
            </Link>
          );
        })}
      </div>
      {start}
    </section>
  );
}
