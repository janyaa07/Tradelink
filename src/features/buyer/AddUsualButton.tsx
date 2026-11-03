"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/ui/Button";
import { Icon } from "@/ui/Icon";
import { useToast } from "@/ui/Toast";
import { loadUsualAction } from "./home-actions";

/** "Add my usual": every usual item goes into the cart, then the cart opens with them (BUY-12). */
export function AddUsualButton() {
  const router = useRouter();
  const { show } = useToast();
  const [busy, start] = useTransition();
  return (
    <Button
      disabled={busy}
      onClick={() =>
        start(async () => {
          const result = await loadUsualAction();
          if (!result.ok) return show(result.error);
          router.push("/buyer/cart");
          router.refresh();
        })
      }
    >
      <Icon name="repeat" size={16} />
      {busy ? "Adding..." : "Add my usual"}
    </Button>
  );
}
