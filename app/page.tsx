"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../lib/session/SessionContext";
import { ROLE_LABELS } from "../lib/status";
import { Button } from "../components/ui/Button";
import { EmptyState, Skeleton } from "../components/ui/Feedback";

/** Organization picker — the only page outside an organization. Each organization opens its Overview. */
export default function HomePage() {
  const { loading, authenticated, identity, signOut } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !authenticated) router.replace("/login");
  }, [loading, authenticated, router]);

  if (loading) {
    return (
      <main className="container" role="status" aria-live="polite">
        <span className="sr-only">A carregar…</span>
        <Skeleton width={220} height={22} />
      </main>
    );
  }
  if (!authenticated || !identity) return null;

  const activeMemberships = identity.memberships.filter((m) => m.status === "active");

  return (
    <main className="container" style={{ maxWidth: 720 }}>
      <div className="row" style={{ marginBottom: "var(--np-space-6)" }}>
        <span className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-sm.png" alt="" width={22} height={26} />
          Na Pista
        </span>
        <span className="spacer" />
        <span className="subtle truncate" style={{ maxWidth: 240 }}>
          {identity.email}
        </span>
        <Button size="sm" onClick={signOut}>
          Sair
        </Button>
      </div>

      <h1 style={{ fontSize: 22, marginBottom: "var(--np-space-4)" }}>As tuas organizações</h1>

      {activeMemberships.length === 0 ? (
        <EmptyState title="Sem organizações" description={`${identity.email ?? "Esta conta"} está autenticado, mas não é membro de nenhuma organização. Pede a um administrador para te adicionar.`} />
      ) : (
        <ul className="stack-sm" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {activeMemberships.map((m) => (
            <li key={m.membershipId}>
              <Link href={`/o/${m.organizationId}`} className="card row" style={{ color: "inherit" }}>
                <span className="truncate" style={{ flex: 1, fontWeight: 500 }}>
                  {m.organizationName}
                </span>
                <span className="badge">{ROLE_LABELS[m.roleKey] ?? m.roleKey}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
