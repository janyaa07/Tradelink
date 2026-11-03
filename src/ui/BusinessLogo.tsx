import type { ReactNode } from "react";

/** Business logos are the one place colours beyond green appear. */
const LOGO_COLORS = ["#5C4BB0", "#B5447E", "#2F6DB5", "#8A5A1E", "#3B7D74"] as const;

type LogoArt = { background: string; art: ReactNode };

const NOODLES: LogoArt = {
  background: "#C8452F",
  art: (
    <>
      <path d="M9 19h22c0 6-4.5 10-11 10S9 25 9 19z" fill="#FFFFFF" />
      <path
        d="M14 16c0-2.5 2-2.5 2-5M20 16c0-2.5 2-2.5 2-5M26 16c0-2.5 2-2.5 2-5"
        stroke="#FFFFFF"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
};

const KOPITIAM: LogoArt = {
  background: "#0F7C8C",
  art: (
    <>
      <path d="M11 15h15v8a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7z" fill="#FFFFFF" />
      <path d="M26 17h2a3 3 0 0 1 0 7h-2" stroke="#FFFFFF" strokeWidth="2.2" fill="none" />
      <path d="M15 12c0-2 1.5-2 1.5-4M20 12c0-2 1.5-2 1.5-4" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
};

const HARBOUR: LogoArt = {
  background: "#1D3F73",
  art: (
    <>
      <circle cx="20" cy="11.5" r="2.8" fill="none" stroke="#FFFFFF" strokeWidth="2.4" />
      <path
        d="M20 14.5V31M13 19h14M9.5 23c1 5 5.5 8 10.5 8s9.5-3 10.5-8"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </>
  ),
};

const FRESH_LANE: LogoArt = {
  background: "#2E8B3D",
  art: (
    <>
      <path d="M30 9c1 11-5 21-17 20C11 18 18 10 30 9z" fill="#FFFFFF" />
      <path d="M12 31c3-8 7-12 13-16" stroke="#2E8B3D" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
};

const BRIGHT_PANTRY: LogoArt = {
  background: "#D08A11",
  art: (
    <>
      <circle cx="20" cy="20" r="6" fill="#FFFFFF" />
      <path
        d="M20 7v4M20 29v4M7 20h4M29 20h4M10.8 10.8l2.8 2.8M26.4 26.4l2.8 2.8M10.8 29.2l2.8-2.8M26.4 13.6l2.8-2.8"
        stroke="#FFFFFF"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </>
  ),
};

const TRADELINK: LogoArt = {
  background: "#0F5239",
  art: (
    <g transform="translate(8 8) scale(.5)">
      <path d="M6 9h16.5v30h-6V15.5H6z" fill="#FFFFFF" />
      <path d="M25.5 9H42v6.5H31.5V39h-6z" fill="#3DE29F" />
    </g>
  ),
};

/** Bespoke artwork from the approved prototype (b1, b2, s1, s2, s3, a1). */
const LOGO_ART: Record<string, LogoArt> = {
  "Mei's Noodle House": NOODLES,
  "Seaside Kopitiam": KOPITIAM,
  "Harbour Dry Goods": HARBOUR,
  "Fresh Lane Produce": FRESH_LANE,
  "Bright Pantry Supplies": BRIGHT_PANTRY,
  "Tradelink Operations": TRADELINK,
};

function colourFor(seed: string): string {
  const sum = [...seed].reduce((total, char) => total + char.charCodeAt(0), 0);
  return LOGO_COLORS[sum % LOGO_COLORS.length] ?? LOGO_COLORS[0];
}

function initialsOf(name: string): string {
  return name
    .replace(/[^A-Za-z ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

type BusinessLogoProps = {
  name: string;
  /** Stable key for the badge colour, such as the organisation id. Defaults to the name. */
  seedKey?: string;
  size?: number;
};

/** Decorative: the business name is always shown next to the logo. */
export function BusinessLogo({ name, seedKey, size = 36 }: BusinessLogoProps) {
  const art = LOGO_ART[name];
  return (
    <span
      aria-hidden="true"
      className="inline-grid flex-none place-items-center overflow-hidden rounded-full"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 40 40" className="block size-full" focusable="false">
        <rect width="40" height="40" fill={art ? art.background : colourFor(seedKey ?? name)} />
        {art ? (
          art.art
        ) : (
          <text
            x="20"
            y="26"
            textAnchor="middle"
            fontWeight="800"
            fontSize="15"
            fill="#FFFFFF"
            style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
          >
            {initialsOf(name)}
          </text>
        )}
      </svg>
    </span>
  );
}
