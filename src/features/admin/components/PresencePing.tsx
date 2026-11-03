"use client";

import { useEffect } from "react";
import { touchLastSeenAction } from "../actions";

const EVERY_MS = 60_000;

/** Keeps the signed-in admin's last_seen_at fresh while a page is open and visible (ADM-16). */
export function PresencePing() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible") void touchLastSeenAction().catch(() => undefined);
    };
    ping();
    const timer = window.setInterval(ping, EVERY_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);
  return null;
}
