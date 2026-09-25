import { roleCan } from "./permissions";
import { platformRoleCan } from "./platformPermissions";

export interface NavItem {
  label: string;
  /** path relative to /o/:organizationId ("" = overview) */
  path: string;
  /** Na Pista permission needed to show the item (UX only) */
  permission?: string;
  /** UL Platform permission needed to show the item (UX only) */
  platformPermission?: string;
  /** extra words the command menu matches */
  keywords?: string;
}

export interface NavGroup {
  label: string | null;
  items: NavItem[];
}

/**
 * F29 information architecture — ONLY capabilities that exist in the real
 * APIs (docs/f29-ui-audit.md). Scheduling (weekly rules / exceptions /
 * availability) is per Professional in the API, so "Agenda" is a hub that
 * leads to each professional's schedule rather than a fake org calendar.
 */
export const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ label: "Visão geral", path: "", keywords: "overview inicio dashboard home" }] },
  {
    label: "Operação",
    items: [
      { label: "Pedidos", path: "/orders", permission: "orders.read", keywords: "orders encomendas vendas" },
      { label: "Marcações", path: "/appointments", permission: "appointments.read", keywords: "appointments agenda calendario booking" },
      { label: "Clientes", path: "/customers", permission: "customers.read", keywords: "customers" },
      { label: "Inventário", path: "/inventory", permission: "inventory.read", keywords: "inventory stock" },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { label: "Produtos", path: "/products", permission: "products.read", keywords: "products" },
      { label: "Categorias", path: "/categories", permission: "categories.read", keywords: "categories" },
      { label: "Serviços", path: "/services", permission: "services.read", keywords: "services" },
      { label: "Profissionais", path: "/professionals", permission: "professionals.read", keywords: "professionals staff equipa" },
    ],
  },
  {
    label: "Agenda",
    items: [{ label: "Horários e disponibilidade", path: "/scheduling", permission: "scheduling.read", keywords: "scheduling horario disponibilidade excepcoes availability" }],
  },
  {
    label: "Integrações",
    items: [
      { label: "API", path: "/integrations", keywords: "api integration developer base url" },
      { label: "Credenciais", path: "/integrations/credentials", platformPermission: "api_key.read", keywords: "credentials api keys chaves scopes" },
      { label: "Ambientes", path: "/integrations/environments", keywords: "environments staging production endpoints" },
      { label: "Webhooks", path: "/integrations/webhooks", platformPermission: "webhook.read", keywords: "webhooks eventos events" },
      { label: "Documentação", path: "/integrations/docs", keywords: "documentation docs referencia endpoints" },
    ],
  },
  {
    label: "Definições",
    items: [
      { label: "Organização", path: "/settings", keywords: "settings organization timezone fuso horario" },
      { label: "Equipa", path: "/settings/team", platformPermission: "membership.read", keywords: "team members membros roles" },
      { label: "Permissões", path: "/settings/permissions", keywords: "permissions roles papeis" },
    ],
  },
];

export function visibleNav(roleKey: string | undefined): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => (!item.permission || roleCan(roleKey, item.permission)) && (!item.platformPermission || platformRoleCan(roleKey, item.platformPermission))),
  })).filter((group) => group.items.length > 0);
}

/** Longest-prefix match so /products/123 highlights "Produtos" and /integrations/credentials beats /integrations. */
export function activeNavPath(pathname: string, organizationId: string): string | null {
  const base = `/o/${organizationId}`;
  if (!pathname.startsWith(base)) return null;
  const rest = pathname.slice(base.length) || "";
  const candidates = NAV_GROUPS.flatMap((g) => g.items.map((i) => i.path)).filter((p) => (p === "" ? rest === "" || rest === "/" : rest === p || rest.startsWith(`${p}/`)));
  return candidates.sort((a, b) => b.length - a.length)[0] ?? null;
}
