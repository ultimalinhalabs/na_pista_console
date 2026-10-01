import { callNaPista, callNaPistaPage } from "./naPistaClient";
import type { InventoryBalance, StockMovement, StockMovementType } from "./types";

export function listInventory(organizationId: string, filters: { zeroStock?: boolean; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.zeroStock) params.set("zeroStock", "true");
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return callNaPista<InventoryBalance[]>("GET", `/organizations/${organizationId}/inventory${qs ? `?${qs}` : ""}`);
}

/** One page of balances plus the exact total (`pagination.total`). */
export function listInventoryPage(organizationId: string, filters: { zeroStock?: boolean; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.zeroStock) params.set("zeroStock", "true");
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  const qs = params.toString();
  return callNaPistaPage<InventoryBalance>(`/organizations/${organizationId}/inventory${qs ? `?${qs}` : ""}`);
}

export function getInventoryBalance(organizationId: string, productId: string) {
  return callNaPista<InventoryBalance>("GET", `/organizations/${organizationId}/inventory/${productId}`);
}

export function listMovements(organizationId: string, productId: string, filters: { limit?: number } = {}) {
  const qs = filters.limit ? `?limit=${filters.limit}` : "";
  return callNaPista<StockMovement[]>("GET", `/organizations/${organizationId}/inventory/${productId}/movements${qs}`);
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
