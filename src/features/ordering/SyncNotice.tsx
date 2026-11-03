"use client";

import { Button } from "@/ui/Button";
import type { SyncProblem } from "./useDraftSync";

/** Says when the draft could not be saved; a stale draft must be reloaded before confirming. */
export function SyncNotice({ problem }: { problem: SyncProblem }) {
  if (!problem) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warn bg-warn-soft px-3.5 py-2.5">
      <p className="font-semibold text-warn">{problem.message}</p>
      {problem.stale ? <Button onClick={() => window.location.reload()}>Load the latest order</Button> : null}
    </div>
  );
}
