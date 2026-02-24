"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type PendingNavigation = {
  from: string;
  to: string;
  startedAt: number;
  trigger: "link_click";
};

type NavigationPerfPayload = {
  from: string;
  to: string;
  durationMs: number;
  trigger: "link_click";
};

const STORAGE_KEY = "mp_pending_navigation_perf";

const buildPath = (pathname: string, searchParams: URLSearchParams) => {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
};

const readPendingNavigation = (): PendingNavigation | null => {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PendingNavigation;
    if (
      typeof parsed?.from !== "string" ||
      typeof parsed?.to !== "string" ||
      typeof parsed?.startedAt !== "number" ||
      parsed.trigger !== "link_click"
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const writePendingNavigation = (payload: PendingNavigation) => {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore browsers where sessionStorage is unavailable.
  }
};

const clearPendingNavigation = () => {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore browsers where sessionStorage is unavailable.
  }
};

const reportNavigationPerf = (payload: NavigationPerfPayload) => {
  const body = JSON.stringify(payload);
  const endpoint = "/api/perf/nav";

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(endpoint, blob);
    return;
  }

  void fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    cache: "no-store",
    body,
  }).catch(() => undefined);
};

const isEligibleLinkClick = (event: MouseEvent) => {
  if (event.defaultPrevented) {
    return false;
  }
  if (event.button !== 0) {
    return false;
  }
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  return true;
};

export default function NavigationPerfLogger() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPathRef = useRef<string>(buildPath(pathname, searchParams));

  useEffect(() => {
    const clickListener = (event: MouseEvent) => {
      if (!isEligibleLinkClick(event)) {
        return;
      }

      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") {
        return;
      }
      if (anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) {
        return;
      }

      const to = `${destination.pathname}${destination.search}`;
      const from = currentPathRef.current;
      if (to === from) {
        return;
      }

      writePendingNavigation({
        from,
        to,
        startedAt: performance.now(),
        trigger: "link_click",
      });
    };

    window.addEventListener("click", clickListener, true);
    return () => {
      window.removeEventListener("click", clickListener, true);
    };
  }, []);

  useEffect(() => {
    const currentPath = buildPath(pathname, searchParams);
    const pending = readPendingNavigation();

    if (pending && pending.to === currentPath) {
      reportNavigationPerf({
        from: pending.from,
        to: pending.to,
        durationMs: Math.max(0, Math.round(performance.now() - pending.startedAt)),
        trigger: pending.trigger,
      });
      clearPendingNavigation();
    }

    currentPathRef.current = currentPath;
  }, [pathname, searchParams]);

  return null;
}
