"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { platformRoleCan } from "../../../../../lib/platformPermissions";
import { createWebhook, listWebhooks, NA_PISTA_APPLICATION, revokeWebhook, testWebhook, type CreatedWebhookEndpoint, type WebhookEndpoint } from "../../../../../lib/api/platform";
import { useAsync } from "../../../../../lib/useAsync";
import { statusInfo } from "../../../../../lib/status";
import { describeError } from "../../../../../lib/errors";
import { localDateTime } from "../../../../../lib/datetime";
import { useOrganizationTimezone } from "../../../../../lib/appointments/components";
import { PageHeader, Section } from "../../../../../components/patterns/Page";
import { Badge, CopyButton, DataTable } from "../../../../../components/ui/Data";
import { Alert, ErrorNotice, PermissionDenied } from "../../../../../components/ui/Feedback";
import { Button } from "../../../../../components/ui/Button";
import { ConfirmDialog, Modal } from "../../../../../components/ui/Overlay";
import { Field } from "../../../../../components/ui/Form";
import { useToast } from "../../../../../components/ui/Toast";

/** ADR-050's planned appointment catalog — offered as suggestions and clearly labelled "planeado": Na Pista does not publish them yet. */
const PLANNED_EVENTS = ["appointment.created", "appointment.rescheduled", "appointment.canceled", "appointment.completed", "appointment.no_show"];
const EVENT_TYPE = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

/**
 * F29 Webhooks — the organization's UL Platform webhook endpoints for
 * NA_PISTA (read: OWNER/ADMIN, manage: OWNER). Honest limits, verified in
 * ul-platform source: the list API returns neither the endpoint URL nor the
 * delivery history (deliveries are recorded but not readable), and Na Pista
 * does not publish business events yet — so only the synchronous "test"
 * delivery result can be shown.
 */
