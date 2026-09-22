import { callNaPista } from "./naPistaClient";
import type { Product } from "./types";

export function listProducts(
  organizationId: string,
  filters: { status?: "ACTIVE" | "ARCHIVED"; categoryId?: string; q?: string } = {},
) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.q) params.set("q", filters.q);
  const qs = params.toString();
  return callNaPista<Product[]>("GET", `/organizations/${organizationId}/products${qs ? `?${qs}` : ""}`);
}

export function getProduct(organizationId: string, productId: string) {
  return callNaPista<Product>("GET", `/organizations/${organizationId}/products/${productId}`);
}

export function createProduct(organizationId: string, input: { name: string; description?: string; categoryId?: string }) {
  return callNaPista<Product>("POST", `/organizations/${organizationId}/products`, input);
}

export function updateProduct(
  organizationId: string,
  productId: string,
  patch: { name?: string; description?: string | null; categoryId?: string | null; status?: "ACTIVE" | "ARCHIVED" },
) {
  return callNaPista<Product>("PATCH", `/organizations/${organizationId}/products/${productId}`, patch);
}

export function archiveProduct(organizationId: string, productId: string) {
  return callNaPista<Product>("DELETE", `/organizations/${organizationId}/products/${productId}`);
}
