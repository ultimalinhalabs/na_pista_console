"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../lib/session/SessionContext";

export default function HomePage() {
  const { loading, authenticated, identity, signOut } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !authenticated) router.replace("/login");
  }, [loading, authenticated, router]);

  if (loading) return <div className="container">A carregar…</div>;
  if (!authenticated || !identity) return null;

  const activeMemberships = identity.memberships.filter((m) => m.status === "active");

  return (
    <div className="container">
      <div className="topbar" style={{ marginBottom: 24 }}>
        <span className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-sm.png" alt="" width={22} height={26} />
          Na Pista
        </span>
        <button className="btn" onClick={signOut}>
          Sair
        </button>
      </div>

      <h1 style={{ fontSize: 20 }}>As tuas organizações</h1>

      {activeMemberships.length === 0 ? (
        <div className="empty-state card">
          {identity.email} está autenticado, mas não é membro de nenhuma organização. Pede a um administrador para
          te adicionar.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {activeMemberships.map((m) => (
            <Link key={m.membershipId} href={`/o/${m.organizationId}/products`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{m.organizationName}</span>
                <span className="badge">{m.roleKey}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
