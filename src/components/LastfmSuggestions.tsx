/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { dismissSuggestion, rateSuggestion } from "@/app/actions";
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
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function when(day: string) {
  const ago = daysBetween(day, todayIso());
  if (ago <= 0) return "today";
  if (ago === 1) return "yesterday";
  if (ago < 7) return `on ${DAYS[new Date(day + "T12:00:00Z").getUTCDay()]}`;
  return `on ${longDate(day).replace(/^\w+ /, "")}`;
}

/** "Looks like you listened to …" — album listens spotted in your Spotify history (via Last.fm). At most three. */
export function LastfmSuggestions({ items, more }: { items: Suggestion[]; more: number }) {
  if (!items.length) return null;
  return (
    <section className="card stack gap-16" aria-labelledby="from-spotify">
      <div className="row gap-8" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 id="from-spotify" className="eyebrow" style={{ color: "var(--accent)" }}>From Spotify · via Last.fm</h2>
        <Link href="/settings#lastfm" className="btn-text small" style={{ minHeight: 32, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Settings</Link>
      </div>
      {items.map((s) => (
        <div key={s.id} className="lfm-item">
          {s.cover ? <img src={s.cover} alt="" width={64} height={64} className="cover cover-64" /> : <span className="cover cover-64" />}
          <div className="stack gap-4" style={{ minWidth: 0, flex: "1 1 220px" }}>
            <p style={{ fontWeight: 700 }}>Looks like you listened to {s.title}</p>
            <p className="muted small">{s.artist} · {s.tracks_played} of {s.total_tracks} tracks · {when(s.played_on)}</p>
            <QuickRate deezerId={s.deezer_id} title={s.title} compact onRate={rateSuggestion.bind(null, s.id)} addedText="In your diary" idleText="Rate it to log it" />
            <div className="row gap-16" style={{ marginTop: 2 }}>
              <Link href={`/open/${s.deezer_id}?then=log&date=${s.played_on}&suggestion=${s.id}`} prefetch={false} className="btn-text small" style={{ minHeight: 36, display: "inline-flex", alignItems: "center", color: "var(--accent)", textDecoration: "none" }}>
                Write about it →
              </Link>
              <form action={dismissSuggestion}>
                <input type="hidden" name="id" value={s.id} />
                <PendingButton className="btn-text small" style={{ minHeight: 36 }} pending="…">Not now</PendingButton>
              </form>
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
            </div>
          </div>
        </div>
      ))}
      {more ? <p className="mono muted" style={{ fontSize: 11 }}>+{more} more — they’ll show here as you answer these</p> : null}
    </section>
  );
}
