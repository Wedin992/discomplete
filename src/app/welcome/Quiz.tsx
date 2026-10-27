"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { completeOnboarding, skipOnboarding } from "@/app/actions";
import { SearchIcon } from "@/components/Icons";

type Artist = { id: number; name: string; picture?: string };

const GOALS = [
  { value: "diary", title: "Keep a music diary", text: "Remember what you listened to and how it felt." },
  { value: "discover", title: "Find new music", text: "Get picks based on what you love." },
  { value: "collection", title: "Track my collection", text: "Keep tabs on your vinyl and CDs." },
];

function FinishButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
      {pending ? "Saving…" : label}
    </button>
  );
}

type Props = { name: string | null; initialGoals: string[]; initialArtists: Artist[]; retaking: boolean };

export function Quiz({ name, initialGoals, initialArtists, retaking }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [goals, setGoals] = useState<string[]>(initialGoals);
  const [picked, setPicked] = useState<Artist[]>(initialArtists);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Artist[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setStatus("idle");
      return;
    }
    const id = ++reqId.current;
    setStatus("loading");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/artists?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (id !== reqId.current) return;
        if (!res.ok) throw new Error();
        setHits(json.artists ?? []);
        setStatus("idle");
      } catch {
        if (id === reqId.current) setStatus("error");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const toggleGoal = (g: string) => setGoals((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  const pick = (a: Artist) => {
    setPicked((cur) => (cur.some((x) => x.id === a.id) ? cur : [...cur, a]));
    setQuery("");
    setHits([]);
  };
  const unpick = (id: number) => setPicked((cur) => cur.filter((x) => x.id !== id));

  return (
    <section className="stack gap-28 narrow" style={{ maxWidth: 640 }}>
      <div>
        <p className="eyebrow">Step {step} of 2</p>
        <h1 className="title-xl">
          {step === 1 ? (name ? `Welcome, ${name}` : "Welcome") : "Artists you love"}
        </h1>
        <p className="muted" style={{ marginTop: 8, fontSize: 18 }}>
          {step === 1 ? "What do you want to use Discomplete for? Pick as many as you like." : "Pick a few — at least three gives the best picks. You can change them later."}
        </p>
      </div>

      {step === 1 ? (
        <>
          <div className="stack gap-12" role="group" aria-label="What you want to use Discomplete for">
            {GOALS.map((g) => {
              const on = goals.includes(g.value);
              return (
                <button key={g.value} type="button" className={`goal${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleGoal(g.value)}>
                  <span className="goal-check" aria-hidden="true">{on ? "✓" : ""}</span>
                  <span className="stack">
                    <span style={{ fontWeight: 700, fontSize: 17 }}>{g.title}</span>
                    <span className="muted" style={{ fontSize: 15 }}>{g.text}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="row gap-16">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setStep(2)}>Next</button>
            <SkipLink retaking={retaking} />
          </div>
        </>
      ) : (
        <form action={completeOnboarding} className="stack gap-20">
          {goals.map((g) => <input key={g} type="hidden" name="goals" value={g} />)}
          <input type="hidden" name="artists" value={JSON.stringify(picked)} />

          <div className="field">
            <label htmlFor="artist-search" className="sr-only">Search for an artist</label>
            <div className="search-box">
              <SearchIcon />
              <input
                id="artist-search"
                type="search"
                autoComplete="off"
                placeholder="Search for an artist"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (hits[0]) pick(hits[0]); } }}
              />
            </div>
            <p className="muted small" aria-live="polite" style={{ minHeight: 20 }}>
              {status === "loading" ? "Searching…" : status === "error" ? "Search is unavailable right now." : ""}
            </p>
          </div>

          {hits.length ? (
            <div className="stack gap-8">
              {hits.filter((h) => !picked.some((p) => p.id === h.id)).map((h) => (
                <button key={h.id} type="button" className="result" onClick={() => pick(h)}>
                  {h.picture ? <img src={h.picture} alt="" width={44} height={44} className="cover cover-44" style={{ borderRadius: "50%" }} /> : null}
                  <span className="result-text"><span style={{ fontWeight: 700 }}>{h.name}</span></span>
                  <span className="chip">+ Add</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="stack gap-8">
            <p className="eyebrow">{picked.length ? `Your picks · ${picked.length}` : "No artists picked yet"}</p>
            {picked.length ? (
              <div className="row gap-8">
                {picked.map((a) => (
                  <button key={a.id} type="button" className="artist-chip" onClick={() => unpick(a.id)} aria-label={`Remove ${a.name}`}>
                    {a.picture ? <img src={a.picture} alt="" width={28} height={28} /> : null}
                    <span>{a.name}</span>
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="row gap-16">
            <FinishButton label={picked.length ? "Done" : "Finish without artists"} />
            <button type="button" className="btn-text" onClick={() => setStep(1)}>Back</button>
          </div>
        </form>
      )}
    </section>
  );
}

function SkipLink({ retaking }: { retaking: boolean }) {
  if (retaking)
    return <Link href="/settings" className="btn-text" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Cancel</Link>;
  return (
    <form action={skipOnboarding}>
      <button type="submit" className="btn-text">Skip for now</button>
    </form>
  );
}
