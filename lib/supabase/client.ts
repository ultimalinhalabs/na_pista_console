"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Browser-only Supabase client — anon key + URL only (CLAUDE.md §6/§11).
 * Session persistence uses supabase-js's own default (localStorage) —
 * this UI is deliberately client-rendered only (no SSR cookie refresh
 * pipeline like ul-client's `proxy.ts`); a documented simplification for
 * F20's scope, not a security shortcut: authorization is still decided
 * exclusively server-side by Na Pista and the Platform (§2/§22).
 */
let client: ReturnType<typeof createClient> | undefined;

export function getSupabaseClient() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set");
    }
    client = createClient(url, anonKey);
  }
  return client;
}
