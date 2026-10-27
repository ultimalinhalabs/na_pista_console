"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { API_MODULES, COMMON_ERRORS, scopesOf, type ApiEndpoint, type ApiField } from "../../../../../lib/integration/apiCatalog";
import { PageHeader, Section } from "../../../../../components/patterns/Page";
import { CopyButton } from "../../../../../components/ui/Data";
import { EmptyState } from "../../../../../components/ui/Feedback";
import { SearchInput } from "../../../../../components/ui/Form";

const NA_PISTA_API_URL = process.env.NEXT_PUBLIC_NA_PISTA_API_URL ?? "https://<na-pista-api>/v1";

function Fields({ title, fields }: { title: string; fields?: ApiField[] }) {
  if (!fields || fields.length === 0) return null;
  return (
    <div className="table-wrap" style={{ marginTop: 8 }}>
      <table>
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            <th scope="col">{title}</th>
            <th scope="col">Tipo</th>
            <th scope="col">Obrigatório</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr key={f.name}>
              <td>
                <code className="mono">{f.name}</code>
              </td>
              <td className="wrap">
                {f.type}
                {f.description && <span className="subtle"> — {f.description}</span>}
              </td>
              <td>{f.required ? "sim" : "não"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function exampleFor(endpoint: ApiEndpoint, organizationId: string): string {
  const path = endpoint.path.replace("{organizationId}", organizationId);
  const lines = [`curl -X ${endpoint.method} "${NA_PISTA_API_URL}${path}" \\`, `  -H "Authorization: Bearer $NA_PISTA_KEY"`];
  const required = endpoint.body?.filter((f) => f.required) ?? [];
  if (required.length > 0) {
    lines[lines.length - 1] += " \\";
    lines.push(`  -H "content-type: application/json" \\`);
    lines.push(`  -d '${JSON.stringify(Object.fromEntries(required.map((f) => [f.name, `<${f.type.split(" ")[0]}>`])))}'`);
  }
  return lines.join("\n");
}

function Endpoint({ endpoint, organizationId }: { endpoint: ApiEndpoint; organizationId: string }) {
  const example = exampleFor(endpoint, organizationId);
  return (
    <article className="card stack-sm" id={endpoint.id} aria-labelledby={`${endpoint.id}-title`}>
      <div className="row">
        <span className={`method method-${endpoint.method}`}>{endpoint.method}</span>
        <code className="mono break-all" style={{ flex: 1 }}>
          {endpoint.path}
        </code>
      </div>
      <h4 id={`${endpoint.id}-title`} style={{ margin: 0, fontSize: 14 }}>
        {endpoint.summary}
      </h4>
      <div className="row subtle" style={{ fontSize: 12 }}>
        <span>
          Permissão: <code className="mono">{endpoint.permission}</code>
        </span>
        <span>
          Âmbito: <code className="mono">{scopesOf(endpoint).join(" ou ")}</code>
        </span>
        <span>Resposta: {endpoint.success}</span>
      </div>
      {endpoint.notes && <p className="muted" style={{ margin: 0, fontSize: 13 }}>{endpoint.notes}</p>}
      <Fields title="Query" fields={endpoint.query} />
      <Fields title="Corpo (JSON)" fields={endpoint.body} />
      {endpoint.errors && endpoint.errors.length > 0 && (
        <div className="muted" style={{ fontSize: 13 }}>
          Erros específicos: {endpoint.errors.join(" · ")}
        </div>
      )}
      <details>
        <summary className="muted" style={{ cursor: "pointer", fontSize: 13 }}>
          Exemplo
        </summary>
        <div className="row" style={{ alignItems: "flex-start", marginTop: 8 }}>
          <pre className="code-block" style={{ flex: 1 }}>
            {example}
          </pre>
          <CopyButton value={example} />
        </div>
      </details>
    </article>
  );
}

/**
 * F29 API documentation, rendered from `lib/integration/apiCatalog.ts`
 * (derived from the real backend routes and schemas — see that file's
 * header). Search filters endpoints by path, summary, permission or scope.
 */
export default function ApiDocsPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const [query, setQuery] = useState("");
  const modules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return API_MODULES;
    return API_MODULES.map((m) => ({
      ...m,
      endpoints: m.endpoints.filter((e) => [e.path, e.summary, e.permission, scopesOf(e).join(" "), e.method, m.name].some((v) => v.toLowerCase().includes(q))),
    })).filter((m) => m.endpoints.length > 0);
  }, [query]);

  return (
    <div>
      <PageHeader
        title="Documentação da API"
        description="Referência da Na Pista API derivada das rotas e validações reais do servidor. Tudo o que a Consola faz, uma interface própria pode fazer com estes endpoints."
        breadcrumbs={[{ label: "Integrações", href: `/o/${org}/integrations` }, { label: "Documentação" }]}
      />

      <Section title="Fundamentos">
        <div className="grid-2">
          <div className="card stack-sm">
            <strong>URL base</strong>
            <code className="mono break-all">{NA_PISTA_API_URL}</code>
            <span className="muted" style={{ fontSize: 13 }}>
              Todas as rotas são versionadas (<code className="mono">/v1</code>) e começam por <code className="mono">/organizations/{"{organizationId}"}</code>. O
              organizationId do caminho tem de corresponder à credencial ou a uma organização do utilizador.
            </span>
          </div>
          <div className="card stack-sm">
            <strong>Autenticação</strong>
            <span className="muted" style={{ fontSize: 13 }}>
              <code className="mono">Authorization: Bearer &lt;token&gt;</code> — token de sessão de um utilizador (permissões pelo papel) ou credencial de serviço{" "}
              <code className="mono">ulk_&lt;id&gt;.&lt;segredo&gt;</code> (âmbitos <code className="mono">catalog.read</code>/<code className="mono">catalog.write</code>). O módulo tem de
              estar activo na subscrição (<code className="mono">catalog.enabled</code>).
            </span>
          </div>
          <div className="card stack-sm">
            <strong>Formato</strong>
            <span className="muted" style={{ fontSize: 13 }}>
              JSON. Sucesso: <code className="mono">{"{ \"data\": … }"}</code>. Erro: <code className="mono">{"{ \"error\": { \"code\", \"message\" } }"}</code>. Valores monetários e
              quantidades são decimais em string; datas/horas absolutas são ISO-8601. Campos desconhecidos são rejeitados (400).
            </span>
          </div>
          <div className="card stack-sm">
            <strong>Limites</strong>
            <span className="muted" style={{ fontSize: 13 }}>
              Listas aceitam <code className="mono">limit</code> até 100 (marcações: 500, com intervalo de datas obrigatório até 31 dias). Não existe paginação por cursor/offset: refina filtros
              quando uma página vem cheia.
            </span>
          </div>
        </div>
      </Section>

      <Section title="Erros comuns">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">HTTP</th>
                <th scope="col">Código</th>
                <th scope="col">Significado</th>
              </tr>
            </thead>
            <tbody>
              {COMMON_ERRORS.map((e) => (
                <tr key={e.code}>
                  <td>{e.status}</td>
                  <td>
                    <code className="mono">{e.code}</code>
                  </td>
                  <td className="wrap">{e.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Endpoints"
        description="Organizados por módulo."
        actions={<SearchInput label="Filtrar endpoints" value={query} onChange={(e) => setQuery(e.target.value)} />}
      >
        <nav aria-label="Módulos da API" className="row" style={{ marginBottom: "var(--np-space-4)" }}>
          {API_MODULES.map((m) => (
            <a key={m.id} href={`#${m.id}`} className="badge">
              {m.name}
            </a>
          ))}
        </nav>
        {modules.length === 0 ? (
          <EmptyState title={`Nenhum endpoint corresponde a “${query}”.`} />
        ) : (
          <div className="stack">
            {modules.map((m) => (
              <section key={m.id} id={m.id} aria-labelledby={`${m.id}-heading`} className="stack-sm">
                <h3 id={`${m.id}-heading`} style={{ fontSize: 16 }}>
                  {m.name}
                </h3>
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  {m.description}
                </p>
                {m.endpoints.map((e) => (
                  <Endpoint key={e.id} endpoint={e} organizationId={org} />
                ))}
              </section>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
