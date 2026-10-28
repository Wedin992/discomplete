import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GENRES, GENRES_ENABLED, genreFromSlug } from "@/lib/genre";
import { ThreePicks, ThreeSkeleton } from "../../ThreePicks";
import { GenrePicker } from "../../GenrePicker";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const genre = genreFromSlug((await params).slug);
  return { title: genre ? `${genre.name} · Discover` : "Discover" };
}

export default async function GenrePage({ params }: { params: Params }) {
  const genre = GENRES_ENABLED ? genreFromSlug((await params).slug) : null;
  if (!genre) notFound();

  return (
    <section className="stack gap-28">
      <div>
        <Link href="/discover" className="btn-text small" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>← Discover</Link>
        <p className="eyebrow" style={{ marginTop: 8 }}>Three in</p>
        <h1 className="title-xl">{genre.name}</h1>
        <p className="muted" style={{ marginTop: 8 }}>A safe bet close to your taste, a classic you haven’t logged, and a lesser-known wildcard.</p>
      </div>
      <Suspense fallback={<ThreeSkeleton />}>
        <ThreePicks scope={`genre:${genre.slug}`} source="three" />
      </Suspense>
      <section className="stack gap-16" aria-labelledby="other-genres">
        <h2 id="other-genres" className="title-m" style={{ margin: 0 }}>Other genres</h2>
        <GenrePicker genres={GENRES.map(({ slug, name }) => ({ slug, name }))} current={genre.slug} />
      </section>
      <p className="muted small">Genre catalogue from Wikidata.</p>
    </section>
  );
}
