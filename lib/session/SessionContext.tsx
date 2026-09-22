"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabaseClient } from "../supabase/client";
import { fetchPlatformIdentity, type PlatformIdentity } from "../api/platformClient";

interface SessionState {
  loading: boolean;
  authenticated: boolean;
  identity: PlatformIdentity | null;
  refreshIdentity: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [identity, setIdentity] = useState<PlatformIdentity | null>(null);

  async function refreshIdentity() {
    const result = await fetchPlatformIdentity();
    setIdentity(result);
    setAuthenticated(result !== null);
  }

  useEffect(() => {
    const supabase = getSupabaseClient();
    refreshIdentity().finally(() => setLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      refreshIdentity();
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await getSupabaseClient().auth.signOut();
    setIdentity(null);
    setAuthenticated(false);
  }

  return (
    <SessionContext.Provider value={{ loading, authenticated, identity, refreshIdentity, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
