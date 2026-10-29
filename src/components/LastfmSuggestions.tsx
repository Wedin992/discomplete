/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { backToToListen, dismissSuggestion, keepAsListened, rateLogged, rateSuggestion, reviewLater, undoAutoLog } from "@/app/actions";
import { QuickRate } from "@/components/QuickRate";
import { PendingButton } from "@/components/PendingButton";
import { daysBetween, longDate, todayIso } from "@/lib/format";

export type Suggestion = {
  id: string;
  deezer_id: number;
  title: string;
  artist: string;
  cover: string | null;
  played_on: string;
  tracks_played: number;
  total_tracks: number;
  status: "pending" | "listening" | "finished";
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function when(day: string) {
  const ago = daysBetween(day, todayIso());
  if (ago <= 0) return "today";
  if (ago === 1) return "yesterday";
  if (ago < 7) return `on ${DAYS[new Date(day + "T12:00:00Z").getUTCDay()]}`;
  return `on ${longDate(day).replace(/^\w+ /, "")}`;
}
const share = (s: Suggestion) => s.tracks_played / Math.max(1, s.total_tracks);

const textLink = { minHeight: 36, display: "inline-flex", alignItems: "center", textDecoration: "none" } as const;

function NotAnAlbum({ s }: { s: Suggestion }) {
  return (
    <details className="lfm-more">
      <summary className="btn-text small">Not an album listen</summary>
      <div className="stack gap-4 lfm-menu">
        <form action={dismissSuggestion}>
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="mute" value="album" />
          <PendingButton className="btn-text small" style={{ minHeight: 36 }} pending="…">Never suggest this album</PendingButton>
        </form>
        <form action={dismissSuggestion}>
          <input type="hidden" name="id" value={s.id} />
          <input type="hidden" name="mute" value="artist" />
          <PendingButton className="btn-text small" style={{ minHeight: 36 }} pending="…">Never suggest {s.artist}</PendingButton>
        </form>
      </div>
    </details>
  );
}

function Cover({ s, size = 64 }: { s: Suggestion; size?: number }) {
  return s.cover ? <img src={s.cover} alt="" width={size} height={size} className={`cover cover-${size}`} /> : <span className={`cover cover-${size}`} />;
}

/**
 * From Spotify (via Last.fm), at most three:
 *  - finished / heard most of it → "Looks like you listened to …" with stars to log it
 *  (started albums go straight on the turntable — see Turntable below)
 */
export function LastfmSuggestions({ items, more }: { items: Suggestion[]; more: number }) {
  if (!items.length) return null;
  return (
    <section className="card stack gap-16" aria-labelledby="from-spotify">
      <div className="row gap-8" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 id="from-spotify" className="eyebrow" style={{ color: "var(--accent)" }}>From Spotify · via Last.fm</h2>
        <Link href="/settings#lastfm" className="btn-text small" style={{ ...textLink, minHeight: 32 }}>Settings</Link>
      </div>
      {items.map((s) => {
        return (
          <div key={s.id} className="lfm-item">
            <Link href={`/open/${s.deezer_id}`} prefetch={false} tabIndex={-1} aria-hidden="true"><Cover s={s} /></Link>
            <div className="stack gap-4" style={{ minWidth: 0, flex: "1 1 220px" }}>
              <p style={{ fontWeight: 700 }}>
                {s.status === "finished" ? "You finished " : "Looks like you listened to "}
                <Link href={`/open/${s.deezer_id}`} prefetch={false} className="lfm-title">{s.title}</Link>
                {s.status === "finished" ? " — how was it?" : ""}
              </p>
              <p className="muted small">{s.artist} · {s.tracks_played} of {s.total_tracks} tracks · {when(s.played_on)}</p>
              <QuickRate deezerId={s.deezer_id} title={s.title} compact onRate={rateSuggestion.bind(null, s.id)} addedText="In your diary" idleText="Rate it to log it" />
              <div className="row gap-16" style={{ marginTop: 2 }}>
                <Link href={`/open/${s.deezer_id}?then=log&date=${s.played_on}&suggestion=${s.id}`} prefetch={false} className="btn-text small" style={{ ...textLink, color: "var(--accent)" }}>
                  Write about it →
                </Link>
                <form action={dismissSuggestion}>
                  <input type="hidden" name="id" value={s.id} />
                  <PendingButton className="btn-text small" style={{ minHeight: 36 }} pending="…">Not now</PendingButton>
                </form>
                {s.status === "finished" ? null : <NotAnAlbum s={s} />}
              </div>
            </div>
          </div>
        );
      })}
      {more ? <p className="mono muted" style={{ fontSize: 11 }}>+{more} more — they’ll show here as you answer these</p> : null}
    </section>
  );
}

/** "On the turntable": albums you said you're on. Progress follows your scrobbles; when you're done it asks how it was. */
export function Turntable({ items }: { items: Suggestion[] }) {
  if (!items.length) return null;
  return (
    <section className="stack gap-8" aria-labelledby="turntable">
      <div className="stack gap-4">
        <h2 id="turntable" className="eyebrow">On the turntable</h2>
        <p className="muted small">Albums you’ve started on Spotify. They fill up as you listen — when you’re done, we’ll ask how it was.</p>
      </div>
      {items.map((s) => {
        const pct = Math.round(Math.min(1, share(s)) * 100);
        return (
          <div key={s.id} className="turntable-item">
            <Link href={`/open/${s.deezer_id}`} prefetch={false} tabIndex={-1} aria-hidden="true"><Cover s={s} size={44} /></Link>
            <div className="stack gap-4" style={{ minWidth: 0, flex: "1 1 auto" }}>
              <div className="row gap-8" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                <Link href={`/open/${s.deezer_id}`} prefetch={false} className="turntable-title">{s.title}</Link>
                <span className="mono muted" style={{ fontSize: 11, flex: "0 0 auto" }}>{s.tracks_played} of {s.total_tracks}</span>
                <details className="lfm-more tt-more">
                  <summary className="btn-text small" aria-label={`More for ${s.title}`} style={{ minWidth: 36, justifyContent: "center", fontSize: 18, letterSpacing: 1 }}>⋯</summary>
                  <div className="stack gap-4 lfm-menu">
                    <form action={dismissSuggestion}>
                      <input type="hidden" name="id" value={s.id} />
                      <PendingButton className="btn-text small" style={{ minHeight: 36 }} pending="…">Hide this</PendingButton>
                    </form>
                    <form action={dismissSuggestion}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="mute" value="album" />
                      <PendingButton className="btn-text small" style={{ minHeight: 36 }} pending="…">Never suggest this album</PendingButton>
                    </form>
                    <form action={dismissSuggestion}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="mute" value="artist" />
                      <PendingButton className="btn-text small" style={{ minHeight: 36 }} pending="…">Never suggest {s.artist}</PendingButton>
                    </form>
                  </div>
                </details>
              </div>
              <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.title}: ${pct}% played`}>
                <span style={{ width: `${pct}%` }} />
              </div>
              <div className="row gap-12">
                <Link href={`/open/${s.deezer_id}#tracklist`} prefetch={false} className="btn-text small" style={{ minHeight: 36, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>What’s left</Link>
                <details className="lfm-more">
                  <summary className="btn-text small" style={{ color: "var(--accent)" }}>Done? Rate it</summary>
                  <div className="lfm-menu">
                    <QuickRate deezerId={s.deezer_id} title={s.title} compact onRate={rateSuggestion.bind(null, s.id)} addedText="In your diary" idleText="Logged on the day you started" />
                  </div>
                </details>
                <form action={backToToListen}>
                  <input type="hidden" name="id" value={s.id} />
                  <PendingButton className="btn-text small" style={{ minHeight: 36 }} pending="…">Move to To listen</PendingButton>
                </form>
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export type Review = { s: Suggestion; entryId: string };

/** Logged automatically from Spotify: "how was it?" — rate, write, or do it later. */
export function AutoLogged({ items }: { items: Review[] }) {
  if (!items.length) return null;
  return (
    <section className="card stack gap-16" aria-labelledby="auto-logged">
      <div className="row gap-8" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 id="auto-logged" className="eyebrow" style={{ color: "var(--accent)" }}>Logged from Spotify</h2>
        <Link href="/settings#lastfm" className="btn-text small" style={{ ...textLink, minHeight: 32 }}>Settings</Link>
      </div>
      {items.map(({ s, entryId }) => (
        <div key={s.id} className="lfm-item">
          <Link href={`/open/${s.deezer_id}`} prefetch={false} tabIndex={-1} aria-hidden="true"><Cover s={s} /></Link>
          <div className="stack gap-4" style={{ minWidth: 0, flex: "1 1 220px" }}>
            <p style={{ fontWeight: 700 }}>
              In your diary: <Link href={`/open/${s.deezer_id}`} prefetch={false} className="lfm-title">{s.title}</Link> — how was it?
            </p>
            <p className="muted small">{s.artist} · {s.tracks_played} of {s.total_tracks} tracks · {when(s.played_on)}</p>
            <QuickRate deezerId={s.deezer_id} title={s.title} compact onRate={rateLogged.bind(null, s.id)} addedText="Rated" idleText="Review it" />
            <div className="row gap-16" style={{ marginTop: 2 }}>
              <Link href={`/entry/${entryId}/edit`} className="btn-text small" style={{ ...textLink, color: "var(--accent)" }}>Journal this listen →</Link>
              <form action={keepAsListened}>
                <input type="hidden" name="id" value={s.id} />
                <PendingButton className="btn-text small" style={{ minHeight: 36 }} pending="…">Just listened</PendingButton>
              </form>
              <form action={reviewLater}>
                <input type="hidden" name="id" value={s.id} />
                <PendingButton className="btn-text small" style={{ minHeight: 36 }} pending="…">I’ll do it later</PendingButton>
              </form>
              <details className="lfm-more">
                <summary className="btn-text small">Remove — wasn’t an album listen</summary>
                <div className="stack gap-4 lfm-menu">
                  {[
                    { mute: "", label: "Just remove it" },
                    { mute: "album", label: "Remove, and never log this album" },
                    { mute: "artist", label: `Remove, and never log ${s.artist}` },
                  ].map((o) => (
                    <form key={o.mute} action={undoAutoLog}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="mute" value={o.mute} />
                      <PendingButton className="btn-text small" style={{ minHeight: 36, textAlign: "left" }} pending="…">{o.label}</PendingButton>
                    </form>
                  ))}
                </div>
              </details>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

/** Bottom of the diary: logged listens you said you'd review later. */
export function WaitingReview({ items }: { items: Review[] }) {
  if (!items.length) return null;
  return (
    <section className="stack gap-12" aria-labelledby="waiting-review">
      <h2 id="waiting-review" className="eyebrow">Waiting for your review · {items.length}</h2>
      {items.map(({ s, entryId }) => (
        <div key={s.id} className="turntable-item">
          <Link href={`/open/${s.deezer_id}`} prefetch={false} tabIndex={-1} aria-hidden="true"><Cover s={s} size={44} /></Link>
          <div className="stack gap-4" style={{ minWidth: 0, flex: "1 1 auto" }}>
            <Link href={`/open/${s.deezer_id}`} prefetch={false} className="turntable-title">{s.title}</Link>
            <span className="muted small">{s.artist} · {when(s.played_on)}</span>
            <div className="row gap-12" style={{ alignItems: "center" }}>
              <QuickRate deezerId={s.deezer_id} title={s.title} compact onRate={rateLogged.bind(null, s.id)} addedText="Rated" idleText="" />
              <Link href={`/entry/${entryId}/edit`} className="btn-text small" style={{ ...textLink, color: "var(--accent)" }}>Write</Link>
              <form action={keepAsListened}>
                <input type="hidden" name="id" value={s.id} />
                <PendingButton className="btn-text small" style={{ minHeight: 36 }} pending="…">Just listened</PendingButton>
              </form>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
