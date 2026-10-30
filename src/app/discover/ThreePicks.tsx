/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getPicks } from "@/lib/discover-store";
import { SLOT_LABEL } from "@/lib/discover";
import { logFromDeezer, notForMe, queueFromDeezer, shuffleDiscover } from "@/app/actions";
import { PendingButton } from "@/components/PendingButton";
import { HeardIt } from "./HeardIt";
import { artistPath, stars, todayIso } from "@/lib/format";
import { QuickRate } from "@/components/QuickRate";
import { rateEntry } from "@/app/actions";

/** Three picks with roles, plus Shuffle. Used for "Today's three" and for a genre. */
export async function ThreePicks({ scope, source }: { scope: string; source: string }) {
  const { supabase, user } = await getUser();
  const [{ picks, shufflesLeft, persisted, empty }, queuedRes] = await Promise.all([
    getPicks(supabase, user!.id, scope),
    supabase.from("to_listen").select("album:albums(deezer_id)").eq("user_id", user!.id),
  ]);
  const queued = new Set(((queuedRes.data ?? []) as unknown as { album: { deezer_id: number | null } | null }[]).map((r) => r.album?.deezer_id).filter(Boolean));

  // Have you listened to any of them since they were picked? (Logged by you, or from Spotify.) Or are you on it right now?
  const ids = picks.map((p) => p.deezerId);
  const since = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
  const [heardRes, playingRes] = ids.length
    ? await Promise.all([
        supabase.from("entries").select("id, rating, note, kind, listened_on, created_at, album:albums!inner(deezer_id)").eq("user_id", user!.id).in("album.deezer_id", ids).order("created_at", { ascending: false }),
        supabase.from("lastfm_suggestions").select("deezer_id, tracks_played, total_tracks").eq("user_id", user!.id).in("deezer_id", ids).in("status", ["pending", "listening", "finished"]).gte("played_on", since),
      ])
    : [{ data: [] }, { data: [] }];
  type Heard = { id: string; rating: number | null; note: string | null; kind: string; listened_on: string; created_at: string; album: { deezer_id: number } };
  const today = todayIso();
  const heard = new Map<number, Heard>();
  for (const e of (heardRes.data ?? []) as unknown as Heard[])
    if (!heard.has(e.album.deezer_id) && ((e.listened_on ?? "") >= since || (e.created_at ?? "").slice(0, 10) >= since)) heard.set(e.album.deezer_id, e);
  const playing = new Map(((playingRes.data ?? []) as { deezer_id: number; tracks_played: number; total_tracks: number }[]).map((r) => [r.deezer_id, r]));

  if (!picks.length)
    return (
      <div className="card-dashed stack gap-8">
        <p style={{ fontWeight: 700 }}>{empty ? "We couldn’t find records for that genre" : "No new picks right now"}</p>
        <p className="muted">
          {empty
            ? "Try another name for it, or one of the genres below."
            : "We’ve run out of new artists near your taste for today. Rate a few more records and check back tomorrow."}
        </p>
      </div>
    );

  return (
    <div className="stack gap-16">
      <ol className="three" aria-label="Three records for you">
        {picks.map((p) => (
          <li key={`${p.slot}-${p.deezerId}`} className="pick">
            <Link href={`/open/${p.deezerId}`} prefetch={false} className="pick-cover-link" tabIndex={-1} aria-hidden="true">
              {p.cover ? <img src={p.cover} alt="" className="cover pick-cover" width={250} height={250} /> : <span className="cover pick-cover skeleton" />}
            </Link>
            <div className="pick-body">
              <p className="eyebrow pick-role">{SLOT_LABEL[p.slot]}</p>
              <p className="pick-title"><Link href={`/open/${p.deezerId}`} prefetch={false} className="pick-title-link">{p.title}</Link></p>
              <p className="muted" style={{ fontSize: 14 }}>
                <Link href={artistPath(p.artist, p.artistId)!} className="artist-link">{p.artist}</Link>
                {p.year ? ` · ${p.year}` : ""}
              </p>
              <p className="mono muted pick-reason">{p.reason}</p>
              {heard.has(p.deezerId) ? (
                <div className="pick-done stack gap-8">
                  <p className="small" style={{ fontWeight: 700, color: "var(--accent)" }}>
                    ✓ {heard.get(p.deezerId)!.kind === "before" ? "Heard before" : heard.get(p.deezerId)!.listened_on === today ? "Listened today" : "Listened"}
                    {heard.get(p.deezerId)!.rating ? <span className="stars" style={{ marginLeft: 8 }}>{stars(heard.get(p.deezerId)!.rating)}</span> : null}
                  </p>
                  {heard.get(p.deezerId)!.rating ? null : (
                    <QuickRate deezerId={p.deezerId} title={p.title} compact onRate={rateEntry.bind(null, heard.get(p.deezerId)!.id)} idleText="How was it?" />
                  )}
                  <Link href={`/entry/${heard.get(p.deezerId)!.id}/edit`} className="btn-text small" style={{ minHeight: 36, display: "inline-flex", alignItems: "center", color: "var(--accent)", textDecoration: "none" }}>
                    {heard.get(p.deezerId)!.note ? "Edit what you wrote" : "Write about it →"}
                  </Link>
                </div>
              ) : (
              <>
              {playing.has(p.deezerId) ? (
                <div className="stack gap-4" style={{ maxWidth: 320 }}>
                  <span className="mono small" style={{ color: "var(--accent)" }}>▶ On your turntable · {playing.get(p.deezerId)!.tracks_played} of {playing.get(p.deezerId)!.total_tracks}</span>
                  <div className="bar" style={{ height: 6 }} aria-hidden="true">
                    <span style={{ width: `${Math.round((playing.get(p.deezerId)!.tracks_played / Math.max(1, playing.get(p.deezerId)!.total_tracks)) * 100)}%` }} />
                  </div>
                </div>
              ) : null}
              <div className="row gap-8 pick-actions">
                {queued.has(p.deezerId) ? (
                  <Link href="/to-listen" className="btn btn-sm pill" aria-pressed="true">✓ In To listen</Link>
                ) : (
                  <form action={queueFromDeezer}>
                    <input type="hidden" name="deezer_id" value={p.deezerId} />
                    <input type="hidden" name="source" value={`Discover · ${p.reason}`.slice(0, 200)} />
                    <PendingButton className="btn btn-sm" pending="Adding…">+ To listen</PendingButton>
                  </form>
                )}
                <form action={logFromDeezer}>
                  <input type="hidden" name="deezer_id" value={p.deezerId} />
                  <PendingButton className="btn-text small" style={{ minHeight: 40 }} pending="Opening…">Log it</PendingButton>
                </form>
                {persisted ? (
                  <form action={notForMe}>
                    <input type="hidden" name="scope" value={scope} />
                    <input type="hidden" name="slot" value={p.slot} />
                    <input type="hidden" name="deezer_id" value={p.deezerId} />
                    <PendingButton className="btn-text small muted" style={{ minHeight: 40 }} pending="Swapping…" aria-label={`Not for me: ${p.title}`}>Not for me</PendingButton>
                  </form>
                ) : null}
              </div>
              <HeardIt deezerId={p.deezerId} title={p.title} scope={scope} slot={p.slot} canSwap={persisted} />
              </>
              )}
            </div>
          </li>
        ))}
      </ol>

      {persisted ? (
        <form action={shuffleDiscover} className="row gap-12" style={{ alignItems: "center" }}>
          <input type="hidden" name="scope" value={scope} />
          <PendingButton className="btn btn-sm" disabled={!shufflesLeft} pending="Finding three new…">
            ↻ Shuffle
          </PendingButton>
          <span className="mono muted" style={{ fontSize: 11 }}>
            {shufflesLeft ? `${shufflesLeft} ${shufflesLeft === 1 ? "shuffle" : "shuffles"} left today` : `New ${source} tomorrow`}
          </span>
        </form>
      ) : null}
    </div>
  );
}

export function ThreeSkeleton() {
  return (
    <ol className="three" aria-busy="true" aria-label="Finding three records for you">
      {[0, 1, 2].map((i) => (
        <li key={i} className="pick">
          <span className="cover pick-cover skeleton" />
          <div className="pick-body">
            <span className="skeleton" style={{ width: 70, height: 12 }} />
            <span className="skeleton" style={{ width: "80%", height: 18 }} />
            <span className="skeleton" style={{ width: "50%", height: 14 }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
