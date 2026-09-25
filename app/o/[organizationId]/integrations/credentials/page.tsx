"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { platformRoleCan } from "../../../../../lib/platformPermissions";
import { createApiKey, listApiKeys, listApplicationScopes, NA_PISTA_APPLICATION, revokeApiKey, type ApiKey, type CreatedApiKey } from "../../../../../lib/api/platform";
import { groupScopes } from "../../../../../lib/integration/scopes";
import { useAsync } from "../../../../../lib/useAsync";
import { statusInfo } from "../../../../../lib/status";
import { useOrganizationTimezone } from "../../../../../lib/appointments/components";
import { localDateTime } from "../../../../../lib/datetime";
import { PageHeader, Section } from "../../../../../components/patterns/Page";
import { Badge, CopyButton, DataTable } from "../../../../../components/ui/Data";
import { Alert, ErrorNotice, PermissionDenied, Skeleton } from "../../../../../components/ui/Feedback";
import { Button } from "../../../../../components/ui/Button";
import { ConfirmDialog, Modal } from "../../../../../components/ui/Overlay";
import { Field } from "../../../../../components/ui/Form";
import { useToast } from "../../../../../components/ui/Toast";

function withoutSecret(key: CreatedApiKey): ApiKey {
  return { id: key.id, application: key.application, organizationId: key.organizationId, status: key.status, createdAt: key.createdAt, expiresAt: key.expiresAt, revokedAt: key.revokedAt, scopes: key.scopes };
}

function formatDate(iso: string | null, timezone: string | null) {
  if (!iso) return "—";
  return timezone ? localDateTime(iso, timezone) : iso.slice(0, 16).replace("T", " ") + " UTC";
}

/**
 * F29 Credentials — UL Platform API keys of this organization for the
 * NA_PISTA application. List/create/revoke through the real Platform API
 * (read: OWNER/ADMIN, manage: OWNER — the Platform enforces it). The
 * secret exists only in the create response: it is shown once in a
 * dialog, never stored by this UI (no state survives closing the dialog,
 * nothing is written to storage). No "last used" (the Platform
 * deliberately does not track it) and no per-environment keys (keys are
 * not environment-scoped) — both stated, not faked.
 */
