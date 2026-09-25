import { callNaPista } from "./naPistaClient";
import type { Category } from "./types";

export function listCategories(organizationId: string, filters: { status?: "ACTIVE" | "ARCHIVED"; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return callNaPista<Category[]>("GET", `/organizations/${organizationId}/categories${qs ? `?${qs}` : ""}`);
}

export function createCategory(organizationId: string, input: { name: string; description?: string }) {
  return callNaPista<Category>("POST", `/organizations/${organizationId}/categories`, input);
}

export function archiveCategory(organizationId: string, categoryId: string) {
  return callNaPista<Category>("DELETE", `/organizations/${organizationId}/categories/${categoryId}`);
}

/** F29: PATCH was supported by the API (name/description/status) but unused by the UI — enables edit and reactivate. */
export function updateCategory(organizationId: string, categoryId: string, patch: { name?: string; description?: string | null; status?: "ACTIVE" | "ARCHIVED" }) {
  return callNaPista<Category>("PATCH", `/organizations/${organizationId}/categories/${categoryId}`, patch);
}
