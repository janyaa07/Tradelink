/**
 * Money is handled in integer cents (ADR 0019). Values cross the API as decimal strings such as "52.00".
 */
export type Cents = number;

export function toCents(value: string | number): Cents {
  const text = typeof value === "number" ? value.toFixed(2) : value.trim();
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error(`Not a money value: ${text}`);
  const [, sign, whole, fraction = ""] = match;
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return sign ? -cents : cents;
}

export function fromCents(cents: Cents): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function formatMoney(value: string | Cents): string {
  const cents = typeof value === "number" ? value : toCents(value);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-SG");
  return `${sign}S$${whole}.${String(abs % 100).padStart(2, "0")}`;
}

export function lineTotal(price: string, qty: number): Cents {
  return toCents(price) * qty;
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}
