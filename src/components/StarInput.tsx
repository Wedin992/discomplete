"use client";
import { ratingText } from "@/lib/format";

/**
 * Five stars you can tap in halves: the left half of a star gives ½, the right half a whole one.
 * `clearable`: tapping the current value again clears it.
 */
export function StarInput({
  value,
  onChange,
  size = "md",
  disabled = false,
  clearable = false,
  label = "Rating",
}: {
  value: number;
  onChange: (v: number) => void;
  size?: "lg" | "md" | "sm";
  disabled?: boolean;
  clearable?: boolean;
  label?: string;
}) {
  const pick = (v: number) => onChange(clearable && v === value ? 0 : v);
  return (
    <div className={`star-input si-${size}`} role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`si-star${value >= n ? " on" : value >= n - 0.5 ? " half" : ""}`} aria-hidden="false">
          <span aria-hidden="true">★</span>
          <button type="button" className="si-hit si-left" disabled={disabled} aria-label={`${ratingText(n - 0.5)} stars`} aria-pressed={value === n - 0.5} onClick={() => pick(n - 0.5)} />
          <button type="button" className="si-hit si-right" disabled={disabled} aria-label={`${ratingText(n)} ${n === 1 ? "star" : "stars"}`} aria-pressed={value === n} onClick={() => pick(n)} />
        </span>
      ))}
    </div>
  );
}
