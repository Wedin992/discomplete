/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { QuickRate } from "@/components/QuickRate";
import { challengePath, challengeTitle, type ChallengeView } from "@/lib/challenges";

export function ChallengeBar({ c, compact = false }: { c: ChallengeView; compact?: boolean }) {
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  const complete = c.total > 0 && c.done === c.total;
  return (
    <div className="stack gap-4">
      <div className="row gap-8" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "nowrap" }}>
        <Link href={challengePath(c)} className="link-button" style={{ fontSize: compact ? 16 : 18, minWidth: 0 }}>{challengeTitle(c)}</Link>
        <span className="mono small" style={{ color: "var(--accent)", flex: "0 0 auto" }}>{complete ? "✓ Complete" : `${c.done} of ${c.total}`}</span>
      </div>
      <div className="bar" style={{ height: compact ? 6 : 10 }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${challengeTitle(c)}: ${c.done} of ${c.total}`}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Today's pick from a challenge: open it, or tap stars if you already know it. */
export function ChallengePick({ c, showChallenge = true }: { c: ChallengeView; showChallenge?: boolean }) {
  const d = c.draw;
  if (!d) return null;
  return (
    <div className="challenge-pick">
      <Link href={`/open/${d.deezerId}`} prefetch={false} tabIndex={-1} aria-hidden="true">
        <img src={d.cover} alt="" width={96} height={96} className="cover" style={{ width: 96, height: 96 }} />
      </Link>
      <div className="stack gap-4" style={{ minWidth: 0, flex: "1 1 200px" }}>
        <span className="eyebrow" style={{ color: "var(--accent)" }}>Today’s pick{showChallenge ? ` · ${challengeTitle(c)}` : ""}</span>
        <Link href={`/open/${d.deezerId}`} prefetch={false} className="link-button" style={{ fontSize: 18 }}>{d.title}</Link>
        <span className="muted small">{d.artist}{d.year ? ` · ${d.year}` : ""}</span>
        <QuickRate deezerId={d.deezerId} title={d.title} compact idleText="Heard it? Rate it" />
      </div>
    </div>
  );
}
