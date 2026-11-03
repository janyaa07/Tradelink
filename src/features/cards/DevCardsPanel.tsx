"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/errors";
import { Button } from "@/ui/Button";
import { FormError } from "@/ui/FormError";
import { Panel } from "@/ui/Panel";
import { useToast } from "@/ui/Toast";
import { createDemoNoticeCardAction, createDemoOrderCardAction, createDemoQuestionCardAction } from "./dev-actions";

type Demo = { id: string; label: string; done: string; run: () => Promise<ActionResult<{ cardId: string }>> };

const DEMOS: Demo[] = [
  { id: "order", label: "Create demo order", done: "Order summary card added.", run: createDemoOrderCardAction },
  { id: "notice", label: "Create agent notice", done: "Notice card added.", run: createDemoNoticeCardAction },
  { id: "question", label: "Create question", done: "Question card added.", run: createDemoQuestionCardAction },
];

/** Buttons that make test cards in the shop chat (dev only). */
export function DevCardsPanel() {
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const run = (demo: Demo) => {
    setError(null);
    setRunning(demo.id);
    startTransition(async () => {
      const result = await demo.run();
      setRunning(null);
      if (result.ok) toast.show(demo.done);
      else setError(result.error);
    });
  };

  return (
    <Panel title="Test cards">
      <p className="text-[.88rem] text-muted">
        Each button writes real rows for your shop through the database functions, then renders a card into the shop chat below.
      </p>
      <div className="flex flex-wrap gap-2">
        {DEMOS.map((demo) => (
          <Button key={demo.id} variant={demo.id === "order" ? "primary" : "default"} disabled={running !== null} onClick={() => run(demo)}>
            {running === demo.id ? "Working…" : demo.label}
          </Button>
        ))}
      </div>
      <FormError>{error}</FormError>
    </Panel>
  );
}
