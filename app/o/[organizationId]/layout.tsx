"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "../../../lib/session/SessionContext";
import { AppShell } from "../../../components/shell/AppShell";
import { ToastProvider } from "../../../components/ui/Toast";
import { Skeleton } from "../../../components/ui/Feedback";

/**
 * The `:organizationId` route segment is never trusted by itself (F20
 * brief §2/§22, same posture ul-client's own OrganizationGate documents):
 * every page under /o/[organizationId]/* sits behind this gate, which
 * cross-checks it against the caller's REAL memberships (Platform
 * GET /v1/me, via useSession) before rendering anything. This is UX, not
 * security — Na Pista's own server-side pipeline is the real gate; a
 * bypass of this component would still get a 403 from the API.
 *
 * F29: renders the control-plane shell (sidebar, org switcher, command
 * menu, user menu, mobile drawer) around every organization page.
 */
export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
  const { loading, authenticated, identity, signOut } = useSession();
  const params = useParams<{ organizationId: string }>();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !authenticated) router.replace("/login");
  }, [loading, authenticated, router]);

  if (loading) {
    return (
      <div className="container" role="status" aria-live="polite">
        <span className="sr-only">A carregar…</span>
        <Skeleton width={180} height={20} />
      </div>
    );
  }
  if (!authenticated || !identity) return null;

  const membership = identity.memberships.find((m) => m.organizationId === params.organizationId && m.status === "active");

  if (!membership) {
    return (
      <div className="container">
        <div className="empty">
          <div className="empty-title">Sem acesso a esta organização</div>
          <div className="empty-description">Não tens acesso a esta organização (ou ela não existe).</div>
          <Link href="/">Voltar às tuas organizações</Link>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AppShell organizationId={params.organizationId} identity={identity} membership={membership} onSignOut={signOut}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
