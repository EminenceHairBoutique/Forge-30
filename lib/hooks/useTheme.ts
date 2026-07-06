"use client";

import { useCallback, useEffect, useState } from "react";
import { useStorage } from "@/lib/storage/provider";
import type { UiTheme } from "@/lib/types";

/** Hull background per theme — kept in sync with globals.css --bg-base. */
const THEME_COLOR: Record<UiTheme, string> = {
  dark: "#0a0818",
  light: "#dcddef",
};

/**
 * UI theme control (Starship S0). Dark is the default; the pre-hydration
 * script in the root layout has already applied the stored value to
 * <html data-theme> before React mounts, so this hook only reconciles state
 * and handles user toggles. Writes through the StorageAdapter (never
 * localStorage directly) and repaints the <meta name=theme-color>.
 */
export function useTheme() {
  const { adapter } = useStorage();
  const [theme, setThemeState] = useState<UiTheme>("dark");

  useEffect(() => {
    const current =
      typeof document !== "undefined" && document.documentElement.dataset.theme === "light"
        ? "light"
        : "dark";
    setThemeState(current);
    // Reconcile against storage in case the boot script and adapter disagree.
    void adapter.getTheme().then((stored) => setThemeState(stored));
  }, [adapter]);

  const apply = useCallback((next: UiTheme) => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next;
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", THEME_COLOR[next]);
    }
  }, []);

  const setTheme = useCallback(
    (next: UiTheme) => {
      setThemeState(next);
      apply(next);
      void adapter.saveTheme(next);
    },
    [adapter, apply]
  );

  const toggle = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  return { theme, setTheme, toggle };
}
