import { getLatestPlay, LastfmError } from "@/lib/lastfm";
import { AutoRefresh } from "./AutoRefresh";

const ago = (uts: number) => {
  const m = Math.max(0, Math.round((Date.now() / 1000 - uts) / 60));
  if (m < 2) return "just now";
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
};

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

/** "Is it working?" — what Last.fm last heard from you, so you can see the connection is live. */
export async function LastfmStatus({ username }: { username: string }) {
  let latest;
  try {
    latest = await getLatestPlay(username);
  } catch (e) {
    if (e instanceof LastfmError && e.code === 17)
      return (
        <div className="lfm-status warn" role="status">
          <strong>Your listening is hidden on Last.fm.</strong>
          <span>
            Turn off “Hide recent listening” in <a href="https://www.last.fm/settings/privacy" {...ext}>Last.fm privacy settings</a>, then come back.
          </span>
        </div>
      );
    return <div className="lfm-status muted small" role="status">Couldn’t reach Last.fm just now — we’ll try again next time.</div>;
  }

  const fresh = latest && (latest.nowPlaying || (latest.uts && Date.now() / 1000 - latest.uts < 7 * 86400));
  if (latest && fresh)
    return (
      <div className="lfm-status ok" role="status">
        <strong>✓ It’s working</strong>
        <span>
          {latest.nowPlaying ? "Playing right now: " : "Last heard: "}
          <em>{latest.track}</em> by {latest.artist}
          {latest.nowPlaying || !latest.uts ? "" : ` · ${ago(latest.uts)}`}
        </span>
      </div>
    );

  return (
    <div className="lfm-status warn" role="status">
      <strong>Waiting for your first song…</strong>
      <span>
        Play something on Spotify — it shows up here within a minute or two. Nothing? Check that Spotify is connected on{" "}
        <a href="https://www.last.fm/settings/applications" {...ext}>Last.fm → Applications</a>.
        {latest?.uts ? ` (Last song we can see was ${ago(latest.uts)}.)` : ""}
      </span>
      <span className="mono muted" style={{ fontSize: 11 }}>Checking automatically</span>
      <AutoRefresh />
    </div>
  );
}
