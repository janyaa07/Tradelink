import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BODY_MAX, checkTemplate, checkTranslations, fillTemplate, templateVariables, TITLE_MAX, type NotificationTemplate } from "./templates";

describe("fillTemplate", () => {
  const template = { title: "Finish your order for {{1}}", body: "Confirm it before {{2}} so {{1}} is on time." };

  it("fills every variable, collapsing whitespace in values", () => {
    expect(fillTemplate(template, ["Thursday", "  9:00 pm\n"])).toEqual({
      ok: true,
      title: "Finish your order for Thursday",
      body: "Confirm it before 9:00 pm so Thursday is on time.",
    });
  });

  it("refuses missing, extra or empty values", () => {
    expect(fillTemplate(template, ["Thursday"])).toEqual({ ok: false, error: "expected 2 values, got 1" });
    expect(fillTemplate(template, ["a", "b", "c"])).toMatchObject({ ok: false });
    expect(fillTemplate(template, ["Thursday", "   "])).toEqual({ ok: false, error: "a value is empty" });
    expect(fillTemplate({ title: "Support replied", body: "Open the chat." }, [])).toMatchObject({ ok: true });
  });

  it("shortens a filled result over the limits with an ellipsis", () => {
    const filled = fillTemplate({ title: "New order from {{1}}", body: "{{1}}" }, ["x".repeat(300)]);
    if (!filled.ok) throw new Error(filled.error);
    expect([...filled.title]).toHaveLength(TITLE_MAX);
    expect([...filled.body]).toHaveLength(BODY_MAX);
    expect(filled.body.endsWith("…")).toBe(true);
  });
});

describe("checkTemplate", () => {
  it("accepts a good template and lists the variables used", () => {
    expect(checkTemplate({ title: "{{1}} answered", body: "For {{2}}: {{3}}." })).toEqual([]);
    expect(templateVariables("{{2}} and {{1}} and {{2}}")).toEqual([1, 2]);
  });

  it("flags lengths, gaps and malformed variables", () => {
    expect(checkTemplate({ title: "t".repeat(66), body: "b" })).toContain("title is longer than 65 characters");
    expect(checkTemplate({ title: "t", body: "b".repeat(179) })).toContain("body is longer than 178 characters");
    expect(checkTemplate({ title: "{{1}}", body: "{{3}}" })).toContain("variables must be numbered from 1 with no gaps");
    expect(checkTemplate({ title: "{{one}}", body: "b" })).toContain("a variable is malformed");
    expect(checkTemplate({ title: " ", body: "b" })).toContain("title is empty");
  });

  it("counts characters as Postgres does, so Tamil and Chinese texts are measured fairly", () => {
    expect(checkTemplate({ title: "உ".repeat(65), body: "订".repeat(178) })).toEqual([]);
  });

  it("requires every language of a type to use the same variables", () => {
    expect(checkTranslations({ en: { title: "{{1}}", body: "{{2}}" }, zh: { title: "{{1}}", body: "无" } })).toEqual([
      "zh: uses different variables",
    ]);
  });
});

/** Reads the seed rows from the pending migration: ('name', 'lang', 'channel', 'title', 'body'). */
function seedRows(): { name: string; language: string; template: NotificationTemplate }[] {
  const path = fileURLToPath(new URL("../../supabase/migrations/20261103133838_ai_notification_types.sql", import.meta.url));
  const sql = readFileSync(path, "utf8");
  const literal = "'((?:[^']|'')*)'";
  const row = new RegExp(`\\(${literal}, ${literal}, ${literal}, ${literal}, ${literal}\\)`, "g");
  const unquote = (text: string | undefined) => (text ?? "").replaceAll("''", "'");
  return [...sql.matchAll(row)].map((match) => ({
    name: unquote(match[1]),
    language: unquote(match[2]),
    template: { title: unquote(match[4]), body: unquote(match[5]) },
  }));
}

describe("seeded notification types", () => {
  const rows = seedRows();
  const STARTER = [
    "order_summary",
    "finish_order_reminder",
    "supplier_po",
    "po_change_result",
    "arrival_check",
    "agent_action_notice",
    "support_reply",
    "daily_plan_ready",
  ];

  it("has every starter type in all four languages", () => {
    expect(rows).toHaveLength(STARTER.length * 4);
    for (const name of STARTER) {
      expect(rows.filter((row) => row.name === name).map((row) => row.language).sort()).toEqual(["en", "ms", "ta", "zh"]);
    }
  });

  it("passes the length and variable checks, with the same variables in every language", () => {
    for (const name of STARTER) {
      const byLanguage = Object.fromEntries(rows.filter((row) => row.name === name).map((row) => [row.language, row.template]));
      expect(checkTranslations(byLanguage), name).toEqual([]);
    }
  });

  it("follows the copy rules: no exclamation marks, and English in sentence case", () => {
    for (const row of rows) {
      expect(`${row.template.title}${row.template.body}`).not.toMatch(/[!！]/);
      if (row.language === "en") {
        const words = row.template.title.split(" ").slice(1);
        expect(words.filter((word) => /^[A-Z][a-z]/.test(word) && word !== "Tradelink AI"), row.name).toEqual([]);
      }
    }
  });
});
