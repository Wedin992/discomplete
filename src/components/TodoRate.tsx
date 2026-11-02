"use client";
import { useState, useTransition } from "react";
import { rateEntry } from "@/app/actions";
import { StarInput } from "@/components/StarInput";

/** "Give these stars": the stars, right there — tap and it's saved. */
export function TodoRate({ entryId, title }: { entryId: string; title: string }) {
  const [value, setValue] = useState(0);
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();
  return (
    <span className="row gap-8" style={{ alignItems: "center", flexWrap: "nowrap" }}>
      <StarInput
        value={value}
        size="sm"
        disabled={pending}
        label={`Rate ${title}`}
        onChange={(v) => {
          setValue(v);
          start(async () => setState((await rateEntry(entryId, v)).status === "updated" ? "saved" : "error"));
        }}
      />
      <span className="mono small" style={{ color: state === "error" ? "var(--danger, #e5484d)" : "var(--accent)", minWidth: 48 }}>
        {pending ? "Saving…" : state === "saved" ? "✓ Saved" : state === "error" ? "Try again" : ""}
      </span>
    </span>
  );
}
