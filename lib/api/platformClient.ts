"use client";

import { getSupabaseClient } from "../supabase/client";

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
