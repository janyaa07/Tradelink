import type { ArtKind } from "@/domain/catalogue";

const GLYPHS: Record<ArtKind, string> = {
  egg: "M12 3c-4 0-7 6.5-7 11a7 7 0 0 0 14 0c0-4.5-3-11-7-11z",
  sack: "M9 3h6l-1.5 3.5c3 1.5 5.5 5 5.5 9 0 3.5-2.5 5.5-7 5.5s-7-2-7-5.5c0-4 2.5-7.5 5.5-9z",
  bottle: "M10 2h4v4c0 1 3 2.5 3 6v8.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20.5V12c0-3.5 3-5 3-6z",
  tin: "M5 6c0-1.7 3-3 7-3s7 1.3 7 3v12c0 1.7-3 3-7 3s-7-1.3-7-3z",
  packet: "M6 3h12l1 3-1 15H6L5 6z",
  box: "M3 8l9-5 9 5v9l-9 5-9-5z",
  tub: "M4 8h16l-1.5 12a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20zM3 5h18v3H3z",
  block: "M4 8h16v11H4zM7 5h10l3 3H4z",
  leaf: "M20 3C21 14 15 21 5 20 4 10 10 3 20 3z",
  soap: "M8 8h8l1 3v9a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 20v-9zM10 3h6v2h-2v3h-3V5h-1z",
};

type ProductArtProps = {
  kind: ArtKind;
  /** Pixel size of the square tile, or "fill" for the full-width tile on a product card. Sizes in use: 26, 42, fill. */
  size?: number | "fill";
};

/** A solid product silhouette on accent-soft. Decorative: the product name is always shown beside it. */
export function ProductArt({ kind, size = 42 }: ProductArtProps) {
  const fill = size === "fill";
  return (
    <span
      aria-hidden="true"
      className={`grid flex-none place-items-center rounded-md bg-accent-soft text-accent ${fill ? "h-[92px] w-full" : ""}`}
      style={fill ? undefined : { width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" className={fill ? "size-14" : "size-[72%]"} focusable="false">
        <path d={GLYPHS[kind]} fill="currentColor" />
      </svg>
    </span>
  );
}
