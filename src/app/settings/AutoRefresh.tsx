"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-checks the page every `every` seconds for a few minutes (e.g. while waiting for the first song to show up). */
export function AutoRefresh({ every = 20, times = 12 }: { every?: number; times?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (++n > times) return clearInterval(id);
      router.refresh();
    }, every * 1000);
    return () => clearInterval(id);
  }, [router, every, times]);
  return null;
}
