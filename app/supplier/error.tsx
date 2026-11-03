"use client";

import { Button } from "@/ui/Button";
import { LinkButton } from "@/ui/LinkButton";
import { Panel } from "@/ui/Panel";

type Props = { error: unknown; retry: () => void };

function codeOf(error: unknown): string {
  if (error instanceof Error && "digest" in error && typeof error.digest === "string") return error.digest;
  return "unknown";
}

/** Unexpected errors on supplier pages (SH-06). The digest is the code that matches the server logs. */
export default function SupplierError({ error, retry }: Props) {
  return (
    <Panel title="This page did not load">
      <p role="alert">
        Something went wrong. Try again. If it keeps happening, contact support with code{" "}
        <span className="font-mono">{codeOf(error)}</span>.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Button variant="primary" onClick={() => retry()}>
          Try again
        </Button>
        <LinkButton href="/supplier">Home</LinkButton>
      </div>
    </Panel>
  );
}
