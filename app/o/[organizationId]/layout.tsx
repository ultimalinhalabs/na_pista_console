"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "../../../lib/session/SessionContext";

/**
 * The `:organizationId` route segment is never trusted by itself (F20
 * brief §2/§22, same posture ul-client's own OrganizationGate documents):
 * every page under /o/[organizationId]/* sits behind this gate, which
 * cross-checks it against the caller's REAL memberships (Platform
 * GET /v1/me, via useSession) before rendering anything. This is UX, not
 * security — Na Pista's own server-side pipeline is the real gate; a
 * bypass of this component would still get a 403 from the API.
 */
export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
  const { loading, authenticated, identity } = useSession();
  const params = useParams<{ organizationId: string }>();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !authenticated) router.replace("/login");
  }, [loading, authenticated, router]);

  if (loading) return <div className="container">A carregar…</div>;
  if (!authenticated || !identity) return null;

  const membership = identity.memberships.find((m) => m.organizationId === params.organizationId && m.status === "active");

  if (!membership) {
    return (
      <div className="container">
        <div className="empty-state card">
          Não tens acesso a esta organização (ou ela não existe). <Link href="/">Voltar</Link>
        </div>
      </div>
    );
  }

  const base = `/o/${params.organizationId}`;
  const navItem = (href: string, match: string, label: string) => (
    <Link href={href} className={`nav-link${pathname.includes(match) ? " active" : ""}`}>
      {label}
    </Link>
  );
  return (
    <div>
      <div className="topbar">
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <Link href="/" className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mark-sm.png" alt="" width={22} height={26} />
            Na Pista
          </Link>
          <nav style={{ display: "flex", gap: 20 }}>
            {navItem(`${base}/products`, "/products", "Produtos")}
            {navItem(`${base}/categories`, "/categories", "Categorias")}
            {navItem(`${base}/inventory`, "/inventory", "Inventário")}
            {navItem(`${base}/customers`, "/customers", "Clientes")}
            {navItem(`${base}/orders`, "/orders", "Pedidos")}
          </nav>
        </div>
        <span className="badge">{membership.roleKey}</span>
      </div>
      <div className="container">{children}</div>
    </div>
  );
}
