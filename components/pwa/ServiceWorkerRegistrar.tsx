"use client";

import { useEffect } from "react";

/** Registers the hand-rolled service worker (public/sw.js) in production. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Offline shell is an enhancement; the app still works without it.
    });
  }, []);

  return null;
}
