/**
 * UX-ONLY mirror of the UL Platform role → permission map for the
 * organization-level Platform capabilities the Console surfaces (Team,
 * Credentials, Webhooks, subscription/usage visibility). Source of truth:
 * `ul-platform/src/db/seed/data.ts` ROLE_PERMISSIONS (verified in F29).
 * This decides only what to SHOW; the Platform API enforces the real rule
 * and its 403 is always handled (same posture as lib/permissions.ts).
 */
const PLATFORM_ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: [
    "organization.read", "organization.update",
    "membership.read", "membership.create", "membership.update", "membership.remove",
    "subscription.read", "entitlement.read", "usage.read",
    "api_key.read", "api_key.manage",
    "webhook.read", "webhook.manage",
  ],
  ADMIN: [
    "organization.read", "organization.update",
    "membership.read", "membership.create", "membership.update", "membership.remove",
    "subscription.read", "entitlement.read", "usage.read",
    "api_key.read",
    "webhook.read",
  ],
  MANAGER: ["organization.read", "membership.read", "subscription.read", "entitlement.read", "usage.read"],
  STAFF: ["organization.read", "membership.read"],
};

export function platformRoleCan(roleKey: string | undefined, permission: string): boolean {
  if (!roleKey) return false;
  return (PLATFORM_ROLE_PERMISSIONS[roleKey] ?? []).includes(permission);
}
