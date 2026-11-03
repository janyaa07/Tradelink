/**
 * Notification texts from notification_type, with {{1}}-style variables. The limits match the table's
 * checks and what a lock screen shows.
 */
export const TITLE_MAX = 65;
export const BODY_MAX = 178;

export type NotificationTemplate = { title: string; body: string };

export type FilledTemplate = { ok: true; title: string; body: string } | { ok: false; error: string };

const VARIABLE = /\{\{(\d+)\}\}/g;
const ELLIPSIS = "…";

/** Length in characters as Postgres counts them (code points, not UTF-16 units). */
export function charLength(text: string): number {
  return [...text].length;
}

/** The variable numbers a text uses, sorted, each once. */
export function templateVariables(text: string): number[] {
  const found = new Set<number>();
  for (const match of text.matchAll(VARIABLE)) found.add(Number(match[1]));
  return [...found].sort((a, b) => a - b);
}

/** Problems with a template: lengths, and variables that must run 1, 2, 3 with no gaps. */
export function checkTemplate(template: NotificationTemplate): string[] {
  const issues: string[] = [];
  if (charLength(template.title.trim()) === 0) issues.push("title is empty");
  if (charLength(template.body.trim()) === 0) issues.push("body is empty");
  if (charLength(template.title) > TITLE_MAX) issues.push(`title is longer than ${TITLE_MAX} characters`);
  if (charLength(template.body) > BODY_MAX) issues.push(`body is longer than ${BODY_MAX} characters`);
  if (/\{\{(?!\d+\}\})/.test(`${template.title} ${template.body}`)) issues.push("a variable is malformed");
  const used = templateVariables(`${template.title} ${template.body}`);
  if (used.some((number, index) => number !== index + 1)) issues.push("variables must be numbered from 1 with no gaps");
  return issues;
}

/** Problems across one type's languages: each must pass checkTemplate and use the same variables. */
export function checkTranslations(byLanguage: Record<string, NotificationTemplate>): string[] {
  const issues: string[] = [];
  let expected: string | null = null;
  for (const [language, template] of Object.entries(byLanguage)) {
    for (const issue of checkTemplate(template)) issues.push(`${language}: ${issue}`);
    const variables = templateVariables(`${template.title} ${template.body}`).join(",");
    expected ??= variables;
    if (variables !== expected) issues.push(`${language}: uses different variables`);
  }
  return issues;
}

function clip(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("").trimEnd()}${ELLIPSIS}`;
}

/**
 * Fills {{n}} with values[n - 1]. Every variable needs a value and every value a variable. Values are
 * trimmed and their whitespace collapsed; a result over the limit is shortened with an ellipsis.
 */
export function fillTemplate(template: NotificationTemplate, values: readonly string[]): FilledTemplate {
  const used = templateVariables(`${template.title} ${template.body}`);
  const count = used.length === 0 ? 0 : Math.max(...used);
  if (values.length !== count) return { ok: false, error: `expected ${count} values, got ${values.length}` };
  const clean = values.map((value) => value.replace(/\s+/g, " ").trim());
  if (clean.some((value) => value.length === 0)) return { ok: false, error: "a value is empty" };

  const fill = (text: string) => text.replace(VARIABLE, (_, number: string) => clean[Number(number) - 1] ?? "");
  return { ok: true, title: clip(fill(template.title), TITLE_MAX), body: clip(fill(template.body), BODY_MAX) };
}
