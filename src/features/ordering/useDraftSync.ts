"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveDraftAction } from "./actions";
import type { DraftLine } from "./draft";

const SAVE_DELAY_MS = 400;

export type SyncProblem = { message: string; stale: boolean } | null;

/**
 * Saves the review to order_drafts with an optimistic version. Changes are coalesced: only the
 * latest lines are sent, one save at a time. A version clash (another tab or device saved first)
 * is reported as stale and saving stops until the page is reloaded.
 */
export function useDraftSync(initialVersion: number) {
  const version = useRef(initialVersion);
  const pending = useRef<DraftLine[] | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(false);
  const [problem, setProblem] = useState<SyncProblem>(null);

  const drain = useCallback(async () => {
    while (pending.current && !stopped.current) {
      const lines = pending.current;
      pending.current = null;
      const result = await saveDraftAction(lines, version.current);
      if (result.ok) {
        version.current = result.data.version;
        setProblem(null);
      } else {
        const stale = result.reason === "STALE_DRAFT";
        stopped.current = stale;
        setProblem({ message: result.error, stale });
      }
    }
  }, []);

  const flush = useCallback((): Promise<void> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!running.current) {
      running.current = drain().finally(() => {
        running.current = null;
      });
    }
    return running.current;
  }, [drain]);

  const save = useCallback(
    (lines: DraftLine[]) => {
      pending.current = lines;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  /** Resolves once every change so far has been saved (or saving has failed). */
  const whenSaved = useCallback(async () => {
    while (timer.current || running.current || (pending.current && !stopped.current)) await flush();
  }, [flush]);

  const currentVersion = useCallback(() => version.current, []);

  useEffect(
    () => () => {
      if (timer.current || pending.current) void flush();
    },
    [flush],
  );

  return { save, whenSaved, currentVersion, problem };
}
