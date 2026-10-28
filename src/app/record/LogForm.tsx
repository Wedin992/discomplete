"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { saveEntry } from "@/app/actions";
import { FORMATS, RATING_LABELS, TAGS } from "@/lib/format";

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
      {pending ? "Saving…" : editing ? "Save changes" : "Save to diary"}
    </button>
  );
}

export type EntryDraft = {
  format: string;
  rating: number;
  note: string;
  tags: string[];
  isPrivate: boolean;
  isAnonymous: boolean;
  listenedOn: string;
  /** "first" or "before": offered when this is the record's only entry. */
  kind?: string;
};

type Props = {
  albumId: string;
  today: string;
  initial: EntryDraft;
  /** Set when editing an existing entry. */
  entryId?: string;
  /** How many times this record was logged before (new entries only). */
  loggedBefore?: number;
  /** Offer "I want to hear more from <artist>" when the artist is known. */
  explore?: { artist: string; following: boolean } | null;
};

export function LogForm({ albumId, today, initial, entryId, loggedBefore = 0, explore = null }: Props) {
  const editing = !!entryId;
  const [format, setFormat] = useState(initial.format);
  const [rating, setRating] = useState(initial.rating);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [isPrivate, setIsPrivate] = useState(initial.isPrivate);
  const [isAnon, setIsAnon] = useState(initial.isAnonymous);
  // New-to-me vs heard it before: offered for a record's first entry (and when editing that one).
  const offerBefore = editing ? initial.kind === "first" || initial.kind === "before" : loggedBefore === 0;
  const [heardBefore, setHeardBefore] = useState(initial.kind === "before");

  const visHelp = isPrivate
    ? "Private — only you will see this entry, and the rating isn’t counted."
    : isAnon
      ? "Public as “Anonymous listener”. Your name is hidden, your rating counts."
      : "Public — shown on the record page with your name.";

  return (
    <form action={saveEntry} className="stack gap-28">
      <input type="hidden" name="album_id" value={albumId} />
      {editing ? <input type="hidden" name="entry_id" value={entryId} /> : null}
      <input type="hidden" name="format" value={format} />
      <input type="hidden" name="rating" value={rating} />
      {offerBefore ? <input type="hidden" name="kind_choice" value={heardBefore ? "before" : "first"} /> : null}
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
        {!editing && loggedBefore ? (
          <p className="mono small muted">You’ve logged this {loggedBefore}× before — saved as a relisten, so you can compare.</p>
        ) : null}
      </fieldset>

      {offerBefore ? (
        <fieldset className="stack gap-8">
          <legend>Is it new to you?</legend>
          <div className="row gap-8">
            <button type="button" className="btn pill" aria-pressed={!heardBefore} onClick={() => setHeardBefore(false)}>First listen</button>
            <button type="button" className="btn pill" aria-pressed={heardBefore} onClick={() => setHeardBefore(true)}>Heard it before</button>
          </div>
          <p className="mono small muted">
            {heardBefore
              ? "An old favourite or one you know from way back — no date needed. It goes on your shelf, not today’s diary."
              : "First time you’ve properly listened to it."}
          </p>
        </fieldset>
      ) : null}

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
        <textarea id="note" name="note" rows={4} maxLength={5000} className="textarea" defaultValue={initial.note} placeholder="First impression, a thought, where you were…" />
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

      {explore ? (
        <div className="card stack gap-4">
          <input type="hidden" name="explore_shown" value="1" />
          <div className="check">
            <input id="explore_artist" name="explore_artist" type="checkbox" defaultChecked={explore.following} />
            <label htmlFor="explore_artist"><strong>I want to hear more from {explore.artist}</strong></label>
          </div>
          <p className="muted small" style={{ paddingLeft: 34 }}>Their other albums show up under To listen, so you know what to play next.</p>
        </div>
      ) : null}

      {heardBefore ? null : (
        <div className="field" style={{ maxWidth: 260 }}>
          <label htmlFor="listened_on" className="label">Listened on</label>
          <input id="listened_on" name="listened_on" type="date" defaultValue={initial.listenedOn} max={today} className="input" />
        </div>
      )}

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
        <SaveButton editing={editing} />
        <button type="button" className="btn btn-lg" onClick={() => history.back()}>Cancel</button>
      </div>
    </form>
  );
}
