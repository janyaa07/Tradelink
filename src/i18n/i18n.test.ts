import { describe, expect, it } from "vitest";
import { dictionaries, isLanguage, LANGUAGES, resolveLanguage, t, variablesOf, type MessageKey } from "./index";

const englishKeys = Object.keys(dictionaries.en).sort();

describe("dictionaries", () => {
  it.each(LANGUAGES)("%s has exactly the English keys", (lang) => {
    expect(Object.keys(dictionaries[lang]).sort()).toEqual(englishKeys);
  });

  it.each(LANGUAGES)("%s has no empty messages", (lang) => {
    for (const [key, message] of Object.entries(dictionaries[lang])) {
      expect(message.trim(), `${lang} ${key}`).not.toBe("");
    }
  });

  it.each(LANGUAGES)("%s uses the same variables as English", (lang) => {
    for (const key of englishKeys as MessageKey[]) {
      expect(variablesOf(dictionaries[lang][key]), `${lang} ${key}`).toEqual(variablesOf(dictionaries.en[key]));
    }
  });

  it.each(LANGUAGES)("%s has no exclamation marks or emoji", (lang) => {
    for (const [key, message] of Object.entries(dictionaries[lang])) {
      expect(message, `${lang} ${key}`).not.toMatch(/[!！]|\p{Extended_Pictographic}/u);
    }
  });

  it("keeps English in sentence case", () => {
    for (const [key, message] of Object.entries(dictionaries.en)) {
      const words = message.split(/(?<=\.)\s+/).flatMap((sentence) => sentence.split(/\s+/).slice(1));
      const capitalised = words.filter((word) => /^[A-Z][a-z]/.test(word) && !["Restock", "Home", "Screen", "iPhone"].includes(word.replace(/[.,]$/, "")));
      expect(capitalised, key).toEqual([]);
    }
  });

  it("translates rather than copying English", () => {
    for (const lang of LANGUAGES.filter((code) => code !== "en")) {
      expect(dictionaries[lang]["button.confirm"]).not.toBe(dictionaries.en["button.confirm"]);
      expect(dictionaries[lang]["card.staleTap"]).not.toBe(dictionaries.en["card.staleTap"]);
    }
  });
});

describe("t", () => {
  it("returns the message in the chosen language", () => {
    expect(t("en", "button.sendAll")).toBe("Send all");
    expect(t("zh", "button.sendAll")).toBe("全部发送");
    expect(t("ms", "button.refresh")).toBe("Muat semula");
    expect(t("ta", "button.cancel")).toBe("ரத்துசெய்");
  });

  it("fills variables", () => {
    expect(t("en", "offline.pending", { count: 3 })).toBe("3 waiting to send");
    expect(t("zh", "offline.pending", { count: 0 })).toBe("0 项待发送");
  });

  it("leaves a variable with no value as written", () => {
    expect(t("en", "offline.pending")).toBe("{count} waiting to send");
  });

  it("ignores values for variables the message does not use", () => {
    expect(t("en", "button.undo", { count: 2 })).toBe("Undo");
  });

  it("does not read inherited properties as values", () => {
    expect(t("en", "offline.pending", Object.create({ count: 9 }) as Record<string, number>)).toBe("{count} waiting to send");
  });
});

describe("variablesOf", () => {
  it("lists each variable once, sorted", () => {
    expect(variablesOf("{b} and {a} and {b}")).toEqual(["a", "b"]);
    expect(variablesOf("none")).toEqual([]);
  });
});

describe("resolveLanguage", () => {
  it("prefers the saved language", () => {
    expect(resolveLanguage("ta", "zh-CN,zh;q=0.9")).toBe("ta");
  });

  it("falls back to Accept-Language when the saved language is missing or unknown", () => {
    expect(resolveLanguage(null, "zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh");
    expect(resolveLanguage("fr", "ms-MY")).toBe("ms");
    expect(resolveLanguage(undefined, "ta-SG")).toBe("ta");
  });

  it("orders Accept-Language by quality", () => {
    expect(resolveLanguage("en;q=0.3, ms;q=0.8, zh;q=0.5")).toBe("ms");
    expect(resolveLanguage("fr-FR, de;q=0.9, zh-Hans-SG;q=0.4")).toBe("zh");
  });

  it("skips refused and wildcard tags", () => {
    expect(resolveLanguage("zh;q=0, ta;q=0.2")).toBe("ta");
    expect(resolveLanguage("*")).toBe("en");
  });

  it("accepts underscores and any case", () => {
    expect(resolveLanguage("MS_my")).toBe("ms");
  });

  it("defaults to English", () => {
    expect(resolveLanguage()).toBe("en");
    expect(resolveLanguage(null, "")).toBe("en");
    expect(resolveLanguage("fr-FR,de")).toBe("en");
  });
});

describe("isLanguage", () => {
  it("accepts only supported codes", () => {
    expect(isLanguage("zh")).toBe(true);
    expect(isLanguage("zh-CN")).toBe(false);
    expect(isLanguage(1)).toBe(false);
  });
});
