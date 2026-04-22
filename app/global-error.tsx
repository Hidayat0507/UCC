"use client";

import { useEffect } from "react";

/**
 * Root-level error fallback. This is the last resort — it renders a full
 * document because the root layout itself may have failed.
 *
 * Keep this dependency-free (no shadcn, no theme provider) so it always works.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          margin: 0,
          padding: "2rem",
          backgroundColor: "#f9fafb",
          color: "#111827",
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            Application error
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1rem" }}>
            {error.message ||
              "A critical error occurred. Please refresh the page or contact support if the issue persists."}
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#9ca3af", marginBottom: "1rem" }}>
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.375rem",
                border: "none",
                background: "#111827",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.375rem",
                border: "1px solid #d1d5db",
                background: "#fff",
                color: "#374151",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Refresh
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
