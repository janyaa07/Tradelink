import { en, type Dictionary, type MessageKey } from "./en";
import { ms } from "./ms";
import { ta } from "./ta";
import { zh } from "./zh";

export type { Dictionary, MessageKey };

/** The languages Tradelink AI speaks, matching `app_user.language` (docs/PLAN.md, section 6). */
export const LANGUAGES = ["en", "zh", "ms", "ta"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";

export const dictionaries: Record<Language, Dictionary> = { en, zh, ms, ta };

export type MessageVars = Record<string, string | number>;

const VARIABLE = /\{(\w+)\}/g;

export function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && (LANGUAGES as readonly string[]).includes(value);
}

/** The {name} variables a message uses, sorted, for checking translations against English. */
export function variablesOf(message: string): string[] {
  return [...new Set([...message.matchAll(VARIABLE)].map((match) => match[1] ?? ""))].sort();
}

/** The message in `lang`, with {name} variables filled. A variable with no value is left as written. */
export function t(lang: Language, key: MessageKey, vars: MessageVars = {}): string {
  const message = dictionaries[lang][key];
  return message.replace(VARIABLE, (whole, name: string) => (Object.hasOwn(vars, name) ? String(vars[name]) : whole));
}

/** Maps one language tag ("zh-Hans-SG", "ms_MY", "TA") to a supported language. */
function fromTag(tag: string): Language | null {
  const primary = tag.trim().toLowerCase().replace("_", "-").split("-")[0] ?? "";
  return isLanguage(primary) ? primary : null;
}

/** Tags from an Accept-Language header, best first. A plain "zh" counts as a one-tag header. */
function parseAcceptLanguage(header: string): string[] {
  return header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const q = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
      const quality = q ? Number(q.slice(2)) : 1;
      return { tag: tag.trim(), quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .filter((entry) => entry.tag && entry.tag !== "*" && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((entry) => entry.tag);
}

/**
 * The language to show. Pass the person's saved `app_user.language` first and the request's
 * Accept-Language header second; the first one that names a supported language wins, else English.
 */
export function resolveLanguage(...candidates: Array<string | null | undefined>): Language {
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const tag of parseAcceptLanguage(candidate)) {
      const language = fromTag(tag);
      if (language) return language;
    }
  }
  return DEFAULT_LANGUAGE;
}
