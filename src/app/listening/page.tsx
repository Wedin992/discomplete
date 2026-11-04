import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getUser } from "@/lib/supabase/server";
import { loadTurntable } from "@/lib/turntable";
import { myClubs } from "@/lib/clubs";
import { myLists } from "@/lib/lists";
import { Turntable } from "@/components/LastfmSuggestions";
import { LastfmSync } from "@/components/LastfmSync";
import { DiaryChallenges } from "@/components/ChallengeCards";
import { ClubSummary } from "@/app/parties/ClubBits";
import { ListCard } from "@/app/lists/ListCard";
import { Cover } from "@/components/Cover";
import { logPath, recordPath, type Album } from "@/lib/format";
import { listeningProgress } from "@/lib/progress";

export const metadata: Metadata = { title: "Listening" };

const more = { minHeight: 32, display: "inline-flex", alignItems: "center", textDecoration: "none" } as const;

function Head({ title, href, label }: { title: string; href: string; label: string }) {
  return (
    <div className="row gap-8" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
      <h2 className="eyebrow">{title}</h2>
      <Link href={href} className="btn-text small" style={more}>{label} →</Link>
    </div>
  );
}

/** Everything you're working through: what's playing, your parties, the queue, challenges and lists. */
export default async function ListeningPage() {
  const { supabase, user } = await getUser();
  const [turntable, { clubs, ready: partiesReady }, { lists, ready: listsReady }, queueRes] = await Promise.all([
    loadTurntable(supabase, user!.id),
    myClubs(supabase, user!.id),
    myLists(supabase, user!.id),
    supabase.from("to_listen").select("source, album:albums(*)", { count: "exact" }).eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5),
  ]);
  const queue = ((queueRes.data ?? []) as unknown as { source: string | null; album: Album | null }[]).filter((r) => r.album) as { source: string | null; album: Album }[];
  const queued = queueRes.count ?? queue.length;
  const progress = await listeningProgress(supabase, user!.id, queue.map((r) => r.album));

  return (
    <section className="stack gap-40 narrow" style={{ maxWidth: 720 }}>
      {turntable.linked ? <LastfmSync /> : null}
      <div>
        <p className="eyebrow">What you’re working through</p>
        <h1 className="title-xl">Listening</h1>
      </div>

      {turntable.items.length ? (
        <div className="stack gap-12">
          <h2 className="eyebrow">On the turntable</h2>
          <Turntable items={turntable.items} />
        </div>
      ) : null}

      {partiesReady ? (
        <div className="stack gap-12">
          <Head title="Listening parties" href="/parties" label={clubs.length ? "All" : "Start one"} />
          {clubs.length ? (
            <div className="flat-list">
              {clubs.map((c) => <div key={c.id} className="flat-item"><ClubSummary club={c} /></div>)}
            </div>
          ) : (
            <p className="muted">One album a week with friends. Everyone listens in their own time, then you see what they thought.</p>
          )}
        </div>
      ) : null}

      <div className="stack gap-12">
        <Head title={queued ? `To listen · ${queued}` : "To listen"} href="/to-listen" label="All" />
        {queue.length ? (
          <div className="flat-list">
            {queue.map(({ album, source }) => {
              const p = album.deezer_id ? progress.get(album.deezer_id) : undefined;
              return (
                <div key={album.id} className="flat-item row gap-12" style={{ flexWrap: "nowrap", alignItems: "center" }}>
                  <Link href={recordPath(album)} tabIndex={-1} aria-hidden="true"><Cover album={album} size="44" /></Link>
                  <span className="stack" style={{ minWidth: 0, flex: 1 }}>
                    <Link href={recordPath(album)} className="link-button" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.title}</Link>
                    <span className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p ? <span style={{ color: "var(--accent)" }}>{p.played} of {p.total} tracks played</span> : <>{album.artist}{source ? ` · ${source}` : ""}</>}
                    </span>
                  </span>
                  <Link href={logPath(album)} className="btn btn-sm">Log it</Link>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">Nothing queued. Tap “+ To listen” on any record to save it here.</p>
        )}
      </div>

      <Suspense fallback={null}>
        <DiaryChallenges />
      </Suspense>

      {listsReady ? (
        <div className="stack gap-12">
          <Head title="Your lists" href="/lists" label={lists.length ? "All" : "Make one"} />
          {lists.length ? (
            <div className="stack gap-8">{lists.slice(0, 3).map((l) => <ListCard key={l.id} list={l} />)}</div>
          ) : (
            <p className="muted">Gather albums with a line on why. Friends can take a list on as a challenge.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
