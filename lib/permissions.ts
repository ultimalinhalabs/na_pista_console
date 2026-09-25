/**
 * UX-ONLY mirror of Na Pista's real, server-side permission map
 * (na-pista/src/authorization/permissions.ts). This file decides nothing
 * — it only decides what to SHOW. The real gate is server-side; hiding a
 * button here never substitutes for the 403 the API itself returns if
 * bypassed (F20 brief §2/§8/§22, same posture ul-client's own
 * PermissionGate already documents). Kept duplicated rather than fetched
 * from a `/capabilities` endpoint because Na Pista does not expose one
 * yet (F18 proposed it conceptually; not built in F20 — see
 * na-pista/docs/f20-report.md "Known limitations").
 */
const ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: [
    "products.read", "products.create", "products.update", "products.delete",
    "categories.read", "categories.create", "categories.update", "categories.delete",
    "customers.read", "customers.create", "customers.update", "customers.delete",
    "inventory.read", "inventory.create", "inventory.update",
    "orders.read", "orders.create", "orders.update",
    "services.read", "services.create", "services.update",
    "professionals.read", "professionals.create", "professionals.update",
    "scheduling.read", "scheduling.create", "scheduling.update",
    "appointments.read", "appointments.create", "appointments.update",
  ],
  ADMIN: [
    "products.read", "products.create", "products.update", "products.delete",
    "categories.read", "categories.create", "categories.update", "categories.delete",
    "customers.read", "customers.create", "customers.update", "customers.delete",
    "inventory.read", "inventory.create", "inventory.update",
    "orders.read", "orders.create", "orders.update",
    "services.read", "services.create", "services.update",
    "professionals.read", "professionals.create", "professionals.update",
    "scheduling.read", "scheduling.create", "scheduling.update",
    "appointments.read", "appointments.create", "appointments.update",
  ],
  MANAGER: [
    "products.read", "products.create", "products.update",
    "categories.read", "categories.create", "categories.update",
    "customers.read", "customers.create", "customers.update",
    "inventory.read", "inventory.create", "inventory.update",
    "orders.read", "orders.create", "orders.update",
    "services.read", "services.create", "services.update",
    "professionals.read", "professionals.create", "professionals.update",
    "scheduling.read", "scheduling.create", "scheduling.update",
    "appointments.read", "appointments.create", "appointments.update",
  ],
  STAFF: [
    "products.read", "categories.read", "customers.read", "inventory.read", "orders.read",
    "services.read", "professionals.read", "scheduling.read", "appointments.read",
  ],
};

export function roleCan(roleKey: string | undefined, permission: string): boolean {
  if (!roleKey) return false;
  return (ROLE_PERMISSIONS[roleKey] ?? []).includes(permission);
}

/** F29: read-only access to the mirror for the Permissions page (same data `roleCan` uses — never a second copy). */
export function rolePermissions(roleKey: string): readonly string[] {
  return ROLE_PERMISSIONS[roleKey] ?? [];
}
