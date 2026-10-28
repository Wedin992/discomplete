/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { baseTitle, getArtist, getArtistAlbums, type ArtistAlbum } from "@/lib/deezer";
import { artistPath, recordPath, stars, type Album } from "@/lib/format";
import { openFromDeezer, setExploring } from "@/app/actions";
import { Suspense } from "react";
import { getArtistBio } from "@/lib/wiki";

async function Bio({ name }: { name: string }) {
  const bio = await getArtistBio(name).catch(() => null);
  if (!bio) return null;
  return (
    <div className="stack gap-4">
      <p className="artist-bio">{bio.text}</p>
      <a href={bio.url} target="_blank" rel="noopener noreferrer" className="mono muted" style={{ fontSize: 11 }}>
        Read more on Wikipedia ↗
      </a>
    </div>
  );
}

function BioPlaceholder() {
  return (
    <div className="stack gap-8" aria-hidden="true" style={{ maxWidth: 560 }}>
      {[100, 94, 70].map((w) => <span key={w} className="skeleton" style={{ width: `${w}%`, height: 14, borderRadius: 4 }} />)}
    </div>
  );
}

type Params = Promise<{ slug: string }>;
type Filter = "all" | "logged" | "not-yet";

function parseId(slug: string) {
  const m = slug.match(/-(\d{1,12})$/) ?? slug.match(/^(\d{1,12})$/);
  return m ? Number(m[1]) : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const id = parseId((await params).slug);
  if (!id) return { title: "Artist" };
  try {
    return { title: (await getArtist(id)).name };
  } catch {
    return { title: "Artist" };
  }
}

type Status = { album?: Album; logged: number; rating: number | null; queued: boolean };

