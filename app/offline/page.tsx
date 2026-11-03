import type { Metadata } from "next";
import { headers } from "next/headers";
import { resolveLanguage, t } from "@/i18n";

export const metadata: Metadata = { title: "Offline · Tradelink AI" };

// The service worker serves this page when the network is gone, so its stylesheet may not load.
// Inline styles with token fallbacks keep it readable on its own.
const styles = {
  main: {
    minHeight: "100dvh",
    maxWidth: "28rem",
    margin: "0 auto",
    padding: "0 16px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "12px",
    fontFamily: "var(--font-inter), system-ui, sans-serif",
    color: "var(--ink, #0F2A20)",
    background: "var(--bg, #FFFFFF)",
  },
  title: { fontSize: "1.6rem", fontWeight: 800, lineHeight: 1.2, letterSpacing: "-0.02em", margin: 0 },
  body: { color: "var(--muted, #54695F)", margin: 0 },
  button: {
    alignSelf: "flex-start",
    marginTop: "4px",
    padding: "11px 14px",
    borderRadius: "10px",
    background: "var(--accent, #0B4F37)",
    color: "var(--on-accent, #FFFFFF)",
    fontWeight: 700,
    textDecoration: "none",
  },
} as const;

export default async function OfflinePage() {
  const lang = resolveLanguage((await headers()).get("accept-language"));
  return (
    <main style={styles.main}>
      {/* eslint-disable-next-line @next/next/no-img-element -- cached by the service worker for offline use */}
      <img src="/icon.svg" alt="Tradelink AI" width={56} height={56} />
      <h1 style={styles.title}>{t(lang, "offline.page.title")}</h1>
      <p style={styles.body}>{t(lang, "offline.page.body")}</p>
      {/* A plain link, not next/link: it must work before any script has loaded. */}
      <a href="/" style={styles.button}>
        {t(lang, "button.tryAgain")}
      </a>
    </main>
  );
}
