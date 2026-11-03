"use client";

import { Button } from "@/ui/Button";
import { LinkButton } from "@/ui/LinkButton";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

/** An unexpected error on an admin page (SH-06). The digest matches the server log entry. */
export default function AdminError({ error, reset }: Props) {
  const code = error.digest ?? "unknown";
  return (
    <section role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-card">
      <h1>This page did not load</h1>
      <p>
        Something went wrong. Try again. If it keeps happening, contact support with code{" "}
        <span className="font-mono">{code}</span>.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <LinkButton href="/admin">Back to home</LinkButton>
      </div>
    </section>
  );
}
