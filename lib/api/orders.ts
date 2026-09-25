import { callNaPista } from "./naPistaClient";
import type { Order, OrderStatus, OrderSummary } from "./types";

export function listOrders(organizationId: string, filters: { status?: OrderStatus; customerId?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.customerId) params.set("customerId", filters.customerId);
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return callNaPista<OrderSummary[]>("GET", `/organizations/${organizationId}/orders${qs ? `?${qs}` : ""}`);
}

export function getOrder(organizationId: string, orderId: string) {
  return callNaPista<Order>("GET", `/organizations/${organizationId}/orders/${orderId}`);
}

/**
 * The client sends only `customerId?`/`items[].{productId, quantity}` —
 * `unitPrice`/`productName`/`subtotal`/`total`/`currency` are always
 * server-derived (ADR-031); this UI never sends and never trusts a price
 * it computed itself.
 */
export function createOrder(organizationId: string, input: { customerId?: string; items?: { productId: string; quantity: number | string }[] }) {
  return callNaPista<Order>("POST", `/organizations/${organizationId}/orders`, input);
}

export function updateOrderCustomer(organizationId: string, orderId: string, customerId: string | null) {
  return callNaPista<Order>("PATCH", `/organizations/${organizationId}/orders/${orderId}`, { customerId });
}

export function addOrderItem(organizationId: string, orderId: string, input: { productId: string; quantity: number | string }) {
  return callNaPista<Order>("POST", `/organizations/${organizationId}/orders/${orderId}/items`, input);
}

export function updateOrderItemQuantity(organizationId: string, orderId: string, itemId: string, quantity: number | string) {
  return callNaPista<Order>("PATCH", `/organizations/${organizationId}/orders/${orderId}/items/${itemId}`, { quantity });
}

export function removeOrderItem(organizationId: string, orderId: string, itemId: string) {
  return callNaPista<Order>("DELETE", `/organizations/${organizationId}/orders/${orderId}/items/${itemId}`);
}

export function confirmOrder(organizationId: string, orderId: string) {
  return callNaPista<Order>("POST", `/organizations/${organizationId}/orders/${orderId}/confirm`);
}

export function cancelOrder(organizationId: string, orderId: string) {
  return callNaPista<Order>("POST", `/organizations/${organizationId}/orders/${orderId}/cancel`);
}

export function completeOrder(organizationId: string, orderId: string) {
  return callNaPista<Order>("POST", `/organizations/${organizationId}/orders/${orderId}/complete`);
}
