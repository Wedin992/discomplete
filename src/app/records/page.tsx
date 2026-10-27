import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import type { Album } from "@/lib/format";

export const metadata: Metadata = { title: "Records" };

const FILTERS = [
  { value: "all", label: "All" },
  { value: "vinyl", label: "Vinyl" },
  { value: "cd", label: "CD" },
  { value: "wishlist", label: "Wishlist" },
] as const;

export default async function RecordsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter: raw } = await searchParams;
  const filter = FILTERS.some((f) => f.value === raw) ? raw! : "all";
  const { supabase, user } = await getUser();
  const [collRes, entriesRes] = await Promise.all([
    supabase.from("collection").select("vinyl, cd, wishlist, album:albums(*)").eq("user_id", user!.id),
    supabase.from("entries").select("album_id, album:albums(*)").eq("user_id", user!.id).order("listened_on", { ascending: false }),
  ]);

  type Row = { album: Album; vinyl: boolean; cd: boolean; wishlist: boolean; logged: number };
  const map = new Map<string, Row>();
  for (const c of (collRes.data ?? []) as unknown as { vinyl: boolean; cd: boolean; wishlist: boolean; album: Album }[]) {
    if (c.album && (c.vinyl || c.cd || c.wishlist)) map.set(c.album.id, { album: c.album, vinyl: c.vinyl, cd: c.cd, wishlist: c.wishlist, logged: 0 });
  }
  for (const e of (entriesRes.data ?? []) as unknown as { album_id: string; album: Album }[]) {
    const r = map.get(e.album_id);
    if (r) r.logged++;
    else if (e.album) map.set(e.album_id, { album: e.album, vinyl: false, cd: false, wishlist: false, logged: 1 });
  }
  const rows = [...map.values()].filter((r) => filter === "all" || r[filter as "vinyl" | "cd" | "wishlist"]);

  return (
    <section className="stack gap-20">
      <div>
        <p className="eyebrow">Your shelf</p>
        <h1 className="title-xl">Records</h1>
        <p className="muted" style={{ marginTop: 8 }}>Everything you’ve logged or own. Mark vinyl, CD or wishlist on any record page.</p>
      </div>
      <nav aria-label="Filter records" className="row gap-8">
        {FILTERS.map((f) => (
          <Link key={f.value} href={f.value === "all" ? "/records" : `/records?filter=${f.value}`} className="btn pill" aria-pressed={filter === f.value} aria-current={filter === f.value ? "page" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>
      {rows.length ? (
        <div className="grid-covers">
          {rows.map((r) => {
            const bits = [r.vinyl && "Vinyl", r.cd && "CD", r.wishlist && "Wishlist", r.logged && `Logged ${r.logged}×`].filter(Boolean).join(" · ");
            return (
              <Link key={r.album.id} href={`/record/${r.album.id}`} className="tile">
                <Cover album={r.album} size="full" />
                <span style={{ fontWeight: 700 }}>{r.album.title}</span>
                <span className="muted" style={{ fontSize: 14 }}>{r.album.artist}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>{bits}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card-dashed"><p className="muted">Nothing here with this filter yet.</p></div>
      )}
    </section>
  );
}
