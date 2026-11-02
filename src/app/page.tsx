import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { EntryRow, RelistenRow } from "@/components/EntryCard";
import { rng } from "@/lib/discover";
import { snoozeRediscover } from "@/app/actions";
import { AutoLogged, LastfmSuggestions, Turntable, WaitingReview, type Review, type Suggestion } from "@/components/LastfmSuggestions";
import { LastfmSync } from "@/components/LastfmSync";
import { COMPLETE_SHARE } from "@/lib/lastfm";
import { DiaryChallenges } from "@/components/ChallengeCards";
import { Suspense } from "react";
import { artistPath, daysBetween, logPath, monthName, recordPath, shortDate, stars, todayIso, type Album, type EntryWithAlbum } from "@/lib/format";

const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
/** Monday of the week the day is in (ISO weeks). */
function weekStart(iso: string, weeksBack = 0) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7 * weeksBack);
  return isoDay(d);
}

type Section = { key: string; title: string; summary?: string; items: EntryWithAlbum[]; collapsible: boolean; open: boolean };

export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ saved?: string; todo?: string; view?: string }> }) {
  const { saved, todo, view } = await searchParams;
  const covers = view === "covers";
  const { supabase, user } = await getUser();
  // New accounts take the short sign-up quiz first (skippable). Before migration 0005 the
  // column doesn't exist, the query errors, and nobody is redirected.
  const { data: profile, error: profileError } = await supabase.from("profiles").select("onboarded_at").eq("id", user!.id).maybeSingle();
  if (!profileError && profile && !profile.onboarded_at) redirect("/welcome");
  const since14 = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
  const [entriesRes, listRes, snoozeRes, lfmLinkRes, lfmRes, reviewRes] = await Promise.all([
    supabase
      .from("entries")
      .select("*, album:albums(*)")
      .eq("user_id", user!.id)
      .order("listened_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("to_listen").select("album:albums(*)").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(3),
    supabase.from("rediscover_snoozed").select("album_id").eq("user_id", user!.id).gte("until", todayIso()),
    supabase.from("lastfm_links").select("username").eq("user_id", user!.id).maybeSingle(),
    supabase
      .from("lastfm_suggestions")
      .select("id, deezer_id, title, artist, cover, played_on, tracks_played, total_tracks, status")
      .eq("user_id", user!.id)
      .in("status", ["pending", "listening", "finished"])
      .gte("played_on", since14)
      .order("played_on", { ascending: false })
      .limit(20),
    // Logged automatically, not reviewed yet (migration 0014)
    supabase
      .from("lastfm_suggestions")
      .select("id, deezer_id, title, artist, cover, played_on, tracks_played, total_tracks, status, review")
      .eq("user_id", user!.id)
      .eq("status", "logged")
      .not("review", "is", null)
      .gte("played_on", since14)
      .order("played_on", { ascending: false })
      .limit(30),
  ]);
  // Before migration 0010 these tables don't exist: then there's simply nothing from Last.fm.
  const lastfmLinked = !lfmLinkRes.error && !!lfmLinkRes.data;
  const lfmAll = (lfmRes.error ? [] : lfmRes.data ?? []) as Suggestion[];
  // Started albums sit on the turntable (older rows may still say "pending").
  const isStarted = (s: Suggestion) => s.status === "listening" || (s.status === "pending" && s.tracks_played / Math.max(1, s.total_tracks) < COMPLETE_SHARE);
  // Already in the diary since it was spotted (logged, rated, "heard before"…)? Then it's done.
  const inDiarySince = (s: Suggestion) =>
    ((entriesRes.data ?? []) as unknown as EntryWithAlbum[]).some((e) => e.album?.deezer_id === s.deezer_id && (e.created_at ?? "").slice(0, 10) >= s.played_on);
  const lfmOpen = lfmAll.filter((s) => !inDiarySince(s));
  const turntable = lfmOpen.filter(isStarted).slice(0, 4);
  // Finished ones ("how was it?") first, then the newest; three at most.
  const asks = lfmOpen.filter((s) => !isStarted(s)).sort((a, b) => (a.status === "finished" ? -1 : 0) - (b.status === "finished" ? -1 : 0));
  const suggestions = asks.slice(0, 3);
  const moreSuggestions = Math.max(0, asks.length - suggestions.length);
  const snoozed = new Set(((snoozeRes.data ?? []) as { album_id: string }[]).map((r) => r.album_id));
  const entries = (entriesRes.data ?? []) as unknown as EntryWithAlbum[];
  // Logged automatically from Spotify and not rated or written about yet: ask now, or wait at the bottom.
  // One per album (the newest) — played it two days running is one question, not two.
  // Heard it before (an earlier entry)? Then it's a relisten: show your rating and offer to adjust it.
  const reviews: (Review & { later: boolean })[] = [];
  const seenAlbum = new Set<number>();
  for (const r of (reviewRes.error ? [] : reviewRes.data ?? []) as (Suggestion & { review: string })[]) {
    if (seenAlbum.has(r.deezer_id)) continue;
    const e = entries.find((x) => x.album?.deezer_id === r.deezer_id && x.listened_on === r.played_on);
    if (!e || e.rating !== null || e.note) continue;
    seenAlbum.add(r.deezer_id);
    const earlier = entries.filter((x) => x.album?.deezer_id === r.deezer_id && x.id !== e.id);
    if (earlier.length) continue; // a relisten: just logged on its day (a small line in the diary), no questions
    const rated = earlier.find((x) => x.rating !== null); // newest first
    reviews.push({ s: r, entryId: e.id, later: r.review === "later", plays: earlier.length + 1, prevRating: rated ? Number(rated.rating) : null });
  }
  const reviewNow = reviews.filter((r) => !r.later).slice(0, 3);
  const reviewLaterList = [...reviews.filter((r) => r.later), ...reviews.filter((r) => !r.later).slice(3)];
  const toListen = ((listRes.data ?? []) as unknown as { album: Album }[]).map((r) => r.album).filter(Boolean);
  const today = todayIso();

  // Records you knew from before Discomplete go on the shelf, not on a day in the diary.
  // Once you write about one, it shows in the diary on the day you wrote it.
  const fromBefore = entries.filter((e) => e.kind === "before");
  // Listens still waiting for stars or words (plain relistens don't count — they're just "played again").
  const isTodo = (e: EntryWithAlbum) => e.kind !== "before" && !(e.kind === "relisten" && e.rating === null && !e.note) && (e.rating === null || !e.note);
  const todoCount = entries.filter(isTodo).length;
  const dated = entries.filter((e) => e.kind !== "before" || !!e.note).filter((e) => !todo || isTodo(e));

  // For plain relistens: which listen this was (2nd, 3rd…) and your best rating of the record.
  const nth = new Map<string, number>();
  const bestRatingOf = new Map<string, number>();
  {
    const count = new Map<string, number>();
    for (const e of [...entries].reverse()) {
      if (e.kind !== "before") count.set(e.album_id, (count.get(e.album_id) ?? 0) + 1);
      nth.set(e.id, count.get(e.album_id) ?? 1);
      if (e.rating !== null && Number(e.rating) > (bestRatingOf.get(e.album_id) ?? 0)) bestRatingOf.set(e.album_id, Number(e.rating));
    }
  }

  // This week · Last week · then one section per month (older months folded, with a one-line summary).
  const thisWeek = weekStart(today);
  const lastWeek = weekStart(today, 1);
  const sections: Section[] = [];
  const sectionFor = (key: string, make: () => Section) => {
    let sec = sections.find((x) => x.key === key);
    if (!sec) sections.push((sec = make()));
    return sec;
  };
  for (const e of dated) {
    const d = e.listened_on;
    if (e.kind !== "before" && d >= thisWeek) sectionFor("w0", () => ({ key: "w0", title: "This week", items: [], collapsible: false, open: true })).items.push(e);
    else if (e.kind !== "before" && d >= lastWeek) sectionFor("w1", () => ({ key: "w1", title: "Last week", items: [], collapsible: false, open: true })).items.push(e);
    else {
      const m = d.slice(0, 7);
      const name = `${MONTHS_FULL[Number(m.slice(5, 7)) - 1]}${m.slice(0, 4) === today.slice(0, 4) ? "" : " " + m.slice(0, 4)}`;
      const current = m === today.slice(0, 7);
      sectionFor(m, () => ({ key: m, title: current ? `Earlier in ${name}` : name, items: [], collapsible: !current, open: current || !!todo })).items.push(e);
    }
  }
  for (const sec of sections) {
    if (!sec.collapsible) continue;
    const listens = sec.items.filter((e) => e.kind !== "before");
    const records = new Set(listens.map((e) => e.album_id)).size;
    const byArtist = new Map<string, number>();
    listens.forEach((e) => byArtist.set(e.album.artist, (byArtist.get(e.album.artist) ?? 0) + 1));
    const top = [...byArtist.entries()].sort((a, b) => b[1] - a[1])[0];
    sec.summary = `${listens.length} ${listens.length === 1 ? "listen" : "listens"} · ${records} ${records === 1 ? "record" : "records"}${top && top[1] > 1 ? ` · most: ${top[0]}` : ""}`;
  }

  // Covers view: each month as a calendar of covers (Monday first).
  const calendarMonths = (() => {
    const byDay = new Map<string, EntryWithAlbum[]>();
    for (const e of entries) if (e.kind !== "before") byDay.set(e.listened_on, [...(byDay.get(e.listened_on) ?? []), e]);
    const months = [...new Set([...byDay.keys()].map((d) => d.slice(0, 7)))].sort().reverse().slice(0, 12);
    return months.map((m) => {
      const [y, mo] = m.split("-").map(Number);
      const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const offset = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7;
      const cells = Array.from({ length: offset + days }, (_, i) => {
        if (i < offset) return null;
        const day = `${m}-${String(i - offset + 1).padStart(2, "0")}`;
        return { day, n: i - offset + 1, items: byDay.get(day) ?? [] };
      });
      const count = cells.reduce((s, c) => s + (c?.items.length ?? 0), 0);
      return { key: m, title: `${MONTHS_FULL[mo - 1]} ${y}`, cells, count };
    });
  })();

  // What's waiting for you, folded into one line at the top.
  const toRate = reviewNow.length + suggestions.length;
  const inboxBits = [
    turntable.length ? `▶ ${turntable.length} on the turntable` : null,
    toRate ? `★ ${toRate} to rate` : null,
    "__REVISIT__",
  ].filter(Boolean) as string[];

  // This month
  const month = today.slice(0, 7);
  const monthEntries = dated.filter((e) => e.kind !== "before" && e.listened_on.startsWith(month));
  const tagCount = new Map<string, number>();
  monthEntries.forEach((e) => e.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)));
  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t).join(", ");
  const albumCount = new Map<string, { album: Album; n: number }>();
  monthEntries.forEach((e) => {
    const cur = albumCount.get(e.album_id);
    albumCount.set(e.album_id, { album: e.album, n: (cur?.n ?? 0) + 1 });
  });
  const onRepeat = [...albumCount.values()].sort((a, b) => b.n - a.n).slice(0, 3);

  // "Remember this?": a record you gave 4★ or 5★ that you haven't played for 6+ weeks.
  // One a day at most, picked at random (favouring higher ratings and longer gaps).
  const latest = new Map<string, EntryWithAlbum>(); // newest entry per record (entries are newest first)
  const best = new Map<string, EntryWithAlbum>(); // highest-rated entry per record
  for (const e of entries) {
    if (!latest.has(e.album_id)) latest.set(e.album_id, e);
    const b = best.get(e.album_id);
    if ((e.rating ?? 0) > (b?.rating ?? 0)) best.set(e.album_id, e);
  }
  const loved = [...best.values()]
    .filter((e) => (e.rating ?? 0) >= 4 && !snoozed.has(e.album_id))
    .map((e) => ({ e, gap: daysBetween(latest.get(e.album_id)!.listened_on, today) }))
    .filter((x) => x.gap >= 42)
    .map((x) => ({ ...x, score: (x.e.rating! - 3) * Math.min(x.gap / 42, 4) }));
  let rediscover: (typeof loved)[number] | null = null;
  if (loved.length) {
    const rand = rng(`${user!.id}|${today}|rediscover`);
    let r = rand() * loved.reduce((s, x) => s + x.score, 0);
    rediscover = loved.find((x) => (r -= x.score) <= 0) ?? loved[0];
  }
  const ago = (days: number) => (days >= 60 ? `${Math.round(days / 30)} months ago` : `${Math.round(days / 7)} weeks ago`);

  // Relisten reminder: a first listen rated 3 or lower, 2+ weeks old, never revisited
  const relistened = new Set(entries.filter((e) => e.kind === "relisten").map((e) => e.album_id));
  const reminder = entries.find(
    (e) => e.kind === "first" && e.rating !== null && e.rating <= 3 && daysBetween(e.listened_on, today) >= 14 && !relistened.has(e.album_id)
  );

  const inbox = inboxBits.map((b) => (b === "__REVISIT__" ? (rediscover || reminder ? "↺ a record to revisit" : null) : b)).filter(Boolean) as string[];

  return (
    <div className="row gap-40" style={{ alignItems: "flex-start" }}>
      <section className="grow stack gap-28">
        <div>
          <p className="eyebrow">Your music diary</p>
          <h1 className="title-xl">Diary</h1>
          <div className="row gap-8" style={{ marginTop: 10, alignItems: "center" }}>
            <nav className="row gap-4" aria-label="Diary view">
              <Link href={todo ? "/?todo=1" : "/"} className="btn btn-sm pill" aria-pressed={!covers} aria-current={!covers ? "page" : undefined}>List</Link>
              <Link href="/?view=covers" className="btn btn-sm pill" aria-pressed={covers} aria-current={covers ? "page" : undefined}>Covers</Link>
            </nav>
          </div>
          {todoCount && !covers ? (
            <Link href={todo ? "/" : "/?todo=1"} className={`badge-todo${todo ? " on" : ""}`} style={{ marginTop: 10, display: "inline-flex" }}>
              {todo ? "✓ Showing listens without stars or a review · Show all" : `${todoCount} ${todoCount === 1 ? "listen needs" : "listens need"} stars or a review →`}
            </Link>
          ) : null}
        </div>

        {lastfmLinked ? <LastfmSync /> : null}
        <details className="inbox">
          <summary>
            <span className="inbox-title">{inbox.length ? "Waiting for you" : "Turntable, challenges & more"}</span>
            <span className="inbox-bits">
              {inbox.length ? inbox.map((b) => <span key={b} className={`inbox-chip${b.startsWith("★") ? " hot" : ""}`}>{b}</span>) : <span className="muted small">Nothing waiting</span>}
            </span>
            <span className="er-chevron" aria-hidden="true">›</span>
          </summary>
          <div className="stack gap-20 inbox-body">
        <Turntable items={turntable} />
        <AutoLogged items={reviewNow} />
        <LastfmSuggestions items={suggestions} more={moreSuggestions} />
        <Suspense fallback={null}>
          <DiaryChallenges />
        </Suspense>

        {rediscover ? (
          <div className="card highlight stack gap-12">
            <div className="row gap-16" style={{ alignItems: "center" }}>
              <Link href={recordPath(rediscover.e.album)} tabIndex={-1} aria-hidden="true">
                <Cover album={rediscover.e.album} size="64" />
              </Link>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <p className="eyebrow" style={{ color: "var(--accent)" }}>Remember this?</p>
                <p style={{ fontWeight: 700, fontSize: 17, marginTop: 2 }}>
                  You gave {rediscover.e.album.title} {stars(rediscover.e.rating)}
                </p>
                <p className="muted">
                  {latest.get(rediscover.e.album_id)!.kind === "before" ? "One of your old favourites." : `Last played ${ago(rediscover.gap)}.`} Want to hear it again — or something else by {rediscover.e.album.artist}?
                </p>
              </div>
            </div>
            <div className="row gap-12" style={{ alignItems: "center" }}>
              <Link href={recordPath(rediscover.e.album)} className="btn btn-primary btn-sm">Listen again</Link>
              {artistPath(rediscover.e.album.artist, rediscover.e.album.deezer_artist_id) ? (
                <Link href={artistPath(rediscover.e.album.artist, rediscover.e.album.deezer_artist_id)!} className="btn btn-sm">
                  More from {rediscover.e.album.artist}
                </Link>
              ) : null}
              <form action={snoozeRediscover}>
                <input type="hidden" name="album_id" value={rediscover.e.album_id} />
                <button type="submit" className="btn-text small" style={{ minHeight: 40 }}>Not now</button>
              </form>
            </div>
          </div>
        ) : reminder ? (
          <div className="card highlight row gap-16">
            <Cover album={reminder.album} size="64" />
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 17 }}>Time for a second listen?</p>
              <p className="muted">
                On {shortDate(reminder.listened_on)} you gave {reminder.album.title} {stars(reminder.rating)}
                {reminder.note ? ` and wrote “${reminder.note.length > 80 ? reminder.note.slice(0, 80) + "…" : reminder.note}”` : ""}
              </p>
            </div>
            <Link href={logPath(reminder.album)} className="btn btn-primary">Log a relisten</Link>
          </div>
        ) : null}
          </div>
        </details>

        {covers ? (
          calendarMonths.length ? (
            calendarMonths.map((m) => (
              <section key={m.key} className="stack gap-8" aria-label={m.title}>
                <div className="row gap-8" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                  <h2 className="title-m">{m.title}</h2>
                  <span className="mono muted small">{m.count} {m.count === 1 ? "listen" : "listens"}</span>
                </div>
                <div className="cal">
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="cal-head">{d}</span>)}
                  {m.cells.map((c, i) =>
                    !c ? (
                      <span key={i} className="cal-cell empty" />
                    ) : c.items.length ? (
                      <Link key={i} href={recordPath(c.items[0].album)} className="cal-cell has" title={c.items.map((e) => e.album.title).join(", ")}>
                        <Cover album={c.items[0].album} size="full" />
                        <span className="cal-n">{c.n}</span>
                        {c.items.length > 1 ? <span className="cal-more">+{c.items.length - 1}</span> : null}
                      </Link>
                    ) : (
                      <span key={i} className={`cal-cell${c.day === today ? " today" : ""}`}><span className="cal-n">{c.n}</span></span>
                    )
                  )}
                </div>
              </section>
            ))
          ) : (
            <p className="muted">No listens with a date yet.</p>
          )
        ) : sections.length ? (
          sections.map((sec) => {
            const rows = (
              <div className="stack gap-8">
                {sec.items.map((e) =>
                  e.kind === "relisten" && e.rating === null && !e.note ? (
                    <RelistenRow key={e.id} entry={e} nth={nth.get(e.id)} rating={bestRatingOf.get(e.album_id) ?? null} />
                  ) : (
                    <EntryRow key={e.id} entry={e} />
                  )
                )}
              </div>
            );
            return sec.collapsible ? (
              <details key={sec.key} className="month-fold" open={sec.open}>
                <summary>
                  <span className="month-title">{sec.title}</span>
                  <span className="mono muted small">{sec.summary}</span>
                  <span className="er-chevron" aria-hidden="true">›</span>
                </summary>
                {rows}
              </details>
            ) : (
              <section key={sec.key} className="stack gap-12" aria-label={sec.title}>
                <h2 className="eyebrow">{sec.title}</h2>
                {rows}
              </section>
            );
          })
        ) : (
          <div className="card-dashed stack gap-12" style={{ alignItems: "flex-start" }}>
            <p style={{ fontWeight: 700, fontSize: 18 }}>Your diary is empty</p>
            <p className="muted">Log the last record you listened to — it takes about fifteen seconds.</p>
            <Link href="/log" className="btn btn-primary">Log a listen</Link>
          </div>
        )}
        <WaitingReview items={reviewLaterList} />
      </section>

      <aside className="side stack gap-20">
        <div className="card stack gap-12">
          <h2 className="eyebrow">{monthName(today)} so far</h2>
          <div className="row gap-28">
            <div>
              <div style={{ fontSize: 44, fontWeight: 800, fontStretch: "75%", lineHeight: 1 }}>{monthEntries.length}</div>
              <div className="muted small">listens logged</div>
            </div>
            <div>
              <div style={{ fontSize: 44, fontWeight: 800, fontStretch: "75%", lineHeight: 1 }}>{albumCount.size}</div>
              <div className="muted small">records</div>
            </div>
          </div>
          {topTags ? <p className="muted" style={{ fontSize: 14 }}>Most tagged: <span style={{ color: "var(--text)" }}>{topTags}</span></p> : null}
        </div>

        {onRepeat.length ? (
          <div className="card stack gap-12">
            <h2 className="eyebrow">On repeat this month</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {onRepeat.map(({ album, n }) => (
                <Link key={album.id} href={recordPath(album)} className="tile" aria-label={`${album.title}, logged ${n} times`}>
                  <Cover album={album} size="full" />
                  <span className="mono muted" style={{ fontSize: 11 }}>{n}×</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card stack gap-12">
          <div className="row gap-8" style={{ justifyContent: "space-between" }}>
            <h2 className="eyebrow">Heard before · {fromBefore.length}</h2>
            <Link href="/log?mode=before" className="btn-text small" style={{ color: "var(--accent)", minHeight: 32, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>+ Add</Link>
          </div>
          {fromBefore.length ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 6 }}>
              {fromBefore.slice(0, 12).map((e) => (
                <Link key={e.id} href={recordPath(e.album)} className="tile" aria-label={`${e.album.title}${e.rating ? `, ${e.rating} of 5` : ""}`}>
                  <Cover album={e.album} size="full" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ fontSize: 14 }}>Records you’ve loved for years? Add them in seconds — no dates needed.</p>
          )}
        </div>

        <div className="card stack gap-12">
          <h2 className="eyebrow">Next up · To listen</h2>
          {toListen.length ? (
            toListen.map((a) => (
              <Link key={a.id} href={recordPath(a)} className="row gap-12" style={{ color: "var(--text)", textDecoration: "none", flexWrap: "nowrap" }}>
                <Cover album={a} size="44" />
                <span className="stack" style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{a.title}</span>
                  <span className="muted small">{a.artist}</span>
                </span>
              </Link>
            ))
          ) : (
            <p className="muted" style={{ fontSize: 14 }}>Nothing queued yet.</p>
          )}
          <Link href="/to-listen" className="btn-text" style={{ color: "var(--accent)", alignSelf: "flex-start", display: "inline-flex", alignItems: "center", textDecoration: "none" }}>See all →</Link>
        </div>
      </aside>

      {saved ? (
        <div className="toast" role="status">
          {saved === "edited" ? "Changes saved" : saved === "deleted" ? "Entry deleted" : saved === "before" ? "Added to Heard before" : saved === "tolisten" ? "Moved to To listen" : "Saved to your diary"}
        </div>
      ) : null}
    </div>
  );
}
