import type { MetadataRoute } from "next";

// Brand greens from src/styles/tokens.css: --accent for the browser bar, --hero for the splash screen.
const THEME_COLOR = "#0B4F37";
const BACKGROUND_COLOR = "#0A3A29";

/** The installable Restock app (ADR 0016). PNG icons come from `node scripts/build-icons.mjs`. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/r",
    name: "Restock by Ledger",
    short_name: "Restock",
    description: "Order stock by chat and keep every supplier on track.",
    start_url: "/r",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    categories: ["business", "food"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