export default function CredentialsPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === org)?.roleKey;
  const canRead = platformRoleCan(roleKey, "api_key.read");
  const canManage = platformRoleCan(roleKey, "api_key.manage");
  const tz = useOrganizationTimezone(org);
  const toast = useToast();

  const keys = useAsync(async () => (await listApiKeys(org)).filter((k) => k.application === NA_PISTA_APPLICATION), [org], { enabled: canRead });
  const scopes = useAsync(listApplicationScopes, []);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Credenciais" breadcrumbs={[{ label: "Integrações", href: `/o/${org}/integrations` }, { label: "Credenciais" }]} />
        <PermissionDenied action="Só Proprietários e Administradores podem ver as credenciais desta organização (permissão api_key.read da UL Platform)." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Credenciais"
        description="Credenciais de serviço para integrações (a tua própria interface, automações). Cada credencial pertence só a esta organização."
        breadcrumbs={[{ label: "Integrações", href: `/o/${org}/integrations` }, { label: "Credenciais" }]}
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Nova credencial
            </Button>
          ) : undefined
        }
      />

      {!canManage && (
        <Alert tone="info" title="Só leitura">
          Apenas o Proprietário da organização pode criar ou revogar credenciais.
        </Alert>
      )}

      <Section title="Credenciais da Na Pista">
        {keys.error ? (
          <ErrorNotice error={keys.error} />
        ) : (
          <DataTable
            rows={keys.data}
            rowKey={(k) => k.id}
            empty={{ title: "Ainda não existem credenciais.", description: canManage ? "Cria uma credencial com catalog.read/catalog.write para ligar a tua própria interface." : undefined }}
            columns={[
              { key: "id", header: "Identificador", cell: (k) => <code className="mono">ulk_{k.id.slice(0, 8)}…</code> },
              { key: "status", header: "Estado", cell: (k) => <Badge tone={statusInfo("credential", k.status).tone}>{statusInfo("credential", k.status).label}</Badge> },
              { key: "scopes", header: "Âmbitos", wrap: true, cell: (k) => (k.scopes.length ? k.scopes.map((s) => <code key={s} className="mono" style={{ marginRight: 6 }}>{s}</code>) : <span className="subtle">nenhum</span>) },
              { key: "created", header: "Criada", cell: (k) => formatDate(k.createdAt, tz.timezone) },
              { key: "expires", header: "Expira", cell: (k) => formatDate(k.expiresAt, tz.timezone) },
              {
                key: "actions",
                header: "Acções",
                srHeader: true,
                cell: (k) =>
                  canManage && k.status === "ACTIVE" ? (
                    <Button size="sm" variant="danger" onClick={() => setRevoking(k)}>
                      Revogar
                    </Button>
                  ) : null,
              },
            ]}
          />
        )}
        <p className="result-limit">
          Último uso: não disponível (a UL Platform não regista a última utilização das credenciais). Ambiente: as credenciais não estão associadas a um ambiente —
          valem para a API a que forem apresentadas.
        </p>
      </Section>

      <Section title="Âmbitos (scopes)" description="Lista real de âmbitos que a UL Platform permite para credenciais da Na Pista, com o que cada um desbloqueia na Na Pista API.">
        {scopes.error ? (
          <ErrorNotice error={scopes.error} />
        ) : !scopes.data ? (
          <Skeleton height={80} />
        ) : (
          <div className="stack">
            {groupScopes(scopes.data.scopes).map((group) => (
              <div key={group.domain} className="card">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{group.label}</div>
                <ul className="stack-sm" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {group.scopes.map((s) => (
                    <li key={s.key}>
                      <code className="mono">{s.key}</code> <span className="muted">— {s.description}</span>
                      <div className="subtle" style={{ fontSize: 12 }}>
                        {s.usage}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>

      {canManage && creating && (
        <CreateCredentialDialog
          organizationId={org}
          availableScopes={scopes.data?.scopes.map((s) => s.key) ?? []}
          onClose={() => setCreating(false)}
          onCreated={(key) => {
            setCreating(false);
            setCreated(key);
            // The list keeps metadata only — the secret lives solely in the one-time dialog state.
            keys.setData([...(keys.data ?? []), withoutSecret(key)]);
          }}
        />
      )}

      <Modal
        open={created !== null}
        onClose={() => setCreated(null)}
        title="Credencial criada"
        description="Este segredo só será mostrado uma vez. Copia-o agora e guarda-o num local seguro (gestor de segredos). Se o perderes, revoga esta credencial e cria outra."
        footer={
          <Button variant="primary" onClick={() => setCreated(null)}>
            Já guardei o segredo
          </Button>
        }
      >
        {created && (
          <div className="stack-sm">
            <div className="secret-box">
              <code data-testid="credential-secret">{created.secret}</code>
              <CopyButton value={created.secret} />
            </div>
            <span className="subtle" style={{ fontSize: 12 }}>
              Usa-o como <code className="mono">Authorization: Bearer &lt;segredo&gt;</code>. Âmbitos: {created.scopes.join(", ") || "nenhum"}.
            </span>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Revogar credencial?"
        description="Qualquer integração que use esta credencial deixa de funcionar imediatamente. A revogação não pode ser desfeita."
        confirmLabel="Revogar"
        onConfirm={async () => {
          if (!revoking) return;
          const updated = await revokeApiKey(org, revoking.id);
          keys.setData((keys.data ?? []).map((k) => (k.id === updated.id ? { ...k, ...updated } : k)));
          toast.success("Credencial revogada.");
        }}
      >
        {revoking && revoking.scopes.some((s) => s === "usage.write" || s === "event.publish") && (
          <Alert tone="warning" title="Credencial de plataforma">
            Esta credencial tem âmbitos usados pelo próprio servidor Na Pista para falar com a UL Platform (subscrição/utilização). Se for a credencial registada no servidor, os
            módulos desta organização deixam de responder até ser registada outra.
          </Alert>
        )}
      </ConfirmDialog>
    </div>
  );
}

function CreateCredentialDialog({ organizationId, availableScopes, onClose, onCreated }: { organizationId: string; availableScopes: string[]; onClose: () => void; onCreated: (key: CreatedApiKey) => void }) {
  const [selected, setSelected] = useState<string[]>(["catalog.read"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onCreated(await createApiKey(organizationId, { scopes: selected, ...(expiresAt ? { expiresAt: new Date(`${expiresAt}T23:59:59Z`).toISOString() } : {}) }));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Nova credencial" description="Escolhe só os âmbitos de que a integração precisa (menor privilégio).">
      <form onSubmit={submit}>
        <fieldset style={{ border: 0, padding: 0, margin: "0 0 var(--np-space-3)" }}>
          <legend className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
            Âmbitos
          </legend>
          {availableScopes.length === 0 && <Skeleton height={40} />}
          {availableScopes.map((scope) => (
            <label key={scope} className="checkbox-row" style={{ marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={selected.includes(scope)}
                onChange={(e) => setSelected((current) => (e.target.checked ? [...current, scope] : current.filter((s) => s !== scope)))}
              />
              <code className="mono">{scope}</code>
            </label>
          ))}
        </fieldset>
        <Field label="Expira em (opcional)" hint="Sem data, a credencial não expira — revoga-a quando deixar de ser usada.">
          <input id="credential-expires" type="date" className="input" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </Field>
        {error ? <ErrorNotice error={error} /> : null}
        <div className="modal-footer">
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={selected.length === 0}>
            Criar credencial
          </Button>
        </div>
      </form>
    </Modal>
  );
}
