"use client";

import { getSupabaseClient } from "../supabase/client";
import { ApiError, notifySessionExpired, parseErrorResponse } from "./errors";

const BASE = process.env.NEXT_PUBLIC_PLATFORM_API_URL;

export interface PlatformMembership {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  roleKey: "OWNER" | "ADMIN" | "MANAGER" | "STAFF";
  status: "active" | "invited" | "suspended";
}

export interface PlatformIdentity {
  userId: string;
  email?: string;
  memberships: PlatformMembership[];
}

/**
 * "Which organizations do I belong to" is a Platform concern
 * (memberships) — this UI resolves it the same way Na Pista's own
 * backend does (F19 ADR-012), never duplicating it locally.
 */
export async function fetchPlatformIdentity(): Promise<PlatformIdentity | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;

  const res = await fetch(`${BASE}/me`, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data as PlatformIdentity;
}

/**
 * F29: organization-level UL Platform calls made by the signed-in member
 * (Team, Credentials, Webhooks, environments, scopes, usage) — same
 * `ApiError` semantics as `callNaPista`. The Platform authorizes every call
 * with its own role permissions; this UI never decides access.
 */
export async function callPlatform<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    notifySessionExpired();
    throw new ApiError(401, "UNAUTHORIZED", "No active session", null);
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await parseErrorResponse(res);
    if (res.status === 401) notifySessionExpired();
    throw error;
  }
  const json = await res.json();
  return json.data as T;
}

export const PLATFORM_API_URL = BASE ?? "";
