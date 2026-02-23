"use client";

import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const refreshGuestSession = () =>
  fetch("/api/session/refresh", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  }).catch(() => undefined);

export default function GuestSessionHeartbeat() {
  useEffect(() => {
    refreshGuestSession();

    const intervalId = window.setInterval(() => {
      refreshGuestSession();
    }, REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
