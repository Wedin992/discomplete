"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { openLogSheet } from "@/components/LogSheet";

const LINKS = [
  { href: "/", label: "Diary" },
  { href: "/discover", label: "Discover" },
  { href: "/records", label: "Records" },
  { href: "/to-listen", label: "To listen" },
  { href: "/settings", label: "Settings" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

/** The path being navigated to (highlighted the moment it is tapped), else the current one. */
function useActivePath() {
  const path = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  useEffect(() => setPending(null), [path]);
  return { active: pending ?? path, go: (href: string) => setPending(href) };
}

/** Top navigation, shown on wider screens. */
export function Nav() {
  const { active, go } = useActivePath();
  return (
    <nav className="nav" aria-label="Main">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} prefetch={l.href === "/discover" ? undefined : true} onClick={() => go(l.href)} aria-current={isActive(active, l.href) ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

const stroke = { stroke: "currentColor", strokeWidth: 1.8, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const TAB_ICONS: Record<string, React.ReactNode> = {
  "/": (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3.5" width="14" height="17" rx="2" {...stroke} /><path d="M9 8h6M9 12h6M9 16h3" {...stroke} /></svg>
  ),
  "/records": (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...stroke} /><circle cx="12" cy="12" r="2.5" {...stroke} /></svg>
  ),
  "/to-listen": (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16l-5-3.5L7 20z" {...stroke} /></svg>
  ),
  "/discover": (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="M15.5 8.5l-2 5-5 2 2-5z" {...stroke} /></svg>
  ),
};

/** Bottom tab bar, shown on phones. */
export function TabBar() {
  const { active: path, go } = useActivePath();
  const current = usePathname();
  if (current.startsWith("/welcome")) return null; // keep the sign-up quiz focused
  const tabs = [LINKS[0], LINKS[1], { href: "/log", label: "Log" }, LINKS[3], LINKS[2]];
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => {
        const active = isActive(path, t.href);
        if (t.href === "/log")
          return (
            <Link key={t.href} href="/log" prefetch={false} onClick={(e) => { e.preventDefault(); openLogSheet(); }} className="tab tab-log" aria-current={active ? "page" : undefined}>
              <span className="tab-log-btn" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
              </span>
              <span>Log a listen</span>
            </Link>
          );
        return (
          <Link key={t.href} href={t.href} prefetch={t.href === "/discover" ? undefined : true} onClick={() => go(t.href)} className="tab" aria-current={active ? "page" : undefined}>
            {TAB_ICONS[t.href]}
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Settings shortcut in the header on phones (the tab bar has no room for it). */
export function SettingsLink() {
  const path = usePathname();
  return (
    <Link href="/settings" className="header-settings" aria-label="Settings" aria-current={path.startsWith("/settings") ? "page" : undefined}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5" {...stroke} /><path d="M5 20c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5" {...stroke} /></svg>
    </Link>
  );
}

/** "Log a listen" button in the header (wider screens): opens the search sheet. */
export function HeaderLogButton({ children }: { children: React.ReactNode }) {
  return (
    <Link href="/log" prefetch={false} className="btn btn-primary header-log" onClick={(e) => { e.preventDefault(); openLogSheet(); }}>
      {children}
    </Link>
  );
}
