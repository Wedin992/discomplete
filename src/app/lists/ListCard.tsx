import Link from "next/link";
import { Cover } from "@/components/Cover";
import type { ListSummary } from "@/lib/lists";

/** A list as a row: up to four covers fanned out, title, count. */
export function ListCard({ list, by }: { list: ListSummary; by?: string | null }) {
  return (
    <Link href={`/lists/${list.id}`} className="list-card">
      <span className="list-covers" aria-hidden="true">
        {list.covers.length ? list.covers.map((a) => <Cover key={a.id} album={a} size="64" />) : <span className="cover cover-64" />}
      </span>
      <span className="stack gap-4" style={{ minWidth: 0 }}>
        <strong className="list-title">{list.title}</strong>
        <span className="small muted">
          {list.count} {list.count === 1 ? "album" : "albums"}
          {by ? ` · by ${by}` : ""}
          {!list.is_public ? " · private" : ""}
        </span>
      </span>
    </Link>
  );
}
