import type { ReactNode } from "react";
import type { ArtKind, Category } from "@/domain/catalogue";
import { cx } from "./cx";

export type ProductImageSize = "sm" | "md" | "fill";

export type ProductImageProps = {
  art: ArtKind;
  category: Category;
  /** The product name, used as the alt text unless the picture is decorative. */
  name: string;
  /** "sm" is 40px, "md" is 64px and "fill" takes the full width of its container at 4:3. */
  size?: ProductImageSize;
  /** Set when the product name is shown next to the picture, so screen readers do not read it twice. */
  decorative?: boolean;
  className?: string;
};

/** One quiet ground for every category, so the pictures read as product shots rather than stickers. */
const BACKGROUNDS: Record<Category, string> = {
  fresh: "bg-sunken",
  dry_goods: "bg-sunken",
  oils_sauces: "bg-sunken",
  supplies: "bg-sunken",
};

const SIZES: Record<ProductImageSize, string> = {
  sm: "size-10 rounded-sm",
  md: "size-16 rounded-md",
  fill: "aspect-[16/10] w-full p-5",
};

const SHADOW = <ellipse cx="32" cy="54" rx="17" ry="2.6" fill="#000" opacity=".09" />;

/** Flat illustrations on a 64 x 64 grid, two or three tones each. Drawn for Tradelink, not traced from photos. */
const PICTURES: Record<ArtKind, ReactNode> = {
  egg: (
    <>
      <ellipse cx="22" cy="31" rx="7" ry="9" fill="#F7E7C6" />
      <ellipse cx="42" cy="31" rx="7" ry="9" fill="#F7E7C6" />
      <ellipse cx="32" cy="28" rx="7.5" ry="9.5" fill="#FFF4DE" />
      <ellipse cx="29.5" cy="24" rx="2" ry="3" fill="#FFFFFF" opacity=".8" />
      <path d="M11 33h42l-3.4 15.2A3 3 0 0 1 46.7 50.6H17.3a3 3 0 0 1-2.9-2.4z" fill="#C98B4F" />
      <path d="M11 33h42l-.9 4H11.9z" fill="#A9703C" />
      <path d="M27 38.5v10M37 38.5v10" stroke="#A9703C" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  sack: (
    <>
      <path
        d="M22 17h20l-3.5 6.5C46 27 50 34 50 42c0 7-6 10.5-18 10.5S14 49 14 42c0-8 4-15 11.5-18.5z"
        fill="#DDB97E"
      />
      <path d="M38.5 23.5C46 27 50 34 50 42c0 7-6 10.5-18 10.5 9-1.5 13-5 13-11 0-7-2.5-13-6.5-18z" fill="#C49C5F" />
      <rect x="24" y="21.5" width="16" height="3.4" rx="1.7" fill="#8A6A3E" />
      <rect x="23" y="33" width="18" height="12" rx="2.5" fill="#FFF6E4" />
      <ellipse cx="28.5" cy="39" rx="1.6" ry="2.8" transform="rotate(-25 28.5 39)" fill="#C49C5F" />
      <ellipse cx="32" cy="38" rx="1.6" ry="2.8" fill="#C49C5F" />
      <ellipse cx="35.5" cy="39" rx="1.6" ry="2.8" transform="rotate(25 35.5 39)" fill="#C49C5F" />
    </>
  ),
  bottle: (
    <>
      <rect x="27" y="8" width="10" height="6" rx="1.5" fill="#C8553D" />
      <path d="M28 14h8v6c0 2 7 4 7 11v18.5a3.5 3.5 0 0 1-3.5 3.5h-15a3.5 3.5 0 0 1-3.5-3.5V31c0-7 7-9 7-11z" fill="#E9B949" />
      <path d="M36 20c0 2 7 4 7 11v18.5a3.5 3.5 0 0 1-3.5 3.5H37c2-1 3-2.5 3-4.5V31c0-6-4-8.5-4-11z" fill="#D49E2E" />
      <rect x="21" y="35" width="22" height="12" fill="#FFF7E2" />
      <rect x="21" y="38.5" width="22" height="3.2" fill="#C8553D" />
      <rect x="24" y="23" width="2.6" height="9" rx="1.3" fill="#FFFFFF" opacity=".45" />
    </>
  ),
  tin: (
    <>
      <path d="M18 20v27c0 3 6.3 5.5 14 5.5s14-2.5 14-5.5V20z" fill="#D9534F" />
      <path d="M38 20h8v27c0 2.4-3.6 4.4-8.8 5.2C39.5 50 40 47 40 44V20z" fill="#BE3F3B" />
      <path d="M18 29h28v12H18z" fill="#F4D35E" />
      <path d="M40 29h6v12h-6z" fill="#E2BE45" />
      <circle cx="29" cy="35" r="3.6" fill="#D9534F" />
      <ellipse cx="32" cy="20" rx="14" ry="4.6" fill="#D5DCE1" />
      <ellipse cx="32" cy="20" rx="10.5" ry="3" fill="#B3BDC4" />
    </>
  ),
  packet: (
    <>
      <path d="M19 14h26l1 4-1 30 1 4H18l1-4-1-30z" fill="#5B9BD5" />
      <path d="M38 14h7l1 4-1 30 1 4h-8z" fill="#4682BE" />
      <path d="M18 13.5h28v4.5H18zM18 48h28v4.5H18z" fill="#3D6FA3" />
      <path d="M21 13.5v4.5M25 13.5v4.5M29 13.5v4.5M33 13.5v4.5M37 13.5v4.5M41 13.5v4.5M21 48v4.5M25 48v4.5M29 48v4.5M33 48v4.5M37 48v4.5M41 48v4.5" stroke="#5B9BD5" strokeWidth="1" />
      <rect x="22.5" y="24" width="19" height="15" rx="7.5" fill="#FFF4D9" />
      <path d="M25.5 29c2-2 4 2 6 0s4 2 6 0M25.5 33.5c2-2 4 2 6 0s4 2 6 0" stroke="#E2A93B" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <rect x="25" y="42" width="14" height="2.6" rx="1.3" fill="#F2C14E" />
    </>
  ),
  box: (
    <>
      <path d="M32 13l19 8.5-19 8.5-19-8.5z" fill="#E8C08B" />
      <path d="M13 21.5l19 8.5v22l-19-8.5z" fill="#D4A26A" />
      <path d="M51 21.5L32 30v22l19-8.5z" fill="#B98549" />
      <path d="M22.5 17.2l4-1.8 19 8.5-4 1.8z" fill="#F6E7CC" />
      <path d="M17 31.5l9 4v5.5l-9-4z" fill="#FFF6E6" />
    </>
  ),
  tub: (
    <>
      <path d="M17 26h30l-3 22.4a3 3 0 0 1-3 2.6H23a3 3 0 0 1-3-2.6z" fill="#F4EFE4" />
      <path d="M40 26h7l-3 22.4a3 3 0 0 1-3 2.6h-3.5c1.5-.7 2-1.8 2.2-3.2z" fill="#E1D9C8" />
      <path d="M18.1 33.5h27.8l-1.1 8.5H19.2z" fill="#6BB3E0" />
      <rect x="15" y="20" width="34" height="7" rx="3.5" fill="#3B8FC4" />
      <rect x="22" y="16.5" width="20" height="4.5" rx="2.25" fill="#5AA8DA" />
    </>
  ),
  block: (
    <>
      <path d="M14 28l22-8 14 6-22 8z" fill="#FBE38E" />
      <path d="M14 28l14 6v12l-14-6z" fill="#E3B83F" />
      <path d="M28 34l22-8v12l-22 8z" fill="#F6D365" />
      <path d="M25 24l11-4 14 6-11 4z" fill="#FBF8F0" />
      <path d="M39 30l11-4v12l-11 4z" fill="#EDE7D8" />
      <path d="M39 34.5l11-4v3l-11 4z" fill="#5B8DEF" />
    </>
  ),
  leaf: (
    <>
      <path d="M29.5 43h5l-.8 9.5h-3.4z" fill="#EAF2DC" />
      <path d="M32 47C18 41 13.5 27 21 12c11 6 16 20 11 35z" fill="#4E9F50" />
      <path d="M32 47c14-5 19.5-19 13.5-32-11.5 5.5-17.5 19-13.5 32z" fill="#6DBE5E" />
      <path d="M31.5 45C30 35 27 25 22.5 16.5M32.5 45c1.5-10 5.5-19.5 12-27" stroke="#CDE8C5" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </>
  ),
  soap: (
    <>
      <path d="M29 8h11v3.5h-7.5V16H29z" fill="#2F4858" />
      <rect x="27" y="15" width="10" height="6" rx="1.5" fill="#3E5C70" />
      <rect x="20" y="20" width="24" height="33" rx="5" fill="#6EC1E4" />
      <path d="M37 20h2a5 5 0 0 1 5 5v23a5 5 0 0 1-5 5h-2c2 0 3-1.5 3-4V24c0-2.5-1-4-3-4z" fill="#4FA8D0" />
      <rect x="24" y="29" width="14" height="15" rx="2" fill="#FFFFFF" />
      <path d="M31 32c2.4 3 3.5 4.8 3.5 6.3a3.5 3.5 0 0 1-7 0c0-1.5 1.1-3.3 3.5-6.3z" fill="#6EC1E4" />
      <circle cx="49" cy="17" r="3" fill="#FFFFFF" stroke="#6EC1E4" strokeWidth="1" />
      <circle cx="52" cy="25" r="1.8" fill="#FFFFFF" stroke="#6EC1E4" strokeWidth="1" />
    </>
  ),
};

/**
 * An illustrated product picture on a soft category background. We have no product photos, so every
 * art kind is a small flat drawing. Server and client safe: no hooks and no ids.
 */
export function ProductImage({ art, category, name, size = "md", decorative = false, className }: ProductImageProps) {
  const fill = size === "fill";
  return (
    <span
      className={cx("grid flex-none place-items-center overflow-hidden", BACKGROUNDS[category], SIZES[size], className)}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": name })}
    >
      <svg viewBox="0 0 64 64" className={fill ? "h-[78%] w-auto max-w-[78%]" : "size-[88%]"} focusable="false" aria-hidden="true">
        {SHADOW}
        {PICTURES[art]}
      </svg>
    </span>
  );
}
