import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { Cover } from "@/components/Cover";
import { logPath, type Album } from "@/lib/format";
import { Search } from "./Search";

export const metadata: Metadata = { title: "Log a listen" };

export default async function LogPage({ searchParams }: { searchParams: Promise<{ error?: string; q?: string; mode?: string }> }) {
  const { supabase } = await getUser();
  const { error, q, mode } = await searchParams;
  const before = mode === "before";
  const { data } = await supabase
    .from("entries")
    .select("album:albums(*)")
    .order("created_at", { ascending: false })
    .limit(30);

  const seen = new Set<string>();
  const recent: Album[] = [];
  for (const row of (data ?? []) as unknown as { album: Album }[]) {
    if (row.album && !seen.has(row.album.id)) {
      seen.add(row.album.id);
      recent.push(row.album);
    }
    if (recent.length === 4) break;
  }

  return (
    <section className="stack gap-28 narrow">
      <div>
        <p className="eyebrow">{before ? "Heard before" : "Log a listen"}</p>
        <h1 className="title-xl">{before ? "Records you know" : "What did you listen to?"}</h1>
      </div>
      {error ? <p className="error" role="alert">Couldn’t open that record. Try again in a moment.</p> : null}
      <Search key={before ? "before" : "log"} initialQuery={q ?? ""} initialMode={before ? "before" : "log"} modeLinks>
        {recent.length ? (
          <div className="stack gap-12">
            <p className="eyebrow">Recently logged</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
              {recent.map((a) => (
                <Link key={a.id} href={logPath(a)} className="tile">
                  <Cover album={a} size="full" />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{a.title}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </Search>
      <p className="muted small">Search runs on Deezer’s open catalogue. No streaming account needed.</p>
    </section>
  );
}
