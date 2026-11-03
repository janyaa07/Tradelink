"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "./Icon";
import { cx } from "./cx";

export type ThemePreference = "system" | "light" | "dark";

const COOKIE = "tl-theme";
const ONE_YEAR = 60 * 60 * 24 * 365;
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Writes the tl-theme cookie and the html data-theme attribute. "system" removes both. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (preference === "system") {
    document.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
    delete root.dataset.theme;
    return;
  }
  document.cookie = `${COOKIE}=${preference}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax${secure}`;
  root.dataset.theme = preference;
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

function readPreference(): ThemePreference {
  const theme = document.documentElement.dataset.theme;
  return theme === "light" || theme === "dark" ? theme : "system";
}

function readIsDark(): boolean {
  const preference = readPreference();
  return preference === "system" ? window.matchMedia(DARK_QUERY).matches : preference === "dark";
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readPreference, () => "system");
}

function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, readIsDark, () => false);
}

type ThemeToggleProps = {
  /** "hero" sits on the green home hero. */
  variant?: "default" | "hero";
  className?: string;
};

export function ThemeToggle({ variant = "default", className }: ThemeToggleProps) {
  const isDark = useIsDark();
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => applyTheme(isDark ? "light" : "dark")}
      className={cx(
        "grid size-9 flex-none place-items-center rounded-full border p-0 transition-colors duration-150",
        variant === "hero"
          ? "border-on-hero-2 bg-transparent text-on-hero hover:border-on-hero"
          : "border-line bg-surface text-accent hover:border-accent",
        className,
      )}
    >
      <Icon name="moon" size={19} className="dark:hidden" />
      <Icon name="sun" size={19} className="hidden dark:block" />
    </button>
  );
}
