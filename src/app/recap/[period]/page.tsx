import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { getRecap, parsePeriod } from "@/lib/recap";
import { recordPath, stars, todayIso } from "@/lib/format";
import { Cover } from "@/components/Cover";
import { ShareImage } from "@/components/ShareImage";

export async function generateMetadata({ params }: { params: Promise<{ period: string }> }): Promise<Metadata> {
  const p = parsePeriod((await params).period);
  return { title: p ? `${p.label} in albums` : "Recap" };
}

export default async function RecapPage({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  const { supabase, user } = await getUser();
  const r = await getRecap(supabase, user!.id, period);
  if (!r) notFound();
  const today = todayIso();
  const prevMonth = (() => {
    if (r.kind !== "month") return null;
    const [y, m] = period.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return d.toISOString().slice(0, 7);
  })();
  const nextMonth = (() => {
    if (r.kind !== "month") return null;
    const [y, m] = period.split("-").map(Number);
    const d = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
    return d <= today.slice(0, 7) ? d : null;
  })();

  const facts = [
    { n: r.albums, l: r.albums === 1 ? "album" : "albums" },
    { n: r.listens, l: r.listens === 1 ? "listen" : "listens" },
    { n: r.hours, l: "hours" },
    { n: r.days, l: r.days === 1 ? "day with music" : "days with music" },
  ];

  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 720 }}>
      <div className="stack gap-8">
        <p className="eyebrow">{r.kind === "year" ? "Your year in albums" : "Your month in albums"}</p>
        <h1 className="title-xl">{r.label}</h1>
        <nav className="row gap-12 small">
          {prevMonth ? <Link href={`/recap/${prevMonth}`} className="btn-text">‹ Previous month</Link> : null}
          {nextMonth ? <Link href={`/recap/${nextMonth}`} className="btn-text">Next month ›</Link> : null}
          {r.kind === "month" ? <Link href={`/recap/${r.year}`} className="btn-text" style={{ color: "var(--accent)" }}>All of {r.year} →</Link> : null}
        </nav>
      </div>

      {!r.listens ? (
        <p className="muted">No listens with a date in {r.label}.</p>
      ) : (
        <>
          <div className="recap-facts">
            {facts.map((f) => (
              <div key={f.l} className="recap-fact"><span className="recap-n">{f.n}</span><span className="muted small">{f.l}</span></div>
            ))}
          </div>

          <ul className="stack gap-8 recap-lines">
            <li><strong>{r.firstTimes}</strong> first {r.firstTimes === 1 ? "listen" : "listens"}{r.relistens ? <>, <strong>{r.relistens}</strong> {r.relistens === 1 ? "relisten" : "relistens"}</> : null}</li>
            {r.topArtist && r.topArtist.plays > 1 ? <li>Most played: <strong>{r.topArtist.name}</strong> ({r.topArtist.plays} listens)</li> : null}
            {r.mostPlayed ? <li>On repeat: <Link href={recordPath(r.mostPlayed.album)} className="artist-link"><strong>{r.mostPlayed.album.title}</strong></Link>, {r.mostPlayed.plays} times</li> : null}
            {r.genres.length ? <li>Mostly <strong>{r.genres.join(", ")}</strong></li> : null}
            {r.vinylShare || r.cdShare ? <li>{[r.vinylShare ? `${r.vinylShare}% on vinyl` : null, r.cdShare ? `${r.cdShare}% on CD` : null].filter(Boolean).join(", ")}</li> : null}
          </ul>

          <div className="stack gap-12">
            <h2 className="eyebrow">The best of {r.kind === "year" ? "the year" : "the month"}</h2>
            <div className="recap-grid">
              {r.best.map((b) => (
                <Link key={b.album.id} href={recordPath(b.album)} className="stack gap-4" style={{ textDecoration: "none", color: "inherit", minWidth: 0 }}>
                  <Cover album={b.album} size="full" />
                  <span className="small" style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.album.title}</span>
                  <span className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.album.artist}</span>
                  {b.rating ? <span className="stars small">{stars(b.rating)}</span> : null}
                </Link>
              ))}
            </div>
          </div>

          <div className="card stack gap-12">
            <h2 className="eyebrow">Share it</h2>
            <p className="muted small">A picture of your {r.kind} — for Instagram stories, a group chat, wherever.</p>
            <ShareImage src={`/recap/${period}/image`} filename={`discomplete-${period}.png`} title={`${r.label} in albums`} />
          </div>
        </>
      )}
    </section>
  );
}
