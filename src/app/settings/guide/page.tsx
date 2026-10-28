import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { isOwner } from "@/lib/owner";
import { REVISIONS, SECTIONS } from "./content";

export const metadata: Metadata = { title: "Guide", robots: { index: false, follow: false } };

const svDate = (iso: string) => new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso + "T12:00:00Z"));

export default async function GuidePage() {
  const { user } = await getUser();
  if (!isOwner(user?.email)) notFound();
  const latest = REVISIONS[0];
  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 640 }}>
      <div className="stack gap-8">
        <Link href="/settings" className="btn-text small" style={{ alignSelf: "flex-start" }}>← Settings</Link>
        <p className="eyebrow">Only you can see this</p>
        <h1 className="title-xl">Guide</h1>
        <p className="mono muted" style={{ fontSize: 12 }}>Version {latest.version} · uppdaterad {svDate(latest.date)}</p>
      </div>

      <div className="card stack gap-12" aria-labelledby="news">
        <h2 id="news" className="eyebrow" style={{ color: "var(--accent)" }}>Nytt i version {latest.version}</h2>
        <ul className="stack gap-8" style={{ paddingLeft: 18, margin: 0 }}>
          {latest.changes.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </div>

      <nav className="row gap-8" aria-label="Innehåll" style={{ flexWrap: "wrap" }}>
        {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="chip" style={{ textDecoration: "none" }}>{s.title}</a>)}
      </nav>

      {SECTIONS.map((s) => (
        <div key={s.id} id={s.id} className="stack gap-12" style={{ scrollMarginTop: 80 }}>
          <h2 className="title-m">{s.title}</h2>
          {s.body.map((p) => <p key={p} style={{ lineHeight: 1.6 }}>{p}</p>)}
        </div>
      ))}

      {REVISIONS.length > 1 ? (
        <details className="card">
          <summary className="eyebrow" style={{ cursor: "pointer" }}>Tidigare versioner</summary>
          <div className="stack gap-16" style={{ marginTop: 12 }}>
            {REVISIONS.slice(1).map((r) => (
              <div key={r.version} className="stack gap-4">
                <p className="mono muted" style={{ fontSize: 12 }}>Version {r.version} · {svDate(r.date)}</p>
                <ul style={{ paddingLeft: 18, margin: 0 }}>{r.changes.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
