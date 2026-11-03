"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/ui/Button";
import { useToast } from "@/ui/Toast";
import { loadReorderPlanAction, skipReorderPlanAction } from "./home-actions";

/** "Add to cart" and "Not today" on Ready for tomorrow (BUY-08). */
export function PlanActions() {
  const router = useRouter();
  const { show } = useToast();
  const [busy, start] = useTransition();

  const addToCart = () =>
    start(async () => {
      const result = await loadReorderPlanAction();
      if (result.ok) router.push("/buyer/cart");
      else show(result.error);
    });

  const skip = () =>
    start(async () => {
      const result = await skipReorderPlanAction();
      show(result.ok ? "Skipped for today." : result.error);
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" disabled={busy} onClick={addToCart}>
        Add to cart
      </Button>
      <Button disabled={busy} onClick={skip}>
        Not today
      </Button>
    </div>
  );
}
