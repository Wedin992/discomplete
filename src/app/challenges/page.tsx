import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { startChallenge } from "@/app/actions";
import { LISTS } from "@/lib/challenge-lists";
import { viewChallenges } from "@/lib/challenges";
import { ChallengeBar, ChallengePick } from "@/components/ChallengeBits";
import { PendingButton } from "@/components/PendingButton";

export const metadata: Metadata = { title: "Challenges" };

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase, user } = await getUser();
  const { views, ready } = await viewChallenges(supabase, user!.id);
  const started = new Set(views.filter((v) => v.kind === "list").map((v) => v.ref));

  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 720 }}>
      <div>
        <p className="eyebrow">Collect them all</p>
        <h1 className="title-xl">Challenges</h1>
        <p className="muted" style={{ marginTop: 8 }}>
          Complete an artist, or work through a list. Everything in your diary counts — “Heard before” too — and each challenge draws one album a day for you. No streaks, no rush.
        </p>
      </div>
      {!ready || error ? <p className="error small">Challenges aren’t switched on yet (database update 0013).</p> : null}

      {views.length ? (
        <div className="stack gap-16">
          <h2 className="eyebrow">Yours · {views.length}</h2>
          {views.map((c) => (
            <div key={c.id} className="card stack gap-16">
              <ChallengeBar c={c} />
              {c.draw ? <ChallengePick c={c} showChallenge={false} /> : c.total ? <p className="muted small">All done. Nice.</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="stack gap-16">
        <h2 className="eyebrow">Lists to start</h2>
        {LISTS.map((l) => (
          <div key={l.slug} className="card stack gap-8">
            <div className="row gap-8" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <Link href={`/challenges/list/${l.slug}`} className="link-button" style={{ fontSize: 18 }}>{l.title}</Link>
              <span className="mono muted small">{l.items.length} albums</span>
            </div>
            <p className="muted">{l.blurb}</p>
            {started.has(l.slug) ? (
              <Link href={`/challenges/${views.find((v) => v.kind === "list" && v.ref === l.slug)!.id}`} className="btn btn-sm" style={{ alignSelf: "flex-start" }}>✓ Started — open</Link>
            ) : (
              <div className="row gap-12">
                <Link href={`/challenges/list/${l.slug}`} className="btn btn-sm">See the albums</Link>
                <form action={startChallenge}>
                  <input type="hidden" name="kind" value="list" />
                  <input type="hidden" name="ref" value={l.slug} />
                  <PendingButton className="btn btn-sm btn-primary" pending="Starting…">Start this list</PendingButton>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card-dashed stack gap-4">
        <strong>Complete an artist</strong>
        <p className="muted">Open any artist page and tap <strong>Complete it</strong> to collect every studio album they’ve made.</p>
      </div>
    </section>
  );
}
