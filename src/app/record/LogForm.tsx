"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { saveEntry } from "@/app/actions";
import { FORMATS, TAGS, ratingLabel, ratingText, type FavTrack } from "@/lib/format";
import { StarInput } from "@/components/StarInput";

function SaveButton({ editing, big = false }: { editing: boolean; big?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={big ? "btn btn-primary btn-lg log-save-big" : "btn btn-primary btn-sm"} disabled={pending}>
      {pending ? "Saving…" : editing ? "Save" : big ? "Save to diary" : "Save"}
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
  favTracks?: FavTrack[];
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
  /** The record's tracklist, for picking up to three favourites. */
  tracks?: FavTrack[];
  /** Logging a Last.fm suggestion: it's marked as logged when saved. */
  suggestionId?: string;
  /** The record (title, artist, cover) shown at the top of the sheet. */
  head?: React.ReactNode;
};

export function LogForm({ albumId, today, initial, entryId, loggedBefore = 0, explore = null, tracks = [], suggestionId, head }: Props) {
  const editing = !!entryId;
  const [format, setFormat] = useState(initial.format);
  const [rating, setRating] = useState(initial.rating);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [isPrivate, setIsPrivate] = useState(initial.isPrivate);
  const [isAnon, setIsAnon] = useState(initial.isAnonymous);
  // New-to-me vs heard it before: offered for a record's first entry (and when editing that one).
  const offerBefore = editing ? initial.kind === "first" || initial.kind === "before" : loggedBefore === 0 && !suggestionId;
  const [heardBefore, setHeardBefore] = useState(initial.kind === "before");
  const [favs, setFavs] = useState<FavTrack[]>(initial.favTracks ?? []);
  const [showTracks, setShowTracks] = useState(false);
  const [open, setOpen] = useState<null | "date" | "tags" | "who">(null);
  const toggle = (k: "date" | "tags" | "who") => setOpen((o) => (o === k ? null : k));
  const [listenedOn, setListenedOn] = useState(initial.listenedOn);
  const toggleFav = (t: FavTrack) =>
    setFavs((cur) => (cur.some((f) => f.id === t.id) ? cur.filter((f) => f.id !== t.id) : cur.length >= 3 ? cur : [...cur, t].sort((a, b) => a.position - b.position)));

  const visHelp = isPrivate
    ? "Private — only you will see this entry, and the rating isn’t counted."
    : isAnon
      ? "Public as “Anonymous listener”. Your name is hidden, your rating counts."
      : "Public — shown on the record page with your name.";

  const dayLabel = listenedOn === today ? "Today" : listenedOn;
  const whoLabel = isPrivate ? "Private" : isAnon ? "Anonymous" : "Public";

  return (
    <form action={saveEntry} className="log-sheet">
      <input type="hidden" name="album_id" value={albumId} />
      {editing ? <input type="hidden" name="entry_id" value={entryId} /> : null}
      <input type="hidden" name="format" value={format} />
      <input type="hidden" name="rating" value={rating} />
      <input type="hidden" name="fav_tracks" value={JSON.stringify(favs)} />
      {suggestionId ? <input type="hidden" name="suggestion_id" value={suggestionId} /> : null}
      {offerBefore ? <input type="hidden" name="kind_choice" value={heardBefore ? "before" : "first"} /> : null}
      {tags.map((t) => <input key={t} type="hidden" name="tags" value={t} />)}
      {heardBefore ? null : <input type="hidden" name="listened_on" value={listenedOn} />}
      {isPrivate ? <input type="hidden" name="is_private" value="on" /> : null}
      {isAnon && !isPrivate ? <input type="hidden" name="is_anonymous" value="on" /> : null}

      <div className="log-bar">
        <button type="button" className="btn-text" onClick={() => history.back()}>Cancel</button>
        <strong>{editing ? "Edit listen" : "Log a listen"}</strong>
        <SaveButton editing={editing} />
      </div>

      {head}

      <div className="log-stars">
        <StarInput value={rating} onChange={setRating} size="lg" clearable label="Rating" />
        <span className="small muted">{rating ? `${ratingText(rating)} · ${ratingLabel(rating)}` : "Tap a star — left half for a half"}</span>
      </div>

      <textarea id="note" name="note" rows={4} maxLength={5000} className="textarea log-note" defaultValue={initial.note} placeholder="What did you think? A line is plenty — or nothing at all." aria-label="Your note" />

      <div className="log-group">
        <span className="log-label">How did you listen?</span>
        <div className="row gap-8">
          {FORMATS.map((f) => (
            <button key={f.value} type="button" className="btn btn-sm pill" aria-pressed={format === f.value} onClick={() => setFormat(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        {!editing && loggedBefore ? <p className="small muted">You’ve logged this {loggedBefore}× before — saved as a relisten.</p> : null}
      </div>

      {offerBefore ? (
        <div className="log-group">
          <span className="log-label">Is it new to you?</span>
          <div className="row gap-8">
            <button type="button" className="btn btn-sm pill" aria-pressed={!heardBefore} onClick={() => setHeardBefore(false)}>First listen</button>
            <button type="button" className="btn btn-sm pill" aria-pressed={heardBefore} onClick={() => setHeardBefore(true)}>Heard it before</button>
          </div>
          {heardBefore ? <p className="small muted">No date needed — it goes under “Heard before”.</p> : null}
        </div>
      ) : null}

      <div className="log-more">
        {heardBefore ? null : (
          <div className="log-opt">
            <button type="button" className="log-opt-head" aria-expanded={open === "date"} onClick={() => toggle("date")}>
              <span>Listened</span><span className="muted">{dayLabel} ›</span>
            </button>
            {open === "date" ? (
              <input type="date" value={listenedOn} max={today} onChange={(e) => setListenedOn(e.target.value || today)} className="input input-sm" aria-label="Listened on" style={{ maxWidth: 220 }} />
            ) : null}
          </div>
        )}

        {tracks.length ? (
          <div className="log-opt">
            <button type="button" className="log-opt-head" aria-expanded={showTracks} onClick={() => setShowTracks((v) => !v)}>
              <span>Favourite tracks</span>
              <span className="muted log-opt-val">{favs.length ? favs.map((f) => f.title).join(", ") : "Up to 3"} ›</span>
            </button>
            {showTracks ? (
              <ol className="fav-list" aria-label="Tracklist">
                {tracks.map((t) => {
                  const on = favs.some((f) => f.id === t.id);
                  const full = !on && favs.length >= 3;
                  return (
                    <li key={t.id}>
                      <button type="button" className={`fav-track${on ? " on" : ""}`} aria-pressed={on} disabled={full} onClick={() => toggleFav(t)}>
                        <span className="mono muted fav-pos">{t.position}</span>
                        <span className="fav-title">{t.title}</span>
                        <span className="fav-heart" aria-hidden="true">{on ? "♥" : "♡"}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </div>
        ) : null}

        <div className="log-opt">
          <button type="button" className="log-opt-head" aria-expanded={open === "tags"} onClick={() => toggle("tags")}>
            <span>Tags</span><span className="muted log-opt-val">{tags.length ? tags.join(", ") : "Add"} ›</span>
          </button>
          {open === "tags" ? (
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
          ) : null}
        </div>

        <div className="log-opt">
          <button type="button" className="log-opt-head" aria-expanded={open === "who"} onClick={() => toggle("who")}>
            <span>Who sees it</span><span className="muted">{whoLabel} ›</span>
          </button>
          {open === "who" ? (
            <div className="stack gap-4">
              <div className="row gap-8">
                <button type="button" className="btn btn-sm pill" aria-pressed={!isPrivate && !isAnon} onClick={() => { setIsPrivate(false); setIsAnon(false); }}>Public</button>
                <button type="button" className="btn btn-sm pill" aria-pressed={!isPrivate && isAnon} onClick={() => { setIsPrivate(false); setIsAnon(true); }}>Anonymous</button>
                <button type="button" className="btn btn-sm pill" aria-pressed={isPrivate} onClick={() => setIsPrivate(true)}>Private</button>
              </div>
              <p className="small muted" aria-live="polite">{visHelp}</p>
            </div>
          ) : null}
        </div>

        {explore ? (
          <div className="log-opt">
            <input type="hidden" name="explore_shown" value="1" />
            <label className="check" style={{ minHeight: 48 }}>
              <input name="explore_artist" type="checkbox" defaultChecked={explore.following} />
              <span>I want to hear more from {explore.artist}</span>
            </label>
          </div>
        ) : null}
      </div>

      <SaveButton editing={editing} big />
    </form>
  );
}
