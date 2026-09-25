import type { ServiceScope } from "../api/platform";
import { allEndpoints } from "./apiCatalog";

export interface ScopeGroup {
  domain: string;
  label: string;
  scopes: (ServiceScope & { usage: string; forIntegrations: boolean })[];
}

const DOMAIN_LABELS: Record<string, string> = {
  catalog: "Catálogo e operação",
  customer: "Clientes (UL Platform)",
  usage: "Utilização",
  event: "Eventos",
  report: "Relatórios",
};

/**
 * Explains each REAL scope the Platform allows for NA_PISTA credentials
 * (list comes from GET /applications/NA_PISTA/service-scopes — never
 * invented here) by what it unlocks in the Na Pista API, derived from the
 * route catalog. Scopes Na Pista's routes never check are labelled as such
 * instead of implying they do something.
 */
export function describeScope(key: string): { usage: string; forIntegrations: boolean } {
  const endpoints = allEndpoints().filter((e) => e.scope === key);
  if (endpoints.length > 0) {
    const verbs = key === "catalog.read" ? "leitura" : "escrita";
    return { usage: `${verbs} em ${endpoints.length} endpoints da Na Pista API (todos os módulos)`, forIntegrations: true };
  }
  if (key === "usage.write" || key === "event.publish") {
    return { usage: "Credencial de plataforma: usada pelo próprio servidor Na Pista para falar com a UL Platform (utilização/eventos). Não dá acesso à Na Pista API.", forIntegrations: false };
  }
  return { usage: "Não é verificado por nenhum endpoint da Na Pista API.", forIntegrations: false };
}

export function groupScopes(scopes: ServiceScope[]): ScopeGroup[] {
  const groups = new Map<string, ScopeGroup>();
  for (const scope of scopes) {
    const domain = scope.key.split(".")[0] ?? scope.key;
    const group = groups.get(domain) ?? { domain, label: DOMAIN_LABELS[domain] ?? domain, scopes: [] };
    group.scopes.push({ ...scope, ...describeScope(scope.key) });
    groups.set(domain, group);
  }
  return [...groups.values()].sort((a, b) => Number(b.scopes.some((s) => s.forIntegrations)) - Number(a.scopes.some((s) => s.forIntegrations)) || a.domain.localeCompare(b.domain));
}
