"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { platformRoleCan } from "../../../../../lib/platformPermissions";
import { listMembers, removeMember, updateMember, type OrganizationMember } from "../../../../../lib/api/platform";
import { useAsync } from "../../../../../lib/useAsync";
import { ROLE_LABELS, statusInfo } from "../../../../../lib/status";
import { PageHeader, Section } from "../../../../../components/patterns/Page";
import { Badge, DataTable } from "../../../../../components/ui/Data";
import { Alert, ErrorNotice, PermissionDenied } from "../../../../../components/ui/Feedback";
import { Button } from "../../../../../components/ui/Button";
import { ConfirmDialog } from "../../../../../components/ui/Overlay";
import { useToast } from "../../../../../components/ui/Toast";

const ROLES = ["OWNER", "ADMIN", "MANAGER", "STAFF"] as const;

type PendingChange =
  | { kind: "role"; member: OrganizationMember; roleKey: string }
  | { kind: "status"; member: OrganizationMember; status: "active" | "suspended" }
  | { kind: "remove"; member: OrganizationMember };

/**
 * F29 Team — the organization's UL Platform memberships (read: every
 * member; change role/status/remove: OWNER/ADMIN — the Platform enforces
 * it, including "never leave the organization without an active owner").
 * Adding members is not offered: the Platform API adds members by user id
 * only (no invite-by-email or user lookup exists) — recorded as a gap
 * rather than exposing a raw-UUID form to end users.
 */
export default function TeamPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const { identity, refreshIdentity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === org)?.roleKey;
  const canRead = platformRoleCan(roleKey, "membership.read");
  const canUpdate = platformRoleCan(roleKey, "membership.update");
  const canRemove = platformRoleCan(roleKey, "membership.remove");
  const members = useAsync(() => listMembers(org), [org], { enabled: canRead });
  const [pending, setPending] = useState<PendingChange | null>(null);
  const toast = useToast();

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Equipa" breadcrumbs={[{ label: "Definições" }, { label: "Equipa" }]} />
        <PermissionDenied />
      </div>
    );
  }

  async function apply(change: PendingChange) {
    if (change.kind === "remove") {
      await removeMember(org, change.member.membershipId);
      members.setData((members.data ?? []).filter((m) => m.membershipId !== change.member.membershipId));
      toast.success("Membro removido da organização.");
    } else {
      const updated = await updateMember(org, change.member.membershipId, change.kind === "role" ? { roleKey: change.roleKey } : { status: change.status });
      members.setData((members.data ?? []).map((m) => (m.membershipId === change.member.membershipId ? { ...m, ...updated } : m)));
      toast.success(change.kind === "role" ? "Papel actualizado." : change.status === "suspended" ? "Membro suspenso." : "Membro reactivado.");
    }
    if (change.member.userId === identity?.userId) await refreshIdentity();
  }

  const dialog = pending && {
    role: {
      title: "Alterar papel?",
      description: `${pending.member.userEmail ?? "Este membro"} passa a ${ROLE_LABELS[(pending as { roleKey?: string }).roleKey ?? ""] ?? ""}. As permissões mudam de imediato.`,
      confirmLabel: "Alterar papel",
      destructive: false,
    },
    status: {
      title: (pending as { status?: string }).status === "suspended" ? "Suspender membro?" : "Reactivar membro?",
      description: (pending as { status?: string }).status === "suspended" ? "O membro perde o acesso a esta organização até ser reactivado." : "O membro recupera o acesso com o papel actual.",
      confirmLabel: (pending as { status?: string }).status === "suspended" ? "Suspender" : "Reactivar",
      destructive: (pending as { status?: string }).status === "suspended",
    },
    remove: {
      title: "Remover membro?",
      description: `${pending.member.userEmail ?? "Este membro"} deixa de pertencer a esta organização. Para voltar, terá de ser adicionado de novo.`,
      confirmLabel: "Remover",
      destructive: true,
    },
  }[pending.kind];

  return (
    <div>
      <PageHeader title="Equipa" description="Membros desta organização e respectivos papéis na UL Platform." breadcrumbs={[{ label: "Definições" }, { label: "Equipa" }]} />
      {!canUpdate && (
        <Alert tone="info" title="Só leitura">
          Apenas Proprietários e Administradores podem alterar papéis ou remover membros.
        </Alert>
      )}
      <Section title="Membros">
        {members.error ? (
          <ErrorNotice error={members.error} />
        ) : (
          <DataTable
            rows={members.data}
            rowKey={(m) => m.membershipId}
            empty={{ title: "Sem membros." }}
            columns={[
              { key: "email", header: "Email", wrap: true, cell: (m) => <span className="break-all">{m.userEmail ?? m.userId}{m.userId === identity?.userId && <span className="subtle"> (tu)</span>}</span> },
              {
                key: "role",
                header: "Papel",
                cell: (m) =>
                  canUpdate ? (
                    <select
                      className="select"
                      aria-label={`Papel de ${m.userEmail ?? m.userId}`}
                      value={m.roleKey}
                      style={{ width: "auto" }}
                      onChange={(e) => setPending({ kind: "role", member: m, roleKey: e.target.value })}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ROLE_LABELS[m.roleKey] ?? m.roleKey
                  ),
              },
              { key: "status", header: "Estado", cell: (m) => <Badge tone={statusInfo("membership", m.status).tone}>{statusInfo("membership", m.status).label}</Badge> },
              {
                key: "actions",
                header: "Acções",
                srHeader: true,
                cell: (m) => (
                  <span className="row">
                    {canUpdate && m.status !== "invited" && (
                      <Button size="sm" onClick={() => setPending({ kind: "status", member: m, status: m.status === "suspended" ? "active" : "suspended" })}>
                        {m.status === "suspended" ? "Reactivar" : "Suspender"}
                      </Button>
                    )}
                    {canRemove && (
                      <Button size="sm" variant="danger" onClick={() => setPending({ kind: "remove", member: m })}>
                        Remover
                      </Button>
                    )}
                  </span>
                ),
              },
            ]}
          />
        )}
        <p className="result-limit">Adicionar membros: a UL Platform ainda não disponibiliza convites por email nem pesquisa de utilizadores — pede ao suporte da plataforma.</p>
      </Section>

      {pending && dialog && (
        <ConfirmDialog open onClose={() => setPending(null)} title={dialog.title} description={dialog.description} confirmLabel={dialog.confirmLabel} destructive={dialog.destructive} onConfirm={() => apply(pending)} />
      )}
    </div>
  );
}
