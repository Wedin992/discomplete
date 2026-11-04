import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { recordPath, type Album } from "@/lib/format";

export const metadata: Metadata = { title: "Collection" };

const FILTERS = [
  { value: "vinyl", label: "Vinyl" },
  { value: "cd", label: "CD" },
  { value: "wishlist", label: "Wishlist" },
  { value: "before", label: "Heard before" },
] as const;

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter: raw } = await searchParams;
  const filter = FILTERS.some((f) => f.value === raw) ? raw! : "vinyl";
  const { supabase, user } = await getUser();
  const [collRes, entriesRes] = await Promise.all([
    supabase.from("collection").select("vinyl, cd, wishlist, album:albums(*)").eq("user_id", user!.id),
    supabase.from("entries").select("album_id, kind, album:albums(*)").eq("user_id", user!.id).order("listened_on", { ascending: false }),
  ]);

  type Row = { album: Album; vinyl: boolean; cd: boolean; wishlist: boolean; before: boolean; logged: number };
  const map = new Map<string, Row>();
  for (const c of (collRes.data ?? []) as unknown as { vinyl: boolean; cd: boolean; wishlist: boolean; album: Album }[]) {
    if (c.album && (c.vinyl || c.cd || c.wishlist)) map.set(c.album.id, { album: c.album, vinyl: c.vinyl, cd: c.cd, wishlist: c.wishlist, before: false, logged: 0 });
  }
  for (const e of (entriesRes.data ?? []) as unknown as { album_id: string; kind: string; album: Album }[]) {
    const r = map.get(e.album_id) ?? (e.album ? { album: e.album, vinyl: false, cd: false, wishlist: false, before: false, logged: 0 } : null);
    if (!r) continue;
    if (e.kind === "before") r.before = true;
    else r.logged++;
    map.set(e.album_id, r);
  }
  const rows = [...map.values()].filter((r) => r[filter as "vinyl" | "cd" | "wishlist" | "before"]);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, [...map.values()].filter((r) => r[f.value]).length]));

  return (
    <section className="stack gap-20">
      <div>
        <p className="eyebrow">Yours to keep</p>
        <h1 className="title-xl">Collection</h1>
        <p className="muted" style={{ marginTop: 8 }}>Your vinyl, CDs, wishlist and the records you knew before. Mark them on any record page. Everything you’ve played is in the diary’s Shelf view.</p>

      </div>
      <nav aria-label="Filter records" className="row gap-8">
        {FILTERS.map((f) => (
          <Link key={f.value} href={f.value === "vinyl" ? "/records" : `/records?filter=${f.value}`} className="btn pill" aria-pressed={filter === f.value} aria-current={filter === f.value ? "page" : undefined}>
            {f.label} <span className="muted small">{counts[f.value]}</span>
          </Link>
        ))}
      </nav>
      {rows.length ? (
        <div className="grid-covers">
          {rows.map((r) => {
            const bits = [r.vinyl && "Vinyl", r.cd && "CD", r.wishlist && "Wishlist", r.logged && `Logged ${r.logged}×`].filter(Boolean).join(" · ");
            return (
              <Link key={r.album.id} href={recordPath(r.album)} className="tile">
                <Cover album={r.album} size="full" />
                <span style={{ fontWeight: 700 }}>{r.album.title}</span>
                <span className="muted" style={{ fontSize: 14 }}>{r.album.artist}</span>
                <span className="small" style={{ color: "var(--accent)" }}>{bits}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="muted">{filter === "before" ? "Records you knew before you started your diary show up here. Tap “Heard it? Rate it” on any record." : filter === "wishlist" ? "Nothing on your wishlist. Tap Wishlist on any record page." : `No ${filter === "cd" ? "CDs" : "vinyl"} marked yet. Tap ${filter === "cd" ? "CD" : "Vinyl"} on any record page.`}</p>
      )}
    </section>
  );
}
