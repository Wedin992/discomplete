"use client";
import { useFormStatus } from "react-dom";

/** A submit button that shows it's working while its form's server action runs. */
export function PendingButton({ children, pending, className, disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending: string }) {
  const status = useFormStatus();
  return (
    <button type="submit" className={className} disabled={disabled || status.pending} aria-busy={status.pending} {...rest}>
      {status.pending ? pending : children}
    </button>
  );
}
