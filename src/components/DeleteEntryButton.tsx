"use client";

import { deleteEntry } from "@/app/actions";

type Props = { id: string; title: string; label?: string; redirectTo?: string };

export function DeleteEntryButton({ id, title, label = "Delete", redirectTo }: Props) {
  return (
    <form
      action={deleteEntry}
      onSubmit={(e) => {
        if (!window.confirm(`Delete this entry about ${title}? This can’t be undone.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      {redirectTo ? <input type="hidden" name="redirect_to" value={redirectTo} /> : null}
      <button type="submit" className="btn-text small" style={{ minHeight: 32 }} aria-label={`Delete this entry about ${title}`}>
        {label}
      </button>
    </form>
  );
}
