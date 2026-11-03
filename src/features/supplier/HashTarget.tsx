"use client";

import { useEffect } from "react";

/**
 * Scrolls to the item a link points at, such as /supplier/orders#order-1066. The page shows the order
 * once as a table row on a laptop and once as a card on a phone, so the target is the visible element
 * with a matching data-anchor, which then gets data-hit for its highlight.
 */
export function HashTarget() {
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const target = Array.from(document.querySelectorAll<HTMLElement>("[data-anchor]")).find(
      (element) => element.dataset.anchor === id && element.getClientRects().length > 0,
    );
    if (!target) return;
    target.dataset.hit = "true";
    target.scrollIntoView({ block: "center" });
  }, []);
  return null;
}