export default async function ArtistPage({ params, searchParams }: { params: Params; searchParams: Promise<{ show?: string }> }) {
  const { slug } = await params;
  const { show } = await searchParams;
  const filter: Filter = show === "logged" || show === "not-yet" ? show : "all";
  const id = parseId(slug);
  if (!id) notFound();

  let artist;
  let discography: ArtistAlbum[] = [];
  try {
    [artist, discography] = await Promise.all([getArtist(id), getArtistAlbums(id)]);
  } catch {
    notFound();
  }
  const canonical = artistPath(artist.name, id)!;
  if (`/artist/${slug}` !== canonical) permanentRedirect(canonical + (filter !== "all" ? `?show=${filter}` : ""));

  const { supabase, user } = await getUser();
  const [entriesRes, queuedRes, catalogRes, exploreRes] = await Promise.all([
    supabase.from("entries").select("rating, listened_on, album:albums!inner(*)").eq("user_id", user!.id).eq("album.deezer_artist_id", id).order("listened_on", { ascending: false }),
    supabase.from("to_listen").select("album:albums!inner(deezer_id, title, deezer_artist_id)").eq("user_id", user!.id).eq("album.deezer_artist_id", id),
    supabase.from("albums").select("*").eq("deezer_artist_id", id),
    supabase.from("explore_artists").select("deezer_artist_id").eq("user_id", user!.id).eq("deezer_artist_id", id).maybeSingle(),
  ]);

  // Match by Deezer id, and by title so another edition of a record you logged counts too.
  const keyOf = (a: { deezer_id?: number | null; title: string }) => baseTitle(a.title);
  const status = new Map<string, Status>();
  const get = (k: string) => status.get(k) ?? { logged: 0, rating: null, queued: false };
  for (const a of (catalogRes.data ?? []) as Album[]) status.set(keyOf(a), { ...get(keyOf(a)), album: a });
  for (const e of (entriesRes.data ?? []) as unknown as { rating: number | null; album: Album }[]) {
    const s = get(keyOf(e.album));
    status.set(keyOf(e.album), { ...s, album: s.album ?? e.album, logged: s.logged + 1, rating: s.rating ?? e.rating });
  }
  for (const q of (queuedRes.data ?? []) as unknown as { album: { deezer_id: number; title: string } }[]) {
    const s = get(keyOf(q.album));
    status.set(keyOf(q.album), { ...s, queued: true });
  }

  const records = [...discography]
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .map((d) => ({ d, s: status.get(baseTitle(d.title)) ?? { logged: 0, rating: null, queued: false } }));
  const loggedCount = records.filter((r) => r.s.logged > 0).length;
  const shown = records.filter((r) => (filter === "logged" ? r.s.logged > 0 : filter === "not-yet" ? r.s.logged === 0 : true));
  const exploring = !exploreRes.error && !!exploreRes.data;
  const pct = records.length ? Math.round((loggedCount / records.length) * 100) : 0;

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: `All · ${records.length}` },
    { value: "logged", label: `Logged · ${loggedCount}` },
    { value: "not-yet", label: `Not yet · ${records.length - loggedCount}` },
  ];

  return (
    <div className="stack gap-28">
      <div className="artist-head">
        {artist.picture ? <img src={artist.picture} alt="" width={200} height={200} className="artist-photo" /> : null}
        <div className="stack gap-8" style={{ minWidth: 0 }}>
          <p className="eyebrow">Artist</p>
          <h1 className="title-xl" style={{ marginTop: 0 }}>{artist.name}</h1>
          <Suspense fallback={<BioPlaceholder />}>
            <Bio name={artist.name} />
          </Suspense>
        </div>
      </div>

      <div className="stack gap-12">
        <div className="stack gap-8" style={{ maxWidth: 420 }}>
          <p style={{ fontWeight: 700 }}>
            {loggedCount} of {records.length} {records.length === 1 ? "album" : "albums"} logged
            {loggedCount && loggedCount === records.length ? " — complete!" : ""}
          </p>
          <div className="bar" style={{ height: 10 }} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        </div>
        <form action={setExploring}>
          <input type="hidden" name="deezer_artist_id" value={id} />
          <input type="hidden" name="artist" value={artist.name} />
          <input type="hidden" name="on" value={exploring ? "0" : "1"} />
          <button type="submit" className="btn btn-sm pill" aria-pressed={exploring}>
            {exploring ? "✓ Exploring — suggestions in To listen" : "I want to hear more"}
          </button>
        </form>
      </div>

      <nav aria-label="Filter albums" className="row gap-8">
        {filters.map((f) => (
          <Link
            key={f.value}
            href={f.value === "all" ? canonical : `${canonical}?show=${f.value}`}
            className="btn btn-sm pill"
            aria-pressed={filter === f.value}
            aria-current={filter === f.value ? "page" : undefined}
            scroll={false}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {shown.length ? (
        <div className="grid-covers">
          {shown.map(({ d, s }) => {
            const inner = (
              <>
                <span className={`disc-cover${s.logged ? " logged" : ""}`}>
                  <img src={d.cover} alt="" className="cover cover-full" width={250} height={250} loading="lazy" />
                  {s.logged ? <span className="disc-badge" aria-hidden="true">✓</span> : null}
                </span>
                <span style={{ fontWeight: 700, lineHeight: 1.25 }}>{d.title}</span>
                <span className="muted" style={{ fontSize: 14 }}>{d.year ?? ""}</span>
                {s.logged ? (
                  <span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>
                    {s.rating ? `${stars(s.rating)} · ` : ""}Logged{s.logged > 1 ? ` ${s.logged}×` : ""}
                  </span>
                ) : s.queued ? (
                  <span className="mono muted" style={{ fontSize: 11 }}>In To listen</span>
                ) : (
                  <span className="mono muted" style={{ fontSize: 11 }}>Not logged yet</span>
                )}
              </>
            );
            return s.album ? (
              <Link key={d.deezerId} href={recordPath(s.album)} className="tile">{inner}</Link>
            ) : (
              <form key={d.deezerId} action={openFromDeezer} className="tile-form">
                <input type="hidden" name="deezer_id" value={d.deezerId} />
                <button type="submit" className="tile">{inner}</button>
              </form>
            );
          })}
        </div>
      ) : (
        <div className="card-dashed">
          <p className="muted">
            {filter === "logged" ? "You haven’t logged any of their albums yet." : filter === "not-yet" ? "You’ve logged every album — nice." : "No studio albums found on Deezer."}
          </p>
        </div>
      )}
      <p className="muted small">Studio albums from Deezer. Singles, EPs and compilations aren’t listed.</p>
    </div>
  );
}