export default function WebhooksPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === org)?.roleKey;
  const canRead = platformRoleCan(roleKey, "webhook.read");
  const canManage = platformRoleCan(roleKey, "webhook.manage");
  const tz = useOrganizationTimezone(org);
  const toast = useToast();

  const webhooks = useAsync(async () => (await listWebhooks(org)).filter((w) => w.application === NA_PISTA_APPLICATION), [org], { enabled: canRead });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ endpoint: CreatedWebhookEndpoint; url: string } | null>(null);
  const [revoking, setRevoking] = useState<WebhookEndpoint | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  async function runTest(endpoint: WebhookEndpoint) {
    setTesting(endpoint.id);
    try {
      const result = await testWebhook(org, endpoint.id);
      const text = result.status === "SUCCESS" ? `Entregue (HTTP ${result.responseStatus ?? "?"})` : `Falhou${result.responseStatus ? ` (HTTP ${result.responseStatus})` : " (sem resposta)"}`;
      setTestResults((current) => ({ ...current, [endpoint.id]: text }));
      (result.status === "SUCCESS" ? toast.success : toast.error)(`Teste: ${text}`);
    } catch (err) {
      setTestResults((current) => ({ ...current, [endpoint.id]: describeError(err) }));
      toast.error(describeError(err));
    } finally {
      setTesting(null);
    }
  }

  const breadcrumbs = [{ label: "Integrações", href: `/o/${org}/integrations` }, { label: "Webhooks" }];
  if (!canRead) {
    return (
      <div>
        <PageHeader title="Webhooks" breadcrumbs={breadcrumbs} />
        <PermissionDenied action="Só Proprietários e Administradores podem ver os webhooks desta organização (permissão webhook.read da UL Platform)." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Webhooks"
        description="Endpoints HTTPS da tua organização que recebem eventos assinados (HMAC-SHA256) através da UL Platform."
        breadcrumbs={breadcrumbs}
        actions={
          canManage ? (
            <Button variant="primary" onClick={() => setCreating(true)}>
              Novo webhook
            </Button>
          ) : undefined
        }
      />

      <Alert tone="warning" title="A Na Pista ainda não publica eventos">
        A publicação de eventos de negócio (marcações) está planeada (ADR-050) mas ainda não existe. Neste momento um endpoint só recebe o evento de teste <code className="mono">webhook.test</code>.
      </Alert>

      <Section title="Endpoints">
        {webhooks.error ? (
          <ErrorNotice error={webhooks.error} />
        ) : (
          <DataTable
            rows={webhooks.data}
            rowKey={(w) => w.id}
            empty={{ title: "Ainda não existem webhooks." }}
            columns={[
              { key: "id", header: "Identificador", cell: (w) => <code className="mono">{w.id.slice(0, 8)}…</code> },
              { key: "status", header: "Estado", cell: (w) => <Badge tone={statusInfo("webhook", w.status).tone}>{statusInfo("webhook", w.status).label}</Badge> },
              { key: "events", header: "Eventos subscritos", wrap: true, cell: (w) => w.eventTypes.map((e) => <code key={e} className="mono" style={{ marginRight: 6 }}>{e}</code>) },
              { key: "created", header: "Criado", cell: (w) => (tz.timezone ? localDateTime(w.createdAt, tz.timezone) : w.createdAt.slice(0, 16).replace("T", " ")) },
              { key: "test", header: "Último teste", cell: (w) => testResults[w.id] ?? <span className="subtle">—</span> },
              {
                key: "actions",
                header: "Acções",
                srHeader: true,
                cell: (w) =>
                  canManage && w.status === "ACTIVE" ? (
                    <span className="row">
                      <Button size="sm" loading={testing === w.id} onClick={() => runTest(w)}>
                        Testar
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setRevoking(w)}>
                        Revogar
                      </Button>
                    </span>
                  ) : null,
              },
            ]}
          />
        )}
        <p className="result-limit">
          O URL de destino e o histórico de entregas não são devolvidos pela API da UL Platform — só o resultado de um teste feito agora. (Lacuna registada em docs/f29-report.md.)
        </p>
      </Section>

      {canManage && creating && (
        <CreateWebhookDialog
          organizationId={org}
          onClose={() => setCreating(false)}
          onCreated={(endpoint, url) => {
            setCreating(false);
            setCreated({ endpoint, url });
            const { id, application, organizationId, status, createdAt, revokedAt, eventTypes } = endpoint;
            webhooks.setData([...(webhooks.data ?? []), { id, application, organizationId, status, createdAt, revokedAt, eventTypes }]);
          }}
        />
      )}

      <Modal
        open={created !== null}
        onClose={() => setCreated(null)}
        title="Webhook criado"
        description="Este segredo de assinatura só será mostrado uma vez. Usa-o para verificar o cabeçalho X-UL-Signature (HMAC-SHA256) em cada entrega."
        footer={
          <Button variant="primary" onClick={() => setCreated(null)}>
            Já guardei o segredo
          </Button>
        }
      >
        {created && (
          <div className="stack-sm">
            <span className="muted" style={{ fontSize: 13 }}>
              Destino: <code className="mono break-all">{created.url}</code> (anota-o — a API não o volta a mostrar).
            </span>
            <div className="secret-box">
              <code>{created.endpoint.secret}</code>
              <CopyButton value={created.endpoint.secret} />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title="Revogar webhook?"
        description="O endpoint deixa de receber entregas. A revogação não pode ser desfeita."
        confirmLabel="Revogar"
        onConfirm={async () => {
          if (!revoking) return;
          const updated = await revokeWebhook(org, revoking.id);
          webhooks.setData((webhooks.data ?? []).map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
          toast.success("Webhook revogado.");
        }}
      />
    </div>
  );
}

function CreateWebhookDialog({ organizationId, onClose, onCreated }: { organizationId: string; onClose: () => void; onCreated: (endpoint: CreatedWebhookEndpoint, url: string) => void }) {
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["appointment.created"]);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const customValid = custom === "" || EVENT_TYPE.test(custom);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const eventTypes = [...new Set([...events, ...(custom ? [custom] : [])])];
    setBusy(true);
    setError(null);
    try {
      onCreated(await createWebhook(organizationId, { url, eventTypes }), url);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo webhook">
      <form onSubmit={submit}>
        <Field label="URL de destino (HTTPS)">
          <input id="webhook-url" type="url" className="input" required placeholder="https://exemplo.ao/webhooks/na-pista" value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <fieldset style={{ border: 0, padding: 0, margin: "0 0 var(--np-space-3)" }}>
          <legend className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
            Eventos (planeados — ainda não publicados)
          </legend>
          {PLANNED_EVENTS.map((event) => (
            <label key={event} className="checkbox-row" style={{ marginBottom: 6 }}>
              <input type="checkbox" checked={events.includes(event)} onChange={(e) => setEvents((current) => (e.target.checked ? [...current, event] : current.filter((x) => x !== event)))} />
              <code className="mono">{event}</code>
            </label>
          ))}
        </fieldset>
        <Field label="Outro tipo de evento (opcional)" hint='Formato "domínio.acção", ex.: order.created' error={customValid ? null : 'Usa o formato "domínio.acção" em minúsculas.'}>
          <input id="webhook-custom-event" className="input" value={custom} onChange={(e) => setCustom(e.target.value.trim())} />
        </Field>
        {error ? <ErrorNotice error={error} /> : null}
        <div className="modal-footer">
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={busy} disabled={!customValid || (events.length === 0 && !custom)}>
            Criar webhook
          </Button>
        </div>
      </form>
    </Modal>
  );
}
