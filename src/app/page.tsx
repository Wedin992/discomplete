import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { EntryCard } from "@/components/EntryCard";
import { daysBetween, longDate, monthName, shortDate, stars, todayIso, type Album, type EntryWithAlbum } from "@/lib/format";

export default async function DiaryPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const { supabase, user } = await getUser();
  const [entriesRes, listRes] = await Promise.all([
    supabase
      .from("entries")
      .select("*, album:albums(*)")
      .eq("user_id", user!.id)
      .order("listened_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("to_listen").select("album:albums(*)").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(3),
  ]);
  const entries = (entriesRes.data ?? []) as unknown as EntryWithAlbum[];
  const toListen = ((listRes.data ?? []) as unknown as { album: Album }[]).map((r) => r.album).filter(Boolean);
  const today = todayIso();

  // Group by day
  const groups: { label: string; items: EntryWithAlbum[] }[] = [];
  for (const e of entries) {
    const label = (e.listened_on === today ? "Today · " : "") + longDate(e.listened_on);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }

  // This month
  const month = today.slice(0, 7);
  const monthEntries = entries.filter((e) => e.listened_on.startsWith(month));
  const tagCount = new Map<string, number>();
  monthEntries.forEach((e) => e.tags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)));
  const topTags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t).join(", ");
  const albumCount = new Map<string, { album: Album; n: number }>();
  monthEntries.forEach((e) => {
    const cur = albumCount.get(e.album_id);
    albumCount.set(e.album_id, { album: e.album, n: (cur?.n ?? 0) + 1 });
  });
  const onRepeat = [...albumCount.values()].sort((a, b) => b.n - a.n).slice(0, 3);

  // Relisten reminder: a first listen rated 3 or lower, 2+ weeks old, never revisited
  const relistened = new Set(entries.filter((e) => e.kind === "relisten").map((e) => e.album_id));
  const reminder = entries.find(
    (e) => e.kind === "first" && e.rating !== null && e.rating <= 3 && daysBetween(e.listened_on, today) >= 14 && !relistened.has(e.album_id)
  );

  return (
    <div className="row gap-40" style={{ alignItems: "flex-start" }}>
      <section className="grow stack gap-28">
        <div>
          <p className="eyebrow">Your music diary</p>
          <h1 className="title-xl">Diary</h1>
        </div>

        {reminder ? (
          <div className="card highlight row gap-16">
            <Cover album={reminder.album} size="64" />
            <div style={{ flex: "1 1 240px", minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 17 }}>Time for a second listen?</p>
              <p className="muted">
                On {shortDate(reminder.listened_on)} you gave {reminder.album.title} {stars(reminder.rating)}
                {reminder.note ? ` and wrote “${reminder.note.length > 80 ? reminder.note.slice(0, 80) + "…" : reminder.note}”` : ""}
              </p>
            </div>
            <Link href={`/record/${reminder.album_id}/log`} className="btn btn-primary">Log a relisten</Link>
          </div>
        ) : null}

        {groups.length ? (
          groups.map((g) => (
            <div key={g.label} className="stack gap-12">
              <h2 className="eyebrow">{g.label}</h2>
              {g.items.map((e) => <EntryCard key={e.id} entry={e} />)}
            </div>
          ))
        ) : (
          <div className="card-dashed stack gap-12" style={{ alignItems: "flex-start" }}>
            <p style={{ fontWeight: 700, fontSize: 18 }}>Your diary is empty</p>
            <p className="muted">Log the last record you listened to — it takes about fifteen seconds.</p>
            <Link href="/log" className="btn btn-primary">Log a listen</Link>
          </div>
        )}
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
                <Link key={album.id} href={`/record/${album.id}`} className="tile" aria-label={`${album.title}, logged ${n} times`}>
                  <Cover album={album} size="full" />
                  <span className="mono muted" style={{ fontSize: 11 }}>{n}×</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="card stack gap-12">
          <h2 className="eyebrow">Next up · To listen</h2>
          {toListen.length ? (
            toListen.map((a) => (
              <Link key={a.id} href={`/record/${a.id}`} className="row gap-12" style={{ color: "var(--text)", textDecoration: "none", flexWrap: "nowrap" }}>
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
          {saved === "edited" ? "Changes saved" : saved === "deleted" ? "Entry deleted" : "Saved to your diary"}
        </div>
      ) : null}
    </div>
  );
}
