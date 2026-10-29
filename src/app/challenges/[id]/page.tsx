/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { stopChallenge } from "@/app/actions";
import { artistPath, stars } from "@/lib/format";
import { listBySlug } from "@/lib/challenge-lists";
import { challengeTitle, diaryIndex, doneIn, viewChallenge, type Challenge } from "@/lib/challenges";
import { ChallengeBar, ChallengePick } from "@/components/ChallengeBits";
import { PendingButton } from "@/components/PendingButton";

export const metadata: Metadata = { title: "Challenge" };

export default async function ChallengePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ started?: string }> }) {
  const { id } = await params;
  const { started } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase, user } = await getUser();
  const { data } = await supabase.from("challenges").select("id, kind, ref, title, created_at, draw_day, draw_deezer_id").eq("id", id).eq("user_id", user!.id).maybeSingle();
  if (!data) notFound();
  const index = await diaryIndex(supabase, user!.id);
  const c = await viewChallenge(supabase, user!.id, data as Challenge, index);
  const blurb = c.kind === "list" ? listBySlug(c.ref)?.blurb : null;
  const complete = c.total > 0 && c.done === c.total;

  return (
    <section className="stack gap-28">
      <div className="stack gap-8" style={{ maxWidth: 720 }}>
        <Link href="/challenges" className="btn-text small" style={{ alignSelf: "flex-start" }}>← Challenges</Link>
        <p className="eyebrow">{c.kind === "artist" ? "Artist challenge" : "List challenge"}</p>
        <h1 className="title-xl">{challengeTitle(c)}</h1>
        {blurb ? <p className="muted">{blurb}</p> : null}
        {c.kind === "artist" ? (
          <Link href={artistPath(c.title, Number(c.ref)) ?? "#"} className="btn-text small" style={{ alignSelf: "flex-start", color: "var(--accent)" }}>Artist page →</Link>
        ) : null}
        {started ? (
          <p className="small lfm-msg" role="status">
            Started! {c.done ? `You’ve already heard ${c.done} of them — they count.` : "Here’s your first pick."}
          </p>
        ) : null}
      </div>

      <div className="card stack gap-16" style={{ maxWidth: 720 }}>
        <ChallengeBar c={c} />
        {complete ? <p style={{ fontWeight: 700 }}>Complete! Every album, heard. 🎉</p> : <ChallengePick c={c} showChallenge={false} />}
      </div>

      <div className="grid-covers challenge-grid">
        {c.albums.map((a) => {
          const d = doneIn(index, a);
          return (
            <Link key={a.deezerId} href={`/open/${a.deezerId}`} prefetch={false} className="tile">
              <span className={`disc-cover${d ? " logged" : ""}`}>
                <img src={a.cover} alt="" className="cover cover-full" width={250} height={250} loading="lazy" />
                {d ? <span className="disc-badge" aria-hidden="true">✓</span> : null}
              </span>
              <span style={{ fontWeight: 700, lineHeight: 1.25 }}>{a.title}</span>
              <span className="muted" style={{ fontSize: 14 }}>{c.kind === "list" ? `${a.artist} · ` : ""}{a.year ?? ""}</span>
              {d ? (
                <span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>{d.rating ? `${stars(d.rating)} · ` : ""}Heard</span>
              ) : c.draw?.deezerId === a.deezerId ? (
                <span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>Today’s pick</span>
              ) : (
                <span className="mono muted" style={{ fontSize: 11 }}>Not yet</span>
              )}
            </Link>
          );
        })}
      </div>
      {c.kind === "list" && listBySlug(c.ref) && c.total < listBySlug(c.ref)!.items.length ? (
        <p className="muted small">{listBySlug(c.ref)!.items.length - c.total} of the list’s albums aren’t on Deezer, so they’re left out.</p>
      ) : null}

      <form action={stopChallenge}>
        <input type="hidden" name="id" value={c.id} />
        <PendingButton className="btn-text small" style={{ minHeight: 40 }} pending="…">Stop this challenge</PendingButton>
      </form>
    </section>
  );
}
