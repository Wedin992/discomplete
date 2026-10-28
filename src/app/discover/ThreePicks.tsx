/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { getPicks } from "@/lib/discover-store";
import { SLOT_LABEL } from "@/lib/discover";
import { logFromDeezer, notForMe, queueFromDeezer, shuffleDiscover } from "@/app/actions";
import { PendingButton } from "@/components/PendingButton";
import { HeardIt } from "./HeardIt";
import { artistPath } from "@/lib/format";

/** Three picks with roles, plus Shuffle. Used for "Today's three" and for a genre. */
export async function ThreePicks({ scope, source }: { scope: string; source: string }) {
  const { supabase, user } = await getUser();
  const { picks, shufflesLeft, persisted, empty } = await getPicks(supabase, user!.id, scope);

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
            {p.cover ? <img src={p.cover} alt="" className="cover pick-cover" width={250} height={250} /> : <span className="cover pick-cover skeleton" aria-hidden="true" />}
            <div className="pick-body">
              <p className="eyebrow pick-role">{SLOT_LABEL[p.slot]}</p>
              <p className="pick-title">{p.title}</p>
              <p className="muted" style={{ fontSize: 14 }}>
                <Link href={artistPath(p.artist, p.artistId)!} className="artist-link">{p.artist}</Link>
                {p.year ? ` · ${p.year}` : ""}
              </p>
              <p className="mono muted pick-reason">{p.reason}</p>
              <div className="row gap-8 pick-actions">
                <form action={queueFromDeezer}>
                  <input type="hidden" name="deezer_id" value={p.deezerId} />
                  <input type="hidden" name="source" value={`Discover · ${p.reason}`.slice(0, 200)} />
                  <PendingButton className="btn btn-sm" pending="Adding…">+ To listen</PendingButton>
                </form>
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
