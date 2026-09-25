"use client";

import { useParams } from "next/navigation";
import { listEnvironmentEndpoints, listEnvironments } from "../../../../../lib/api/platform";
import { useAsync } from "../../../../../lib/useAsync";
import { PageHeader, Section } from "../../../../../components/patterns/Page";
import { Badge, DataTable, DetailList } from "../../../../../components/ui/Data";
import { Alert, ErrorNotice } from "../../../../../components/ui/Feedback";
import { environmentLabel } from "../../../../../components/shell/AppShell";

const NA_PISTA_API_URL = process.env.NEXT_PUBLIC_NA_PISTA_API_URL ?? "";

/**
 * F29 Environments — read-only view of what the UL Platform actually
 * declares for NA_PISTA (GET /applications/NA_PISTA/environments + their
 * endpoints). Environments are platform-level (managed by platform
 * administrators, not by tenants), and credentials are NOT environment-
 * scoped — both stated rather than simulated with a fake switcher.
 */
export default function EnvironmentsPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const environments = useAsync(async () => {
    const list = await listEnvironments();
    const endpoints = await Promise.all(list.map((env) => listEnvironmentEndpoints(env.key).catch(() => [])));
    return list.map((env, index) => ({ ...env, endpoints: endpoints[index] ?? [] }));
  }, []);
  const current = environmentLabel();

  return (
    <div>
      <PageHeader
        title="Ambientes"
        description="Ambientes da aplicação Na Pista declarados na UL Platform. São geridos pelos administradores da plataforma."
        breadcrumbs={[{ label: "Integrações", href: `/o/${org}/integrations` }, { label: "Ambientes" }]}
      />

      <Section title="Esta consola">
        <div className="card">
          <DetailList
            items={[
              { label: "Ligada a", value: <code className="mono break-all">{NA_PISTA_API_URL || "não configurado"}</code> },
              { label: "Ambiente", value: current ?? "Não identificado a partir do endereço da API" },
            ]}
          />
        </div>
      </Section>

      <Section title="Ambientes declarados">
        {environments.error ? (
          <ErrorNotice error={environments.error} />
        ) : (
          <DataTable
            rows={environments.data}
            rowKey={(e) => e.key}
            empty={{ title: "A plataforma não declara ambientes para a Na Pista." }}
            columns={[
              { key: "key", header: "Ambiente", cell: (e) => <strong>{e.key}</strong> },
              { key: "status", header: "Estado", cell: (e) => <Badge tone={e.status === "ACTIVE" ? "success" : "neutral"}>{e.status}</Badge> },
              {
                key: "endpoints",
                header: "Endpoints registados",
                wrap: true,
                cell: (e) =>
                  e.endpoints.length === 0 ? (
                    <span className="subtle">nenhum registado</span>
                  ) : (
                    <span className="stack-sm">
                      {e.endpoints.map((ep) => (
                        <span key={`${ep.type}-${ep.baseUrl}`}>
                          <span className="badge">{ep.type}</span> <code className="mono break-all">{ep.baseUrl}</code>
                        </span>
                      ))}
                    </span>
                  ),
              },
            ]}
          />
        )}
      </Section>

      <Alert tone="info" title="Credenciais e ambientes">
        As credenciais não estão associadas a um ambiente: uma credencial é válida na API da UL Platform que a emitiu. Usa credenciais diferentes por instalação e revoga as que deixarem de
        ser usadas.
      </Alert>
    </div>
  );
}
