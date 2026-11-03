"use client";

type Props = { error: Error & { digest?: string }; reset: () => void };

export default function GlobalError({ error, reset }: Props) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <h1>Something went wrong</h1>
        <p>
          Try again. If it keeps happening, contact support with code {error.digest ?? "unknown"}.
        </p>
        <button type="button" onClick={reset}>
          Try again
        </button>
      </body>
    </html>
  );
}
