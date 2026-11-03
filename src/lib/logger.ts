type Level = "info" | "warn" | "error";
type Fields = Record<string, string | number | boolean | null | undefined>;

const REDACTED_KEYS = /password|token|secret|key|authorization|cookie|text|email/i;

export function redact(fields: Fields): Fields {
  const safe: Fields = {};
  for (const [name, value] of Object.entries(fields)) {
    safe[name] = REDACTED_KEYS.test(name) ? "[redacted]" : value;
  }
  return safe;
}

function write(level: Level, event: string, fields: Fields): void {
  const line = JSON.stringify({ level, time: new Date().toISOString(), event, ...redact(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Structured JSON logging (ADR 0017). Never log secrets, order text or personal details. */
export const logger = {
  info: (event: string, fields: Fields = {}) => write("info", event, fields),
  warn: (event: string, fields: Fields = {}) => write("warn", event, fields),
  error: (event: string, fields: Fields = {}) => write("error", event, fields),
};
