import Link from "next/link";
import { connectLastfm, disconnectLastfm, setLastfmAutolog, syncLastfmNow } from "@/app/actions";
import { PendingButton } from "@/components/PendingButton";

const MESSAGES: Record<string, { text: string; error?: boolean }> = {
  connected: { text: "Connected — we’ll look for album listens each time you open the app." },
  invalid: { text: "That doesn’t look like a Last.fm username.", error: true },
  notfound: { text: "We couldn’t find that Last.fm user. Check the spelling.", error: true },
  unavailable: { text: "Last.fm didn’t answer. If your recent listening is hidden on Last.fm, make it visible — otherwise try again in a moment.", error: true },
  setup: { text: "Spotify via Last.fm isn’t switched on yet.", error: true },
};

/** Settings: "Using Spotify? Fill your diary automatically" — via Last.fm, optional. */
export function LastfmCard({ link, status, configured }: { link: { username: string; autolog: boolean; synced_at: string | null } | null; status?: string; configured: boolean }) {
  const synced = status?.startsWith("synced-") ? Number(status.slice(7)) : null;
  const msg = synced !== null ? { text: synced ? `Found ${synced} new album ${synced === 1 ? "listen" : "listens"} — see your diary.` : "Up to date — no new album listens." } : status ? MESSAGES[status] : null;
  return (
    <div id="lastfm" className="card stack gap-12">
      <h2 className="eyebrow">Spotify · optional</h2>
      {link ? (
        <>
          <p>
            Connected to Last.fm as <strong>{link.username}</strong>. When you play most of an album, it shows up in your diary as a suggestion.
          </p>
          <form action={setLastfmAutolog} className="check">
            <input type="hidden" name="on" value={link.autolog ? "0" : "1"} />
            <PendingButton className="btn btn-sm pill" aria-pressed={link.autolog} pending="Saving…">
              {link.autolog ? "✓ Log full albums automatically" : "Log full albums automatically"}
            </PendingButton>
          </form>
          <p className="muted small">{link.autolog ? "Album listens go straight into your diary — you can rate or delete them later." : "Off: you confirm each one in your diary first."}</p>
          <div className="row gap-12">
            <Link href="/lastfm/top" className="btn btn-sm">Add your most played albums</Link>
            <form action={syncLastfmNow}>
              <PendingButton className="btn-text small" style={{ minHeight: 40 }} pending="Checking…">Check now</PendingButton>
            </form>
            <form action={disconnectLastfm}>
              <PendingButton className="btn-text small" style={{ minHeight: 40 }} pending="…">Disconnect</PendingButton>
            </form>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontWeight: 700, fontSize: 17 }}>Using Spotify? Fill your diary automatically.</p>
          <p className="muted">When you play a whole album, Discomplete suggests logging it — one tap, on the right day. Songs and playlists are ignored.</p>
          <ol className="lfm-steps muted">
            <li>Create a free account on <a href="https://www.last.fm/join" target="_blank" rel="noopener noreferrer">last.fm</a> (or log in).</li>
            <li>On Last.fm: Settings → Applications → <strong>Spotify Scrobbling → Connect</strong>.</li>
            <li>Type your Last.fm username here.</li>
          </ol>
          {configured ? (
            <form action={connectLastfm} className="row gap-8" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: "1 1 200px" }}>
                <label htmlFor="lfm-user" className="label">Last.fm username</label>
                <input id="lfm-user" name="username" className="input" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={60} required />
              </div>
              <PendingButton className="btn btn-primary" pending="Connecting…">Connect</PendingButton>
            </form>
          ) : (
            <p className="muted small">Coming soon.</p>
          )}
        </>
      )}
      {msg ? <p className={msg.error ? "error small" : "small"} role="status">{msg.text}</p> : null}
      <p className="muted small">Uses only your public Last.fm listening history. Nothing is posted anywhere.</p>
    </div>
  );
}
