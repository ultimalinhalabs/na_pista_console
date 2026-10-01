import { callNaPista, callNaPistaPage } from "./naPistaClient";
import type { Customer } from "./types";

export function listCustomers(organizationId: string, filters: { status?: "ACTIVE" | "ARCHIVED"; q?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return callNaPista<Customer[]>("GET", `/organizations/${organizationId}/customers${qs ? `?${qs}` : ""}`);
}

/** Exact number of customers matching the filters — read from `pagination.total` (one row requested). */
export async function countCustomers(organizationId: string, filters: { status?: "ACTIVE" | "ARCHIVED" } = {}) {
  const params = new URLSearchParams({ pageSize: "1" });
  if (filters.status) params.set("status", filters.status);
  const page = await callNaPistaPage<Customer>(`/organizations/${organizationId}/customers?${params}`);
  return page.pagination.total;
}

export function getCustomer(organizationId: string, customerId: string) {
  return callNaPista<Customer>("GET", `/organizations/${organizationId}/customers/${customerId}`);
}

export function createCustomer(organizationId: string, input: { name: string; email?: string; phone?: string; notes?: string }) {
  return callNaPista<Customer>("POST", `/organizations/${organizationId}/customers`, input);
}

export function updateCustomer(
  organizationId: string,
  customerId: string,
  patch: { name?: string; email?: string | null; phone?: string | null; notes?: string | null; status?: "ACTIVE" | "ARCHIVED" },
) {
  return callNaPista<Customer>("PATCH", `/organizations/${organizationId}/customers/${customerId}`, patch);
}

export function archiveCustomer(organizationId: string, customerId: string) {
  return callNaPista<Customer>("DELETE", `/organizations/${organizationId}/customers/${customerId}`);
}
