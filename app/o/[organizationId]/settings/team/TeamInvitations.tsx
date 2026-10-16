"use client";

import { useState } from "react";
import { createInvitation, listInvitations, revokeInvitation, type OrganizationInvitation } from "../../../../../lib/api/platform";
import { describeError } from "../../../../../lib/errors";
import { useAsync } from "../../../../../lib/useAsync";
import { ROLE_LABELS, statusInfo } from "../../../../../lib/status";
import { Section } from "../../../../../components/patterns/Page";
import { Badge, DataTable } from "../../../../../components/ui/Data";
import { ErrorNotice } from "../../../../../components/ui/Feedback";
import { Field } from "../../../../../components/ui/Form";
import { Button } from "../../../../../components/ui/Button";
import { ConfirmDialog } from "../../../../../components/ui/Overlay";
import { useToast } from "../../../../../components/ui/Toast";

/** Where the invited person accepts (UL Client). No secret in it: the invitation is bound to the invited, verified email. */
export function invitationsUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_UL_CLIENT_URL?.replace(/\/+$/, "");
  return base ? `${base}/app/invitations` : null;
}

/**
 * ul-platform migration 0025 — invite by email (F29 gap closed). Shown to
 * members with `membership.create` (OWNER/ADMIN); only an OWNER may invite
 * an OWNER (the Platform enforces it). The person accepts in their Última
 * Linha account with that email; a pending invitation takes a place under
 * the plan's member limit (409 LIMIT_EXCEEDED when full).
 */
export function TeamInvitations({ organizationId, roleKey }: { organizationId: string; roleKey: string | undefined }) {
  const invitations = useAsync(() => listInvitations(organizationId), [organizationId]);
  const [email, setEmail] = useState("");
  const roles = roleKey === "OWNER" ? (["STAFF", "MANAGER", "ADMIN", "OWNER"] as const) : (["STAFF", "MANAGER", "ADMIN"] as const);
  const [inviteRole, setInviteRole] = useState<string>("STAFF");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [target, setTarget] = useState<OrganizationInvitation | null>(null);
  const toast = useToast();
  const acceptAt = invitationsUrl();
  const pending = (invitations.data ?? []).filter((i) => i.status === "pending");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const created = await createInvitation(organizationId, { email: email.trim(), roleKey: inviteRole });
      invitations.setData([created, ...(invitations.data ?? [])]);
      setEmail("");
      toast.success(`Convite criado para ${created.email}. Avisa a pessoa para o aceitar${acceptAt ? ` em ${acceptAt}` : " na sua conta Última Linha"}.`);
    } catch (error) {
      setFormError(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(invitation: OrganizationInvitation) {
    const updated = await revokeInvitation(organizationId, invitation.id);
    invitations.setData((invitations.data ?? []).map((i) => (i.id === invitation.id ? updated : i)));
    toast.success(`Convite de ${invitation.email} revogado.`);
  }

  return (
    <Section
      title="Convidar membro"
      description={
        <>
          A pessoa aceita o convite na sua conta Última Linha{acceptAt ? <> (<span className="break-all">{acceptAt}</span>)</> : null}, com sessão iniciada neste email, depois de o
          confirmar. O convite expira ao fim de 7 dias e ocupa um lugar no limite de utilizadores do plano enquanto estiver pendente.
        </>
      }
    >
      <form onSubmit={submit} className="row" style={{ alignItems: "flex-end", flexWrap: "wrap", gap: "var(--np-space-3)" }}>
        <Field label="Email" error={formError}>
          <input type="email" className="input" required autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.ao" />
        </Field>
        <Field label="Papel">
          <select className="select" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? "A enviar…" : "Enviar convite"}
        </Button>
      </form>

      {invitations.error ? (
        <ErrorNotice error={invitations.error} title="Não foi possível carregar os convites" />
      ) : (
        pending.length > 0 && (
          <DataTable
            rows={pending}
            rowKey={(i) => i.id}
            empty={{ title: "Sem convites pendentes." }}
            columns={[
              { key: "email", header: "Convite pendente", wrap: true, cell: (i) => <span className="break-all">{i.email}</span> },
              { key: "role", header: "Papel", cell: (i) => ROLE_LABELS[i.roleKey] ?? i.roleKey },
              { key: "status", header: "Estado", cell: (i) => <Badge tone={statusInfo("invitation", i.status).tone}>{statusInfo("invitation", i.status).label}</Badge> },
              { key: "expires", header: "Expira", cell: (i) => i.expiresAt.slice(0, 10) },
              {
                key: "actions",
                header: "Acções",
                srHeader: true,
                cell: (i) => (
                  <Button size="sm" variant="danger" onClick={() => setTarget(i)} aria-label={`Revogar o convite de ${i.email}`}>
                    Revogar
                  </Button>
                ),
              },
            ]}
          />
        )
      )}

      {target && (
        <ConfirmDialog
          open
          onClose={() => setTarget(null)}
          title="Revogar convite?"
          description={`${target.email} deixa de poder aceitar este convite. Podes enviar um novo a qualquer momento.`}
          confirmLabel="Revogar"
          onConfirm={() => revoke(target)}
        />
      )}
    </Section>
  );
}
