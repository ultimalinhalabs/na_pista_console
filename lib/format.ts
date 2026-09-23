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
