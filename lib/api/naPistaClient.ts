"use client";

import { getSupabaseClient } from "../supabase/client";
import { ApiError, notifySessionExpired, parseErrorResponse } from "./errors";

const BASE = process.env.NEXT_PUBLIC_NA_PISTA_API_URL;

/**
 * Every call carries the caller's own Supabase session token — this UI
 * never invents authorization, never decides what a user may do; Na
 * Pista's own server-side pipeline (auth -> tenant -> permission ->
 * entitlement) is the only real gate (F20 brief §2/§22). A 401 here means
 * the session itself is invalid/expired; callers should sign the user out.
 */
async function requestNaPista(method: string, path: string, body?: unknown): Promise<{ data: unknown; pagination?: Pagination }> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    notifySessionExpired();
    throw new ApiError(401, "UNAUTHORIZED", "No active session", null);
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await parseErrorResponse(res);
    if (res.status === 401) notifySessionExpired();
    throw error;
  }
  return res.json();
}

export async function callNaPista<T>(method: string, path: string, body?: unknown): Promise<T> {
  const json = await requestNaPista(method, path, body);
  return json.data as T;
}

/** Na Pista API pagination (ADR-051) — present on every paginated list response. */
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** A paginated list: the rows of one page plus the server's tenant-scoped totals. */
export async function callNaPistaPage<T>(path: string): Promise<{ data: T[]; pagination: Pagination }> {
  const json = await requestNaPista("GET", path);
  return { data: json.data as T[], pagination: json.pagination as Pagination };
}
