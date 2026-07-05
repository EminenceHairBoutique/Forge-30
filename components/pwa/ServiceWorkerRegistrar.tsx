"use client";

import { useEffect, useState } from "react";

/**
 * Registers the hand-rolled service worker (public/sw.js) in production and
 * surfaces updates (v3.3 §1.4): when a new worker is installed and waiting,
 * a quiet toast offers a refresh. The session is never reloaded without the
 * user tapping — mid-flow state is sacred.
 */
export function ServiceWorkerRegistrar() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    let disposed = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (disposed) return;
        // A worker may already be waiting from a previous visit.
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // "installed" with an active controller = an update, not the
            // first install.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              setWaiting(installing);
            }
          });
        });
      })
      .catch(() => {
        // Offline shell is an enhancement; the app still works without it.
      });
    return () => {
      disposed = true;
    };
  }, []);

  const refresh = () => {
    if (!waiting) return;
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true }
    );
    waiting.postMessage({ type: "SKIP_WAITING" });
    setWaiting(null);
  };

  if (!waiting) return null;
  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 pb-safe">
      <button
        type="button"
        onClick={refresh}
        className="min-h-11 rounded-full border border-line bg-elevated px-5 py-2.5 text-sm font-semibold text-ivory shadow-lg active:border-gold/50"
      >
        New version ready — tap to refresh
      </button>
    </div>
  );
}
