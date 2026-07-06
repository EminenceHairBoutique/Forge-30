"use client";

import { useEffect } from "react";

/**
 * Root error boundary (v3.3 §1.10) — catches failures in the root layout
 * itself, so it must render its own <html>/<body> and can't rely on the
 * design system's providers. Styles are inlined for the same reason.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#0b0806",
          color: "#fff4e4",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <p style={{ fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "#b3a18a" }}>
          Something interrupted the app
        </p>
        <p style={{ maxWidth: 320, fontSize: 14, lineHeight: 1.6 }}>
          Your data is safe on this device — the app hit an error while starting up.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            minHeight: 44,
            padding: "0 24px",
            borderRadius: 12,
            border: "1px solid #ffb13d",
            background: "transparent",
            color: "#ffb13d",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          Reload the app
        </button>
      </body>
    </html>
  );
}
