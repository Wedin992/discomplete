import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { addToList, deleteList, moveInList, removeFromList, saveListNote, startChallenge, updateList } from "@/app/actions";
import { loadList, queuedOptions } from "@/lib/lists";
import { diaryIndex, doneIn } from "@/lib/challenges";
import { recordPath, stars } from "@/lib/format";
import { Cover } from "@/components/Cover";
import { PendingButton } from "@/components/PendingButton";
import { CopyLink } from "@/components/CopyLink";
import { AlbumPicker } from "@/components/AlbumPicker";

export const metadata: Metadata = { title: "List" };

export default async function ListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; saved?: string; added?: string }> }) {
  const { id } = await params;
  const flags = await searchParams;
  const { supabase, user } = await getUser();
  const loaded = await loadList(supabase, id);
  if (!loaded) notFound();
  const { list, items, owner } = loaded;
  const mine = list.user_id === user!.id;

  const [index, chRes, queued] = await Promise.all([
    diaryIndex(supabase, user!.id),
    supabase.from("challenges").select("id").eq("user_id", user!.id).eq("kind", "user_list").eq("ref", list.id).maybeSingle(),
    mine ? queuedOptions(supabase, user!.id) : Promise.resolve([]),
  ]);
  const challengeId = (chRes.data as { id: string } | null)?.id ?? null;
  const heard = items.filter((i) => doneIn(index, { deezerId: i.album.deezer_id ?? 0, artist: i.album.artist, title: i.album.title })).length;
  const host = (await headers()).get("host") ?? "www.discomplete.com";
  const by = owner?.display_name || owner?.username || "someone";

  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 720 }}>
      <div className="stack gap-8">
        <p className="eyebrow">{mine ? (list.is_public ? "Your list · public" : "Your list · private") : <>A list by {owner?.username ? <Link href={`/u/${owner.username}`} style={{ color: "inherit" }}>{by}</Link> : by}</>}</p>
        <h1 className="title-xl">{list.title}</h1>
        {list.description ? <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{list.description}</p> : null}
        {flags.new ? <p className="small lfm-msg" role="status">Your list is ready. Add the first album below.</p> : null}
        {flags.saved ? <div className="toast" role="status">Saved ✓</div> : null}
        {flags.added ? <div className="toast" role="status">Added to the list ✓</div> : null}
        {items.length ? (
          <div className="stack gap-4" style={{ maxWidth: 320, marginTop: 4 }}>
            <span className="small muted">You’ve heard {heard} of {items.length}</span>
            <div className="bar" style={{ height: 6 }} aria-hidden="true"><span style={{ width: `${Math.round((heard / items.length) * 100)}%` }} /></div>
          </div>
        ) : null}
        {items.length ? (
          challengeId ? (
            <Link href={`/challenges/${challengeId}`} className="btn btn-sm" style={{ alignSelf: "flex-start", marginTop: 4 }}>✓ You’re taking it on — open</Link>
          ) : (
            <form action={startChallenge} style={{ marginTop: 4 }}>
              <input type="hidden" name="kind" value="user_list" />
              <input type="hidden" name="ref" value={list.id} />
              <PendingButton className="btn btn-sm btn-primary" pending="Starting…">Take it on as a challenge</PendingButton>
            </form>
          )
        ) : null}
      </div>

      <ol className="list-items">
        {items.map((it, i) => {
          const d = doneIn(index, { deezerId: it.album.deezer_id ?? 0, artist: it.album.artist, title: it.album.title });
          return (
            <li key={it.album.id} className="list-item">
              {list.ranked ? <span className="list-rank mono">{i + 1}</span> : null}
              <Link href={recordPath(it.album)} tabIndex={-1} aria-hidden="true"><Cover album={it.album} size="64" /></Link>
              <div className="stack gap-4" style={{ minWidth: 0, flex: 1 }}>
                <p>
                  <Link href={recordPath(it.album)} className="link-button">{it.album.title}</Link>
                  <span className="muted"> · {it.album.artist}{it.album.release_year ? ` · ${it.album.release_year}` : ""}</span>
                </p>
                {d ? <span className="small" style={{ color: "var(--accent)" }}>✓ In your diary{d.rating ? ` · ${stars(d.rating)}` : ""}</span> : null}
                {mine ? (
                  <form action={saveListNote} className="row gap-8" style={{ alignItems: "center", flexWrap: "nowrap" }}>
                    <input type="hidden" name="list_id" value={list.id} />
                    <input type="hidden" name="album_id" value={it.album.id} />
                    <input name="note" defaultValue={it.note ?? ""} maxLength={280} className="input input-sm" placeholder="Why is it here?" aria-label={`Why ${it.album.title} is on the list`} />
                    <PendingButton className="btn btn-sm" pending="…">Save</PendingButton>
                  </form>
                ) : it.note ? (
                  <p style={{ fontStyle: "italic" }}>“{it.note}”</p>
                ) : null}
              </div>
              {mine ? (
                <div className="list-tools">
                  {(["up", "down"] as const).map((dir) => (
                    <form key={dir} action={moveInList}>
                      <input type="hidden" name="list_id" value={list.id} />
                      <input type="hidden" name="album_id" value={it.album.id} />
                      <input type="hidden" name="dir" value={dir} />
                      <button type="submit" className="icon-btn" aria-label={`Move ${it.album.title} ${dir}`} disabled={(dir === "up" && i === 0) || (dir === "down" && i === items.length - 1)}>{dir === "up" ? "↑" : "↓"}</button>
                    </form>
                  ))}
                  <form action={removeFromList}>
                    <input type="hidden" name="list_id" value={list.id} />
                    <input type="hidden" name="album_id" value={it.album.id} />
                    <button type="submit" className="icon-btn" aria-label={`Remove ${it.album.title}`}>×</button>
                  </form>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {!items.length && !mine ? <p className="muted">This list is empty so far.</p> : null}

      {mine ? (
        <>
          <div className="card stack gap-12">
            <h2 className="eyebrow">Add an album</h2>
            <AlbumPicker action={addToList} hidden={{ list_id: list.id }} submitLabel="Add to the list" noteLabel="Why is it here? (optional)" queued={queued} />
          </div>

          {list.is_public ? (
            <div className="card stack gap-8">
              <h2 className="eyebrow">Share</h2>
              <p className="muted small">Anyone with a Discomplete account can open the list and take it on.</p>
              <CopyLink url={`https://${host}/lists/${list.id}`} title={`${list.title} — a list on Discomplete`} />
            </div>
          ) : null}

          <details className="card">
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>List settings</summary>
            <form action={updateList} className="stack gap-12" style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={list.id} />
              <label className="stack gap-4"><span className="small muted">Name</span><input name="title" className="input" defaultValue={list.title} maxLength={100} required /></label>
              <label className="stack gap-4"><span className="small muted">About this list</span><textarea name="description" className="textarea" defaultValue={list.description ?? ""} maxLength={1000} rows={3} /></label>
              <label className="row gap-8" style={{ alignItems: "center" }}><input type="checkbox" name="is_public" defaultChecked={list.is_public} /> Public — others can see it and take it on</label>
              <label className="row gap-8" style={{ alignItems: "center" }}><input type="checkbox" name="ranked" defaultChecked={list.ranked} /> Ranked — show 1, 2, 3…</label>
              <PendingButton className="btn btn-primary" pending="Saving…" style={{ alignSelf: "flex-start" }}>Save</PendingButton>
            </form>
            <form action={deleteList} style={{ marginTop: 16 }}>
              <input type="hidden" name="id" value={list.id} />
              <PendingButton className="btn-text small muted" pending="Deleting…">Delete this list</PendingButton>
            </form>
          </details>
        </>
      ) : null}
    </section>
  );
}
