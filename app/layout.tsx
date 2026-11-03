import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Sora } from "next/font/google";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import { resolveLanguage } from "@/i18n";
import { PwaProvider } from "@/pwa/PwaProvider";
import { UpdateGate } from "@/pwa/UpdateGate";
import { ToastProvider } from "@/ui/Toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-sora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tradelink",
  description: "Order, deliver and check stock between small food businesses and their suppliers.",
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Restock", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1211" },
  ],
};

type Theme = "light" | "dark";

function parseTheme(value: string | undefined): Theme | undefined {
  return value === "light" || value === "dark" ? value : undefined;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const theme = parseTheme((await cookies()).get("tl-theme")?.value);
  // PWA chrome (offline, update) follows the browser language until app_user.language is wired in.
  const lang = resolveLanguage((await headers()).get("accept-language"));

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${inter.variable} ${plexMono.variable} ${sora.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ToastProvider>
          <PwaProvider lang={lang}>{children}</PwaProvider>
          <UpdateGate lang={lang} />
        </ToastProvider>
      </body>
    </html>
  );
}
