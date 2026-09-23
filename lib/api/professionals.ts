import { callNaPista } from "./naPistaClient";
import type { AssociatedService, Professional } from "./types";

export function listProfessionals(organizationId: string, filters: { status?: "ACTIVE" | "ARCHIVED"; q?: string; serviceId?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  if (filters.serviceId) params.set("serviceId", filters.serviceId);
  const qs = params.toString();
  return callNaPista<Professional[]>("GET", `/organizations/${organizationId}/professionals${qs ? `?${qs}` : ""}`);
}

export function getProfessional(organizationId: string, professionalId: string) {
  return callNaPista<Professional>("GET", `/organizations/${organizationId}/professionals/${professionalId}`);
}

export function createProfessional(organizationId: string, input: { name: string; description?: string; phone?: string; email?: string }) {
  return callNaPista<Professional>("POST", `/organizations/${organizationId}/professionals`, input);
}

export function updateProfessional(
  organizationId: string,
  professionalId: string,
  patch: { name?: string; description?: string | null; phone?: string | null; email?: string | null; status?: "ACTIVE" | "ARCHIVED" },
) {
  return callNaPista<Professional>("PATCH", `/organizations/${organizationId}/professionals/${professionalId}`, patch);
}

/** ADR-037: the Services this Professional is associated with — never a raw FK on either side. */
export function listServicesForProfessional(organizationId: string, professionalId: string) {
  return callNaPista<AssociatedService[]>("GET", `/organizations/${organizationId}/professionals/${professionalId}/services`);
}

export function associateService(organizationId: string, professionalId: string, serviceId: string) {
  return callNaPista<{ id: string; professionalId: string; serviceId: string; createdAt: string }>(
    "POST",
    `/organizations/${organizationId}/professionals/${professionalId}/services/${serviceId}`,
  );
}

export function removeServiceAssociation(organizationId: string, professionalId: string, serviceId: string) {
  return callNaPista<{ removed: true }>("DELETE", `/organizations/${organizationId}/professionals/${professionalId}/services/${serviceId}`);
}
