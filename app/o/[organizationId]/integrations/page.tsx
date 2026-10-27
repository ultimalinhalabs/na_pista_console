"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "../../../../lib/session/SessionContext";
import { platformRoleCan } from "../../../../lib/platformPermissions";
import { PLATFORM_API_URL } from "../../../../lib/api/platformClient";
import { getApiRequestUsage } from "../../../../lib/api/platform";
import { API_MODULES, scopesOf, type ApiEndpoint } from "../../../../lib/integration/apiCatalog";
import { useAsync } from "../../../../lib/useAsync";
import { formatCount } from "../../../../lib/format";
import { PageHeader, Section } from "../../../../components/patterns/Page";
import { CopyButton, DataTable, DetailList, Stat } from "../../../../components/ui/Data";
import { Alert, ErrorNotice } from "../../../../components/ui/Feedback";

const NA_PISTA_API_URL = process.env.NEXT_PUBLIC_NA_PISTA_API_URL ?? "";

/**
 * F29 Integration Center — "how do I build my own UI on Na Pista?" Every
 * value shown here is real: the API base URL this Console itself uses, the
 * organization id, the actual auth model (verified in na-pista
 * middleware/authenticate.ts), the module/scope map derived from the
 * backend routes, and the real `api_requests` meter. No secrets.
 */
/** The distinct scopes a set of endpoints accepts (alternatives included), as code chips; "—" when none. */
function scopeCell(endpoints: ApiEndpoint[]) {
  const scopes = [...new Set(endpoints.flatMap(scopesOf))].sort();
  if (scopes.length === 0) return "—";
  return scopes.map((s, i) => (
    <span key={s}>
      {i > 0 ? " " : null}
      <code className="mono">{s}</code>
    </span>
  ));
}

export default function IntegrationsPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === org)?.roleKey;
  const usage = useAsync(() => getApiRequestUsage(org), [org], { enabled: platformRoleCan(roleKey, "usage.read") });
  const base = `/o/${org}/integrations`;
  const example = `curl -H "Authorization: Bearer $NA_PISTA_KEY" \\\n  "${NA_PISTA_API_URL}/organizations/${org}/products?status=ACTIVE&limit=20"`;

  return (
    <div>
      <PageHeader
        title="API"
        description="Tudo o que a tua equipa precisa para construir uma interface própria sobre a Na Pista API. A Consola é apenas mais um cliente desta mesma API."
        breadcrumbs={[{ label: "Integrações" }, { label: "API" }]}
      />

      <Section title="Ligação">
        <div className="card">
          <DetailList
            items={[
              {
                label: "Na Pista API",
                value: (
                  <span className="row">
                    <code className="mono break-all">{NA_PISTA_API_URL || "não configurado"}</code>
                    {NA_PISTA_API_URL && <CopyButton value={NA_PISTA_API_URL} />}
                  </span>
                ),
              },
              {
                label: "Organização",
                value: (
                  <span className="row">
                    <code className="mono break-all">{org}</code>
                    <CopyButton value={org} />
                  </span>
                ),
              },
              { label: "UL Platform API", value: <code className="mono break-all">{PLATFORM_API_URL || "não configurado"}</code> },
              { label: "Ambiente", value: <Link href={`${base}/environments`}>Ver ambientes declarados na plataforma</Link> },
            ]}
          />
        </div>
      </Section>

      <Section title="Autenticação" description="Todos os pedidos usam o cabeçalho Authorization: Bearer. O servidor decide sempre — permissões, âmbitos e subscrição são verificados em cada pedido.">
        <div className="grid-2">
          <div className="card stack-sm">
            <strong>Utilizadores (pessoas)</strong>
            <span className="muted" style={{ fontSize: 13 }}>
              Token de sessão Supabase do utilizador. O acesso depende do papel na organização (Proprietário, Administrador, Gestor, Colaborador) —{" "}
              <Link href={`/o/${org}/settings/permissions`}>ver permissões</Link>.
            </span>
          </div>
          <div className="card stack-sm">
            <strong>Integrações (serviços)</strong>
            <span className="muted" style={{ fontSize: 13 }}>
              Credencial de serviço <code className="mono">ulk_&lt;id&gt;.&lt;segredo&gt;</code> da aplicação Na Pista, criada em <Link href={`${base}/credentials`}>Credenciais</Link>, só com os
              âmbitos de que precisa: <code className="mono">catalog.*</code> (catálogo, stock, agenda), <code className="mono">customer.*</code>, <code className="mono">order.*</code> e{" "}
              <code className="mono">appointment.*</code> (dados pessoais). Para uma interface de cliente:{" "}
              <code className="mono">catalog.read</code>, <code className="mono">customer.create</code> e <code className="mono">order.create</code>. Só funciona para esta organização;
              criar pedidos, clientes ou movimentos exige o cabeçalho <code className="mono">Idempotency-Key</code>.
            </span>
          </div>
        </div>
        <pre className="code-block" style={{ marginTop: "var(--np-space-3)" }} aria-label="Exemplo de pedido">
          {example}
        </pre>
        <p className="subtle" style={{ fontSize: 12 }}>
          Respostas: <code className="mono">{"{ \"data\": … }"}</code> ou <code className="mono">{"{ \"error\": { \"code\", \"message\" } }"}</code>. Guarda o cabeçalho X-Request-Id para suporte.
        </p>
      </Section>

      <Section title="Módulos disponíveis" description="Cada módulo exige o seu direito na subscrição da organização (catalog.enabled, orders.enabled, customers.enabled, services.enabled). Derivado das rotas reais da API." actions={<Link href={`${base}/docs`}>Documentação completa</Link>}>
        <DataTable
          rows={API_MODULES}
          rowKey={(m) => m.id}
          columns={[
            { key: "module", header: "Módulo", cell: (m) => <Link href={`${base}/docs#${m.id}`}>{m.name}</Link> },
            { key: "read", header: "Leitura", cell: (m) => scopeCell(m.endpoints.filter((e) => e.method === "GET")) },
            { key: "write", header: "Escrita", cell: (m) => scopeCell(m.endpoints.filter((e) => e.method !== "GET")) },
            { key: "endpoints", header: "Endpoints", numeric: true, cell: (m) => m.endpoints.length },
          ]}
        />
      </Section>

      {platformRoleCan(roleKey, "usage.read") && (
        <Section title="Utilização" description="Medidor api_requests registado na UL Platform. A Na Pista regista uma unidade por cada operação de escrita concluída (não por leitura).">
          {usage.error ? (
            <ErrorNotice error={usage.error} />
          ) : (
            <div className="grid-3">
              <Stat label="Operações registadas" value={usage.data ? formatCount(usage.data.quantity) : "…"} hint="total acumulado (sem intervalo)" />
            </div>
          )}
        </Section>
      )}

      <Alert tone="info" title="Eventos (webhooks)">
        A Na Pista ainda não publica eventos de negócio — a publicação está planeada (ADR-050). Podes preparar endpoints em <Link href={`${base}/webhooks`}>Webhooks</Link>.
      </Alert>
    </div>
  );
}
