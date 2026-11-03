export const UNITS = ["bag", "bottle", "box", "can", "carton", "pack", "packet", "tin", "tray", "tub"] as const;
export type Unit = (typeof UNITS)[number];

export const CATEGORIES = ["fresh", "dry_goods", "oils_sauces", "supplies"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  fresh: "Fresh",
  dry_goods: "Dry goods",
  oils_sauces: "Oils and sauces",
  supplies: "Supplies",
};

export const ART_KINDS = ["egg", "sack", "bottle", "tin", "packet", "box", "tub", "block", "leaf", "soap"] as const;
export type ArtKind = (typeof ART_KINDS)[number];

export type Health = "healthy" | "low" | "out" | "unconfirmed";

/** A product as a buyer or supplier sees it, read from the v_catalogue view. */
export type CatalogueItem = {
  id: string;
  supplierOrgId: string;
  supplierName: string;
  sku: string;
  name: string;
  unit: Unit;
  /** Decimal string, for example "52.00". */
  price: string;
  category: Category;
  art: ArtKind;
  packKg: number | null;
  reorderLevel: number;
  aliases: string[];
  status: "active" | "unconfirmed";
  onHand: number;
  reserved: number;
  available: number;
  health: Health;
};

export function healthOf(item: Pick<CatalogueItem, "status" | "available" | "reorderLevel">): Health {
  if (item.status === "unconfirmed") return "unconfirmed";
  if (item.available <= 0) return "out";
  if (item.available <= item.reorderLevel) return "low";
  return "healthy";
}

export function plural(count: number, unit: string): string {
  if (count === 1) return `${count} ${unit}`;
  return `${count} ${unit}${/(s|x|ch)$/.test(unit) ? "es" : "s"}`;
}
