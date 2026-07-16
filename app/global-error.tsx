"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global render error:", error.message || error.digest, error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "40rem", margin: "0 auto" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ color: "#71717a", fontSize: "0.875rem", marginTop: "0.5rem" }}>
          An error occurred while rendering the app. In production, the exact message is hidden for security.
        </p>
        <p style={{ color: "#71717a", fontSize: "0.875rem", marginTop: "1rem" }}>
          If you just deployed or pulled schema changes, run:{" "}
          <code style={{ background: "#f4f4f5", padding: "0.125rem 0.375rem", borderRadius: "0.25rem" }}>
            npx prisma migrate deploy
          </code>{" "}
          then reload.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            background: "#18181b",
            color: "#fff",
            border: "none",
            borderRadius: "0.375rem",
            cursor: "pointer",
            fontSize: "0.875rem",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
