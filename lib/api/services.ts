import { callNaPista } from "./naPistaClient";
import type { Service } from "./types";

export function listServices(organizationId: string, filters: { status?: "ACTIVE" | "ARCHIVED"; q?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return callNaPista<Service[]>("GET", `/organizations/${organizationId}/services${qs ? `?${qs}` : ""}`);
}

export function getService(organizationId: string, serviceId: string) {
  return callNaPista<Service>("GET", `/organizations/${organizationId}/services/${serviceId}`);
}

/** durationMinutes is a plain number — never a decimal string, unlike price (ADR-034). */
export function createService(organizationId: string, input: { name: string; description?: string; durationMinutes: number; price?: number | string }) {
  return callNaPista<Service>("POST", `/organizations/${organizationId}/services`, input);
}

export function updateService(
  organizationId: string,
  serviceId: string,
  patch: { name?: string; description?: string | null; durationMinutes?: number; price?: number | string | null; status?: "ACTIVE" | "ARCHIVED" },
) {
  return callNaPista<Service>("PATCH", `/organizations/${organizationId}/services/${serviceId}`, patch);
}
