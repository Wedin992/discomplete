"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { slugify } from "@/lib/format";

/** Quick genre chips, filtered as you type; Enter goes to any genre you typed. */
export function GenrePicker({ genres, current }: { genres: { slug: string; name: string }[]; current?: string }) {
  const [q, setQ] = useState("");
  const router = useRouter();
  const needle = q.trim().toLowerCase();
  const shown = needle ? genres.filter((g) => g.name.toLowerCase().includes(needle)) : genres;
  const typedSlug = slugify(q);
  const exact = shown.some((g) => g.slug === typedSlug);

  return (
    <div className="stack gap-12">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const target = shown.length === 1 ? shown[0].slug : typedSlug;
          if (target.length >= 2) router.push(`/discover/genre/${target}`);
        }}
      >
        <label htmlFor="genre-q" className="sr-only">Find a genre</label>
        <input
          id="genre-q"
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a genre — e.g. progressive rock"
          autoComplete="off"
          enterKeyHint="go"
          maxLength={40}
        />
      </form>
      <div className="row gap-8 genre-chips">
        {shown.map((g) => (
          <Link key={g.slug} href={`/discover/genre/${g.slug}`} className="btn btn-sm pill" aria-pressed={g.slug === current} prefetch={false}>
            {g.name}
          </Link>
        ))}
        {needle.length >= 2 && !exact ? (
          <Link href={`/discover/genre/${typedSlug}`} className="btn btn-sm" prefetch={false}>
            Try “{q.trim()}” →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
