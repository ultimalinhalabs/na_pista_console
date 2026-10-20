import { callNaPista } from "./naPistaClient";
import type { OrganizationModules } from "./types";

/** Audit 2026-10-20 (Na Pista ADR-070) — which modules the organization's plan enables. Display only: the API refuses the rest anyway. */
export function getOrganizationModules(organizationId: string) {
  return callNaPista<OrganizationModules>("GET", `/organizations/${organizationId}/modules`);
}
