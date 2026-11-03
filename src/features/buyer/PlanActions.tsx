"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/ui/Button";
import { useToast } from "@/ui/Toast";
import { loadRestockPlanAction, skipRestockPlanAction } from "./home-actions";

/** "Review and send" and "Not today" on Ready for tomorrow (BUY-08). */
export function PlanActions() {
  const router = useRouter();
  const { show } = useToast();
  const [busy, start] = useTransition();

  const review = () =>
    start(async () => {
      const result = await loadRestockPlanAction();
      if (result.ok) router.push("/buyer/order");
      else show(result.error);
    });

  const skip = () =>
    start(async () => {
      const result = await skipRestockPlanAction();
      show(result.ok ? "Skipped for today." : result.error);
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" disabled={busy} onClick={review}>
        Review and send
      </Button>
      <Button disabled={busy} onClick={skip}>
        Not today
      </Button>
    </div>
  );
}
