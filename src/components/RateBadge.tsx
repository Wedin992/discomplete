"use client";
import { useState, useTransition } from "react";
import { rateEntry } from "@/app/actions";
import { StarInput } from "@/components/StarInput";

/** On a diary entry without stars: a small "Rate it" badge that opens the stars right there. */
export function RateBadge({ entryId, title }: { entryId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(0);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  if (state === "saved") return <span className="small" style={{ color: "var(--accent)" }}>✓ Rated</span>;
  if (!open)
    return (
      <button type="button" className="badge-todo" onClick={() => setOpen(true)} aria-label={`Rate ${title}`}>
        ☆ Not rated · Rate it
      </button>
    );
  return (
    <span className="row gap-8" style={{ alignItems: "center" }}>
      <StarInput
        value={value}
        size="sm"
        disabled={pending}
        label={`Rate ${title}`}
        onChange={(v) => {
          setValue(v);
          start(async () => {
            const res = await rateEntry(entryId, v);
            setState(res.status === "updated" ? "saved" : "error");
          });
        }}
      />
      {state === "error" ? <span className="error small">Couldn’t save</span> : null}
    </span>
  );
}
