import { callNaPista } from "./naPistaClient";
import type { Category } from "./types";

export function listCategories(organizationId: string, filters: { status?: "ACTIVE" | "ARCHIVED" } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return callNaPista<Category[]>("GET", `/organizations/${organizationId}/categories${qs ? `?${qs}` : ""}`);
}

export function createCategory(organizationId: string, input: { name: string; description?: string }) {
  return callNaPista<Category>("POST", `/organizations/${organizationId}/categories`, input);
}

export function archiveCategory(organizationId: string, categoryId: string) {
  return callNaPista<Category>("DELETE", `/organizations/${organizationId}/categories/${categoryId}`);
}
