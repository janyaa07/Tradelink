import "server-only";
import type { CatalogueItem } from "@/domain/catalogue";
import type { AiCard, AiOrder } from "@/domain/ask/types";
import { toCents } from "@/domain/money";
import type { OrderView } from "@/features/orders/queries";
import { orderNumber } from "@/ui/format";

/** Short keys the answer writes as tags, such as [[P2]]; one sequence per prefix per answer. */
export function cardKeys(): (prefix: string) => string {
  const counts = new Map<string, number>();
  return (prefix) => {
    const next = (counts.get(prefix) ?? 0) + 1;
    counts.set(prefix, next);
    return `${prefix}${next}`;
  };
}

/** The tag the model copies into its answer to show a card. */
export const tag = (card: AiCard) => `[[${card.key}]]`;

export function orderCard(order: OrderView, view: "buyer" | "supplier"): AiCard {
  const data: AiOrder = {
    id: order.id,
    number: order.number,
    status: order.status,
    checkStatus: order.checkStatus,
    counterparty: view === "buyer" ? order.supplier.name : order.buyer.name,
    deliveryDate: order.confirmedDeliveryDate ?? order.requestedDeliveryDate,
    placedAt: order.createdAt,
    lines: order.lines.map((line) => ({ qty: line.qty, name: line.name, unit: line.unit, productId: line.productId })),
    totalCents: order.totalCents,
  };
  return { kind: "ai_order", key: orderNumber(order.number), view, order: data };
}

export function productCard(item: CatalogueItem, inCart: number, key: string): AiCard {
  return {
    kind: "ai_product",
    key,
    product: {
      id: item.id,
      name: item.name,
      unit: item.unit,
      priceCents: toCents(item.price),
      supplier: item.supplierName,
      available: item.status === "unconfirmed" ? null : item.available,
      art: item.art,
      category: item.category,
      inCart,
    },
  };
}

export function stockCard(item: CatalogueItem, key: string): AiCard {
  return {
    kind: "ai_stock",
    key,
    stock: {
      id: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      priceCents: toCents(item.price),
      onHand: item.onHand,
      reserved: item.reserved,
      available: item.available,
      reorderLevel: item.reorderLevel,
      health: item.health,
    },
  };
}
