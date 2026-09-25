import type { ProductUnit } from "./api/types";

/**
 * The API always returns a fixed 6-decimal string (numeric(20,6) on the
 * wire, F22 brief §4/ADR-027) — this UI never does its own float math on
 * it, only trims trailing zeros for display.
 */
export function formatQuantity(quantity: string): string {
  const trimmed = quantity.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  return trimmed;
}

/** F29: display form (pt decimal comma, e.g. "250,5"); `formatQuantity` stays the canonical form used in inputs sent to the API. */
export function displayQuantity(quantity: string): string {
  return formatQuantity(quantity).replace(".", ",");
}

const UNIT_LABELS: Record<ProductUnit, string> = {
  UNIT: "un",
  KG: "kg",
  G: "g",
  L: "l",
  ML: "ml",
};

export function unitLabel(unit: ProductUnit): string {
  return UNIT_LABELS[unit] ?? unit;
}

const CURRENCY_SYMBOL: Record<string, string> = { AOA: "Kz" };

/**
 * F29: money display without float math. The APIs return decimal strings
 * (`numeric(14,2)`, ADR-029); this only regroups digits (pt-AO style:
 * "10 000,00 Kz"). `null` means "no price" and is rendered by callers.
 */
export function formatMoney(amount: string, currency = "AOA"): string {
  const negative = amount.startsWith("-");
  const [integerPart = "0", fractionPart = ""] = (negative ? amount.slice(1) : amount).split(".");
  const grouped = integerPart.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const fraction = (fractionPart + "00").slice(0, 2);
  return `${negative ? "−" : ""}${grouped},${fraction} ${CURRENCY_SYMBOL[currency] ?? currency}`;
}

/** Integer counts with grouping ("1 234"). */
export function formatCount(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
