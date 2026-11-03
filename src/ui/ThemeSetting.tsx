"use client";

import { segmentedGroupClass, segmentedItemClass } from "./Segmented";
import { applyTheme, useThemePreference, type ThemePreference } from "./ThemeToggle";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Appearance setting: System, Light or Dark. Takes effect immediately. */
export function ThemeSetting() {
  const preference = useThemePreference();

  return (
    <div role="group" aria-label="Appearance" className={segmentedGroupClass}>
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={preference === option.value}
          onClick={() => applyTheme(option.value)}
          className={`border-0 ${segmentedItemClass(preference === option.value)}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
