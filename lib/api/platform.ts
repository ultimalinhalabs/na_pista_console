import { callPlatform } from "./platformClient";

/**
 * F29: typed wrappers for the organization-level UL Platform contracts the
 * Console surfaces. Shapes verified against ul-platform source
 * (modules/apiKeys, webhooks, serviceScopes, environments, endpoints,
 * memberships, organizations, usage). The Console never sees a secret hash
 * or encrypted secret — the Platform never returns them.
 */

export const NA_PISTA_APPLICATION = "NA_PISTA";

export interface ApiKey {
  id: string;
  application: string;
  organizationId: string | null;
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  scopes: string[];
}

/** Returned by create ONLY — the secret exists in this one response and is never retrievable again. */
export interface CreatedApiKey extends ApiKey {
  secret: string;
}

export interface ServiceScope {
  key: string;
  description: string;
}

export interface WebhookEndpoint {
  id: string;
  application: string;
  organizationId: string;
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
  revokedAt: string | null;
  eventTypes: string[];
}

export interface CreatedWebhookEndpoint extends WebhookEndpoint {
  /** HMAC signing secret — shown once. */
  secret: string;
}

export interface WebhookTestResult {
  status: "SUCCESS" | "FAILED";
  responseStatus: number | null;
}

export interface ApplicationEnvironment {
  application: string;
  key: string;
  status: string;
}

export interface EnvironmentEndpoint {
  type: string;
  baseUrl: string;
  status: string;
}

export interface OrganizationMember {
  membershipId: string;
  userId: string;
  userEmail: string | null;
  roleKey: "OWNER" | "ADMIN" | "MANAGER" | "STAFF";
  status: "active" | "invited" | "suspended";
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeterUsage {
  meterKey?: string;
  quantity: number;
  period?: { from: string | null; to: string | null };
}

// ---- credentials (api_key.read / api_key.manage) ----
export function listApiKeys(organizationId: string) {
  return callPlatform<ApiKey[]>("GET", `/organizations/${organizationId}/api-keys`);
}
export function createApiKey(organizationId: string, input: { scopes: string[]; expiresAt?: string }) {
  return callPlatform<CreatedApiKey>("POST", `/organizations/${organizationId}/api-keys`, { applicationKey: NA_PISTA_APPLICATION, ...input });
}
export function revokeApiKey(organizationId: string, keyId: string) {
  return callPlatform<ApiKey>("POST", `/organizations/${organizationId}/api-keys/${keyId}/revoke`);
}

// ---- scopes (any authenticated user) ----
export function listApplicationScopes() {
  return callPlatform<{ application: { key: string; name: string }; scopes: ServiceScope[] }>("GET", `/applications/${NA_PISTA_APPLICATION}/service-scopes`);
}

// ---- environments (any authenticated user; managed by platform admins only) ----
export function listEnvironments() {
  return callPlatform<ApplicationEnvironment[]>("GET", `/applications/${NA_PISTA_APPLICATION}/environments`);
}
export function listEnvironmentEndpoints(environmentKey: string) {
  return callPlatform<EnvironmentEndpoint[]>("GET", `/applications/${NA_PISTA_APPLICATION}/environments/${environmentKey}/endpoints`);
}

// ---- webhooks (webhook.read / webhook.manage) ----
export function listWebhooks(organizationId: string) {
  return callPlatform<WebhookEndpoint[]>("GET", `/organizations/${organizationId}/webhooks`);
}
export function createWebhook(organizationId: string, input: { url: string; eventTypes: string[] }) {
  return callPlatform<CreatedWebhookEndpoint>("POST", `/organizations/${organizationId}/webhooks`, { applicationKey: NA_PISTA_APPLICATION, ...input });
}
export function revokeWebhook(organizationId: string, webhookId: string) {
  return callPlatform<WebhookEndpoint>("POST", `/organizations/${organizationId}/webhooks/${webhookId}/revoke`);
}
export function testWebhook(organizationId: string, webhookId: string) {
  return callPlatform<WebhookTestResult>("POST", `/organizations/${organizationId}/webhooks/${webhookId}/test`);
}

// ---- organization & team ----
export function getOrganization(organizationId: string) {
  return callPlatform<Organization>("GET", `/organizations/${organizationId}`);
}
export function updateOrganization(organizationId: string, input: { name: string }) {
  return callPlatform<Organization>("PATCH", `/organizations/${organizationId}`, input);
}
export function listMembers(organizationId: string) {
  return callPlatform<OrganizationMember[]>("GET", `/organizations/${organizationId}/memberships`);
}
export function updateMember(organizationId: string, membershipId: string, input: { roleKey?: string; status?: "active" | "suspended" }) {
  return callPlatform<OrganizationMember>("PATCH", `/organizations/${organizationId}/memberships/${membershipId}`, input);
}
export function removeMember(organizationId: string, membershipId: string) {
  return callPlatform<unknown>("DELETE", `/organizations/${organizationId}/memberships/${membershipId}`);
}

// ---- usage (usage.read) ----
export function getApiRequestUsage(organizationId: string) {
  return callPlatform<MeterUsage>("GET", `/organizations/${organizationId}/applications/${NA_PISTA_APPLICATION}/usage/api_requests`);
}
