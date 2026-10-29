import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { challengeTitle, viewChallenges } from "@/lib/challenges";
import { daysBetween, todayIso } from "@/lib/format";
import { ChallengeBar, ChallengePick } from "@/components/ChallengeBits";

const textLink = { minHeight: 32, display: "inline-flex", alignItems: "center", textDecoration: "none" } as const;

/** Diary: your challenges at a glance, the latest +1, and today's pick. */
export async function DiaryChallenges() {
  const { supabase, user } = await getUser();
  const { views, ready } = await viewChallenges(supabase, user!.id, 3);
  if (!ready) return null;
  if (!views.length)
    return (
      <Link href="/challenges" className="card-dashed row gap-12" style={{ justifyContent: "space-between", textDecoration: "none", color: "inherit" }}>
        <span>
          <strong>New: Challenges.</strong> <span className="muted">Complete an artist, or work through a list.</span>
        </span>
        <span style={{ color: "var(--accent)" }}>→</span>
      </Link>
    );
  const today = todayIso();
  const fresh = views.filter((v) => v.latest && daysBetween(v.latest.on, today) <= 7).sort((a, b) => (b.latest!.on > a.latest!.on ? 1 : -1))[0];
  const pick = views.find((v) => v.draw);
  return (
    <section className="card stack gap-16" aria-labelledby="challenges-h">
      <div className="row gap-8" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 id="challenges-h" className="eyebrow">Challenges</h2>
        <Link href="/challenges" className="btn-text small" style={textLink}>All →</Link>
      </div>
      {views.slice(0, 2).map((c) => <ChallengeBar key={c.id} c={c} compact />)}
      {fresh ? (
        <p className="mono small" style={{ color: "var(--accent)" }}>
          +1 {fresh.latest!.album.title} · {challengeTitle(fresh)}
        </p>
      ) : null}
      {pick ? <ChallengePick c={pick} /> : null}
    </section>
  );
}

/** Discover / To listen: today's picks from your challenges (nothing if you have none). */
export async function ChallengePicks({ heading, max = 2 }: { heading: string; max?: number }) {
  const { supabase, user } = await getUser();
  const { views } = await viewChallenges(supabase, user!.id, 5);
  const withPick = views.filter((v) => v.draw).slice(0, max);
  if (!withPick.length) return null;
  return (
    <section className="stack gap-12" aria-label={heading}>
      <div className="row gap-8" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 className="eyebrow">{heading}</h2>
        <Link href="/challenges" className="btn-text small" style={textLink}>Challenges →</Link>
      </div>
      {withPick.map((c) => (
        <div key={c.id} className="card">
          <ChallengePick c={c} />
        </div>
      ))}
    </section>
  );
}

/** Record page: "Part of: Swedish classics · Complete Kent". */
export async function PartOf({ deezerId, artist, title }: { deezerId: number | null; artist: string; title: string }) {
  const { supabase, user } = await getUser();
  const { views } = await viewChallenges(supabase, user!.id, 10);
  const key = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const hits = views.filter((v) => v.albums.some((a) => a.deezerId === deezerId || (key(a.artist) === key(artist) && key(a.title) === key(title))));
  if (!hits.length) return null;
  return (
    <p className="row gap-8" style={{ alignItems: "center" }}>
      <span className="eyebrow">Part of</span>
      {hits.map((v) => (
        <Link key={v.id} href={`/challenges/${v.id}`} className="chip" style={{ textDecoration: "none", color: "var(--accent)", borderColor: "var(--accent)" }}>
          {v.kind === "artist" ? `Complete ${v.title}` : v.title} · {v.done}/{v.total}
        </Link>
      ))}
    </p>
  );
}
