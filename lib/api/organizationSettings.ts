import { callNaPista } from "./naPistaClient";
import type { OrganizationSettings } from "./types";

/** `null` when the organization has never configured a timezone (ADR-040 "no silent fallback") — never a default row. */
export function getOrganizationSettings(organizationId: string) {
  return callNaPista<OrganizationSettings | null>("GET", `/organizations/${organizationId}/settings`);
}

export function updateOrganizationSettings(organizationId: string, timezone: string) {
  return callNaPista<OrganizationSettings>("PUT", `/organizations/${organizationId}/settings`, { timezone });
}
