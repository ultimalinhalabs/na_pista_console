"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { SESSION_EXPIRED_EVENT } from "../../lib/api/errors";
import type { PlatformIdentity, PlatformMembership } from "../../lib/api/platformClient";
import { activeNavPath, visibleNav } from "../../lib/navigation";
import { ROLE_LABELS } from "../../lib/status";
import { Drawer } from "../ui/Overlay";
import { Dropdown } from "../ui/Menu";
import { CommandMenu } from "./CommandMenu";

const NA_PISTA_API_URL = process.env.NEXT_PUBLIC_NA_PISTA_API_URL ?? "";

/** What environment this Console instance talks to — derived from its configured API URL, never assumed. */
export function environmentLabel(apiUrl: string = NA_PISTA_API_URL): string | null {
  try {
    const host = new URL(apiUrl).hostname;
    if (host === "localhost" || host === "127.0.0.1") return "Local";
    if (host.includes("staging")) return "Staging";
    return null;
  } catch {
    return null;
  }
}

function Sidebar({ organizationId, membership, memberships, onNavigate }: { organizationId: string; membership: PlatformMembership; memberships: PlatformMembership[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = activeNavPath(pathname, organizationId);
  const base = `/o/${organizationId}`;
  const env = environmentLabel();
  return (
    <nav className="sidebar" aria-label="Navegação principal">
      <div className="row" style={{ padding: "var(--np-space-2)" }}>
        <Link href={base} className="brand" onClick={onNavigate}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark-sm.png" alt="" width={20} height={24} />
          Na Pista
        </Link>
        {env && <span className="badge" title={`API: ${NA_PISTA_API_URL}`}>{env}</span>}
      </div>
      <OrganizationSwitcher current={membership} memberships={memberships} />
      {visibleNav(membership.roleKey).map((group, index) => (
        <div key={group.label ?? `group-${index}`}>
          {group.label && <div className="sidebar-group-label">{group.label}</div>}
          {group.items.map((item) => (
            <Link key={item.path} href={`${base}${item.path}`} className="sidebar-link" aria-current={active === item.path ? "page" : undefined} onClick={onNavigate}>
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

function OrganizationSwitcher({ current, memberships }: { current: PlatformMembership; memberships: PlatformMembership[] }) {
  const router = useRouter();
  const others = memberships.filter((m) => m.status === "active" && m.organizationId !== current.organizationId);
  return (
    <Dropdown
      align="left"
      label="Mudar de organização"
      trigger={
        <span className="stack-sm" style={{ gap: 0, textAlign: "left", maxWidth: 180 }}>
          <span className="truncate" style={{ fontWeight: 600 }}>
            {current.organizationName}
          </span>
          <span className="subtle" style={{ fontSize: 12 }}>
            {ROLE_LABELS[current.roleKey] ?? current.roleKey}
          </span>
        </span>
      }
    >
      <div className="dropdown-label">Organizações</div>
      {others.map((m) => (
        <button key={m.organizationId} type="button" role="menuitem" className="dropdown-item" onClick={() => router.push(`/o/${m.organizationId}`)}>
          <span className="truncate" style={{ flex: 1 }}>
            {m.organizationName}
          </span>
          <span className="subtle" style={{ fontSize: 12 }}>
            {ROLE_LABELS[m.roleKey] ?? m.roleKey}
          </span>
        </button>
      ))}
      {others.length === 0 && <div className="dropdown-label">Não pertences a outras organizações.</div>}
      <div className="dropdown-separator" />
      <button type="button" role="menuitem" className="dropdown-item" onClick={() => router.push("/")}>
        Ver todas as organizações
      </button>
    </Dropdown>
  );
}

function UserMenu({ email, onSignOut }: { email?: string; onSignOut: () => void }) {
  return (
    <Dropdown label="Menu do utilizador" trigger={<span className="truncate" style={{ maxWidth: 180 }}>{email ?? "Conta"}</span>}>
      {email && <div className="dropdown-label">Sessão iniciada como {email}</div>}
      <div className="dropdown-separator" />
      <button type="button" role="menuitem" className="dropdown-item" onClick={onSignOut}>
        Terminar sessão
      </button>
    </Dropdown>
  );
}

/**
 * F29 organization shell: sidebar (desktop) / drawer (mobile), org switcher,
 * environment indicator, header with command menu trigger and user menu.
 * Membership gating stays in the layout (it decides whether to render this).
 */
export function AppShell({
  organizationId,
  identity,
  membership,
  onSignOut,
  children,
}: {
  organizationId: string;
  identity: PlatformIdentity;
  membership: PlatformMembership;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function onExpired() {
      await onSignOut();
      router.replace("/login?expired=1");
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [onSignOut, router]);

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <div className="shell">
      <Sidebar organizationId={organizationId} membership={membership} memberships={identity.memberships} />
      <div className="shell-main">
        <header className="shell-header">
          <button type="button" className="btn btn-ghost btn-icon shell-mobile-only" aria-label="Abrir navegação" onClick={() => setDrawerOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button type="button" className="search-trigger" onClick={() => setCommandOpen(true)} aria-label="Abrir menu de comandos">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="search-trigger-label">Procurar…</span>
            <span className="spacer" />
            <span className="kbd">{isMac ? "⌘" : "Ctrl"} K</span>
          </button>
          <span className="spacer" />
          <UserMenu email={identity.email} onSignOut={onSignOut} />
        </header>
        <main className="shell-content" id="conteudo">
          {children}
        </main>
      </div>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Navegação">
        <Sidebar organizationId={organizationId} membership={membership} memberships={identity.memberships} onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
      <CommandMenu organizationId={organizationId} roleKey={membership.roleKey} open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
