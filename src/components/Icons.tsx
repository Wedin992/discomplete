export function LogoMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <circle cx="15" cy="15" r="13" stroke="currentColor" strokeWidth="1.6" strokeDasharray="68 13.7" transform="rotate(-60 15 15)" />
      <circle cx="15" cy="15" r="8" stroke="#55555A" strokeWidth="1" />
      <circle cx="15" cy="15" r="3.4" fill="var(--accent)" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6" stroke="#A3A09A" strokeWidth="1.8" />
      <path d="M13.5 13.5L18 18" stroke="#A3A09A" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M7 4l5 5-5 5" stroke="#A3A09A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function VisibilityIcon({ isPrivate, isAnonymous }: { isPrivate: boolean; isAnonymous: boolean }) {
  if (isPrivate)
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  if (isAnonymous)
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="6" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2.5 14c.8-2.6 3-4 5.5-4s4.7 1.4 5.5 4M2 2l12 12" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 8h12M8 2c1.8 2 1.8 10 0 12M8 2c-1.8 2-1.8 10 0 12" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function ListViewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="1.5" y="2" width="3" height="3" rx="0.6" />
      <rect x="1.5" y="6.5" width="3" height="3" rx="0.6" />
      <rect x="1.5" y="11" width="3" height="3" rx="0.6" />
      <path d="M7 3.5h7.5M7 8h7.5M7 12.5h7.5" />
    </svg>
  );
}

/** A month calendar of covers. */
export function CalendarViewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" />
      <path d="M1.5 6h13M5 1v3M11 1v3" strokeLinecap="round" />
      <rect x="4" y="8.5" width="2.5" height="2.5" fill="currentColor" stroke="none" />
      <rect x="9.5" y="8.5" width="2.5" height="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A wall of record sleeves. */
export function ShelfViewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="0.8" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="0.8" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="0.8" />
      <circle cx="11.75" cy="11.75" r="2.75" />
      <circle cx="11.75" cy="11.75" r="0.6" fill="currentColor" />
    </svg>
  );
}
