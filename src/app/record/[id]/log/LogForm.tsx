"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { saveEntry } from "@/app/actions";
import { FORMATS, RATING_LABELS, TAGS } from "@/lib/format";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
      {pending ? "Saving…" : "Save to diary"}
    </button>
  );
}

type Props = { albumId: string; defaultFormat: string; loggedBefore: number; today: string };

export function LogForm({ albumId, defaultFormat, loggedBefore, today }: Props) {
  const [format, setFormat] = useState(defaultFormat);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isAnon, setIsAnon] = useState(false);

  const visHelp = isPrivate
    ? "Private — only you will see this entry, and the rating isn’t counted."
    : isAnon
      ? "Public as “Anonymous listener”. Your name is hidden, your rating counts."
      : "Public — shown on the record page with your name.";

  return (
    <form action={saveEntry} className="stack gap-28">
      <input type="hidden" name="album_id" value={albumId} />
      <input type="hidden" name="format" value={format} />
      <input type="hidden" name="rating" value={rating} />
      {tags.map((t) => <input key={t} type="hidden" name="tags" value={t} />)}

      <fieldset className="stack gap-8">
        <legend>How did you listen?</legend>
        <div className="row gap-8">
          {FORMATS.map((f) => (
            <button key={f.value} type="button" className="btn pill" aria-pressed={format === f.value} onClick={() => setFormat(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <p className="mono small muted">
          {loggedBefore
            ? `You’ve logged this ${loggedBefore}× before — saved as a relisten, so you can compare.`
            : "First time in your diary — saved as a first listen."}
        </p>
      </fieldset>

      <fieldset>
        <legend style={{ marginBottom: 6 }}>Rating <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></legend>
        <div className="row" style={{ gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={`star-btn${n <= rating ? " on" : ""}`}
              aria-label={`Rate ${n} of 5`}
              aria-pressed={n === rating}
              onClick={() => setRating(rating === n ? 0 : n)}
            >
              ★
            </button>
          ))}
          <span className="mono small muted" style={{ marginLeft: 12 }}>{RATING_LABELS[rating]}</span>
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="note" className="label">Your note</label>
        <textarea id="note" name="note" rows={4} maxLength={5000} className="textarea" placeholder="First impression, a thought, where you were…" />
      </div>

      <fieldset>
        <legend>Tags</legend>
        <div className="row gap-8">
          {TAGS.map((t) => {
            const on = tags.includes(t);
            return (
              <button key={t} type="button" className="btn btn-sm pill" aria-pressed={on} onClick={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}>
                {t}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="lyric" className="label">A line worth keeping <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
        <input id="lyric" name="lyric" type="text" maxLength={200} className="input" placeholder="A short line from one of the songs" />
        <p className="muted small">Keep it to a line — 200 characters at most.</p>
      </div>

      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor="listened_on" className="label">Listened on</label>
        <input id="listened_on" name="listened_on" type="date" defaultValue={today} max={today} className="input" />
      </div>

      <div className="card stack gap-8">
        <p className="eyebrow">Who sees this</p>
        <div className="check">
          <input id="is_private" name="is_private" type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          <label htmlFor="is_private"><strong>Private only</strong> <span className="muted">— just for my diary</span></label>
        </div>
        <div className="check">
          <input id="is_anonymous" name="is_anonymous" type="checkbox" checked={isAnon && !isPrivate} disabled={isPrivate} onChange={(e) => setIsAnon(e.target.checked)} />
          <label htmlFor="is_anonymous" style={{ color: isPrivate ? "var(--faint)" : undefined }}>
            <strong>Post anonymously</strong> — shown as “Anonymous listener”
          </label>
        </div>
        <p style={{ color: "var(--accent)", fontSize: 14 }} aria-live="polite">{visHelp}</p>
      </div>

      <div className="row gap-12">
        <SaveButton />
        <button type="button" className="btn btn-lg" onClick={() => history.back()}>Cancel</button>
      </div>
    </form>
  );
}
