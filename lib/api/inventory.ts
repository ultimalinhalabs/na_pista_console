import { callNaPista } from "./naPistaClient";
import type { InventoryBalance, StockMovement, StockMovementType } from "./types";

export function listInventory(organizationId: string, filters: { zeroStock?: boolean } = {}) {
  const params = new URLSearchParams();
  if (filters.zeroStock) params.set("zeroStock", "true");
  const qs = params.toString();
  return callNaPista<InventoryBalance[]>("GET", `/organizations/${organizationId}/inventory${qs ? `?${qs}` : ""}`);
}

export function getInventoryBalance(organizationId: string, productId: string) {
  return callNaPista<InventoryBalance>("GET", `/organizations/${organizationId}/inventory/${productId}`);
}

export function listMovements(organizationId: string, productId: string) {
  return callNaPista<StockMovement[]>("GET", `/organizations/${organizationId}/inventory/${productId}/movements`);
}

/**
 * F22 brief §11/§15: the only way to change a balance. Quantity is
 * always positive; direction comes from `type`, never from sign — this
 * UI never sends a negative number for a decrease.
 */
export function createMovement(organizationId: string, productId: string, input: { type: StockMovementType; quantity: number | string; reason?: string }) {
  return callNaPista<{ balance: InventoryBalance; movement: StockMovement }>(
    "POST",
    `/organizations/${organizationId}/inventory/${productId}/movements`,
    input,
  );
}
