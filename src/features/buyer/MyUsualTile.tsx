"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ServiceTile } from "@/ui/ServiceGrid";
import { useToast } from "@/ui/Toast";
import { loadUsualAction } from "./home-actions";

/** "My usual" on the home: adds every usual item to the cart, then opens it (BUY-01, BUY-12). */
export function MyUsualTile() {
  const router = useRouter();
  const { show } = useToast();
  const [busy, start] = useTransition();
  return (
    <ServiceTile
      label="My usual"
      icon="repeat"
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={() =>
        start(async () => {
          const result = await loadUsualAction();
          if (result.ok) router.push("/buyer/cart");
          else show(result.error);
        })
      }
    />
  );
}
