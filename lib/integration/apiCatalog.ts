/**
 * F29 — Na Pista API reference, DERIVED from the backend source (single
 * layer, not hand-invented): every route below was extracted from
 * `na-pista/src/modules/<module>/routes.ts` (method, path, `requireAuthorized
 * (permission, scope)`), request fields from the module's Zod schemas
 * (`schemas.ts`), and errors from `src/shared/errors.ts` + the domain
 * services, at na-pista commit c8c76b9 + F28B. No machine-readable contract
 * (OpenAPI) exists yet — recorded as a gap in docs/f29-report.md with a
 * proposed backend change (generate OpenAPI from the same Zod schemas); when
 * it exists, this file should be generated from it instead.
 */

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface ApiField {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
}

export interface ApiEndpoint {
  id: string;
  method: HttpMethod;
  /** path under the API base URL (…/v1) */
  path: string;
  summary: string;
  /** Na Pista permission checked for human members */
  permission: string;
  /** UL Platform service scope checked for service credentials */
  scope: "catalog.read" | "catalog.write";
  query?: ApiField[];
  body?: ApiField[];
  success: string;
  errors?: string[];
  notes?: string;
}

export interface ApiModule {
  id: string;
  name: string;
  description: string;
  endpoints: ApiEndpoint[];
}

const ORG = "/organizations/{organizationId}";
const status = (values: string) => ({ name: "status", type: values });
const limit = (max = 100, def = 50) => ({ name: "limit", type: `integer 1..${max} (default ${def})` });
const qField = { name: "q", type: "string (1..200)", description: "pesquisa por nome (ILIKE)" };

export const API_MODULES: ApiModule[] = [
  {
    id: "products",
    name: "Produtos",
    description: "Catálogo de produtos. Arquivar = DELETE (nunca apaga fisicamente). Preço é um decimal em string (numeric(14,2)), nunca float.",
    endpoints: [
      { id: "products.list", method: "GET", path: `${ORG}/products`, summary: "Listar produtos", permission: "products.read", scope: "catalog.read", query: [status("ACTIVE | ARCHIVED"), { name: "categoryId", type: "uuid" }, qField, limit()], success: "200 Product[]" },
      {
        id: "products.create",
        method: "POST",
        path: `${ORG}/products`,
        summary: "Criar produto",
        permission: "products.create",
        scope: "catalog.write",
        body: [
          { name: "name", type: "string 1..200", required: true },
          { name: "description", type: "string ≤2000" },
          { name: "categoryId", type: "uuid" },
          { name: "unit", type: "UNIT | KG | G | L | ML" },
          { name: "price", type: 'decimal string ≥ 0, e.g. "1500.00"', description: "omitido = sem preço (não vendável em pedidos)" },
        ],
        success: "201 Product",
        errors: ["400 VALIDATION_ERROR", "404 NOT_FOUND (categoria)"],
      },
      { id: "products.get", method: "GET", path: `${ORG}/products/{productId}`, summary: "Obter produto", permission: "products.read", scope: "catalog.read", success: "200 Product", errors: ["404 NOT_FOUND"] },
      {
        id: "products.update",
        method: "PATCH",
        path: `${ORG}/products/{productId}`,
        summary: "Actualizar produto (incl. preço e reactivar)",
        permission: "products.update",
        scope: "catalog.write",
        body: [
          { name: "name", type: "string 1..200" },
          { name: "description", type: "string ≤2000 | null" },
          { name: "categoryId", type: "uuid | null" },
          { name: "unit", type: "UNIT | KG | G | L | ML" },
          { name: "price", type: "decimal string | null" },
          status("ACTIVE | ARCHIVED"),
        ],
        success: "200 Product",
        errors: ["400 VALIDATION_ERROR", "404 NOT_FOUND"],
      },
      { id: "products.archive", method: "DELETE", path: `${ORG}/products/{productId}`, summary: "Arquivar produto", permission: "products.delete", scope: "catalog.write", success: "200 Product (status ARCHIVED)", errors: ["404 NOT_FOUND"] },
    ],
  },
  {
    id: "categories",
    name: "Categorias",
    description: "Agrupamento de produtos. Arquivar = DELETE.",
    endpoints: [
      { id: "categories.list", method: "GET", path: `${ORG}/categories`, summary: "Listar categorias", permission: "categories.read", scope: "catalog.read", query: [status("ACTIVE | ARCHIVED"), limit()], success: "200 Category[]" },
      { id: "categories.create", method: "POST", path: `${ORG}/categories`, summary: "Criar categoria", permission: "categories.create", scope: "catalog.write", body: [{ name: "name", type: "string 1..200", required: true }, { name: "description", type: "string ≤2000" }], success: "201 Category" },
      { id: "categories.get", method: "GET", path: `${ORG}/categories/{categoryId}`, summary: "Obter categoria", permission: "categories.read", scope: "catalog.read", success: "200 Category", errors: ["404 NOT_FOUND"] },
      { id: "categories.update", method: "PATCH", path: `${ORG}/categories/{categoryId}`, summary: "Actualizar categoria", permission: "categories.update", scope: "catalog.write", body: [{ name: "name", type: "string 1..200" }, { name: "description", type: "string | null" }, status("ACTIVE | ARCHIVED")], success: "200 Category" },
      { id: "categories.archive", method: "DELETE", path: `${ORG}/categories/{categoryId}`, summary: "Arquivar categoria", permission: "categories.delete", scope: "catalog.write", success: "200 Category" },
    ],
  },
  {
    id: "customers",
    name: "Clientes",
    description: "Clientes de negócio da organização (não são utilizadores da UL Platform). Arquivar = DELETE.",
    endpoints: [
      { id: "customers.list", method: "GET", path: `${ORG}/customers`, summary: "Listar clientes", permission: "customers.read", scope: "catalog.read", query: [status("ACTIVE | ARCHIVED"), qField, limit()], success: "200 Customer[]" },
      {
        id: "customers.create",
        method: "POST",
        path: `${ORG}/customers`,
        summary: "Criar cliente",
        permission: "customers.create",
        scope: "catalog.write",
        body: [{ name: "name", type: "string", required: true }, { name: "email", type: "email ≤320" }, { name: "phone", type: "string" }, { name: "notes", type: "string" }],
        success: "201 Customer",
      },
      { id: "customers.get", method: "GET", path: `${ORG}/customers/{customerId}`, summary: "Obter cliente", permission: "customers.read", scope: "catalog.read", success: "200 Customer", errors: ["404 NOT_FOUND"] },
      { id: "customers.update", method: "PATCH", path: `${ORG}/customers/{customerId}`, summary: "Actualizar cliente", permission: "customers.update", scope: "catalog.write", body: [{ name: "name", type: "string" }, { name: "email", type: "email | null" }, { name: "phone", type: "string | null" }, { name: "notes", type: "string | null" }, status("ACTIVE | ARCHIVED")], success: "200 Customer" },
      { id: "customers.archive", method: "DELETE", path: `${ORG}/customers/{customerId}`, summary: "Arquivar cliente", permission: "customers.delete", scope: "catalog.write", success: "200 Customer" },
    ],
  },
  {
    id: "inventory",
    name: "Inventário",
    description: "Saldos por produto e movimentos. O stock só muda através de movimentos; quantidades são decimais em string (numeric(20,6)).",
    endpoints: [
      { id: "inventory.list", method: "GET", path: `${ORG}/inventory`, summary: "Listar saldos", permission: "inventory.read", scope: "catalog.read", query: [{ name: "zeroStock", type: "boolean", description: "só produtos com saldo 0" }, limit()], success: "200 InventoryBalance[]" },
      { id: "inventory.get", method: "GET", path: `${ORG}/inventory/{productId}`, summary: "Saldo de um produto", permission: "inventory.read", scope: "catalog.read", success: "200 InventoryBalance", errors: ["404 PRODUCT_NOT_FOUND", "404 INVENTORY_NOT_FOUND"] },
      { id: "inventory.movements", method: "GET", path: `${ORG}/inventory/{productId}/movements`, summary: "Movimentos de um produto", permission: "inventory.read", scope: "catalog.read", query: [limit()], success: "200 StockMovement[]" },
      {
        id: "inventory.move",
        method: "POST",
        path: `${ORG}/inventory/{productId}/movements`,
        summary: "Registar movimento",
        permission: "inventory.create (RECEIPT) · inventory.update (ADJUSTMENT_*)",
        scope: "catalog.write",
        body: [{ name: "type", type: "RECEIPT | ADJUSTMENT_IN | ADJUSTMENT_OUT", required: true }, { name: "quantity", type: "decimal string > 0", required: true }, { name: "reason", type: "string ≤500" }],
        success: "201 StockMovement",
        errors: ["409 INSUFFICIENT_STOCK", "409 PRODUCT_ARCHIVED", "404 PRODUCT_NOT_FOUND"],
        notes: "A permissão depende do tipo: RECEIPT exige inventory.create; ajustes exigem inventory.update.",
      },
    ],
  },
  {
    id: "orders",
    name: "Pedidos",
    description: "DRAFT → CONFIRMED → COMPLETED; CANCELED a partir de DRAFT ou CONFIRMED. Preço e nome dos artigos são instantâneos (snapshots) do produto.",
    endpoints: [
      { id: "orders.list", method: "GET", path: `${ORG}/orders`, summary: "Listar pedidos", permission: "orders.read", scope: "catalog.read", query: [status("DRAFT | CONFIRMED | COMPLETED | CANCELED"), { name: "customerId", type: "uuid" }, limit()], success: "200 Order[] (sem artigos)" },
      {
        id: "orders.create",
        method: "POST",
        path: `${ORG}/orders`,
        summary: "Criar pedido (DRAFT)",
        permission: "orders.create",
        scope: "catalog.write",
        body: [{ name: "customerId", type: "uuid" }, { name: "items", type: "{ productId: uuid, quantity: decimal string }[] ≤100" }],
        success: "201 Order",
        errors: ["409 PRODUCT_PRICE_REQUIRED", "409 PRODUCT_ARCHIVED", "409 CUSTOMER_ARCHIVED"],
      },
      { id: "orders.get", method: "GET", path: `${ORG}/orders/{orderId}`, summary: "Obter pedido (com artigos)", permission: "orders.read", scope: "catalog.read", success: "200 Order", errors: ["404 ORDER_NOT_FOUND"] },
      { id: "orders.update", method: "PATCH", path: `${ORG}/orders/{orderId}`, summary: "Alterar cliente (só DRAFT)", permission: "orders.update", scope: "catalog.write", body: [{ name: "customerId", type: "uuid | null" }], success: "200 Order", errors: ["409 INVALID_ORDER_STATE"] },
      { id: "orders.items.add", method: "POST", path: `${ORG}/orders/{orderId}/items`, summary: "Adicionar artigo (só DRAFT)", permission: "orders.update", scope: "catalog.write", body: [{ name: "productId", type: "uuid", required: true }, { name: "quantity", type: "decimal string", required: true }], success: "201 Order" },
      { id: "orders.items.update", method: "PATCH", path: `${ORG}/orders/{orderId}/items/{itemId}`, summary: "Alterar quantidade (só DRAFT)", permission: "orders.update", scope: "catalog.write", body: [{ name: "quantity", type: "decimal string", required: true }], success: "200 Order" },
      { id: "orders.items.remove", method: "DELETE", path: `${ORG}/orders/{orderId}/items/{itemId}`, summary: "Remover artigo (só DRAFT)", permission: "orders.update", scope: "catalog.write", success: "200 Order" },
      { id: "orders.confirm", method: "POST", path: `${ORG}/orders/{orderId}/confirm`, summary: "Confirmar (consome stock)", permission: "orders.update", scope: "catalog.write", success: "200 Order", errors: ["409 EMPTY_ORDER", "409 INSUFFICIENT_STOCK", "409 INVALID_ORDER_STATE"] },
      { id: "orders.cancel", method: "POST", path: `${ORG}/orders/{orderId}/cancel`, summary: "Cancelar (repõe stock se confirmado)", permission: "orders.update", scope: "catalog.write", success: "200 Order", errors: ["409 INVALID_ORDER_STATE"] },
      { id: "orders.complete", method: "POST", path: `${ORG}/orders/{orderId}/complete`, summary: "Concluir (só CONFIRMED)", permission: "orders.update", scope: "catalog.write", success: "200 Order", errors: ["409 INVALID_ORDER_STATE"] },
    ],
  },
  {
    id: "services",
    name: "Serviços",
    description: "O que se reserva. Duração em minutos (inteiro); preço decimal em string ou null. Arquivar/reactivar via PATCH status.",
    endpoints: [
      { id: "services.list", method: "GET", path: `${ORG}/services`, summary: "Listar serviços", permission: "services.read", scope: "catalog.read", query: [status("ACTIVE | ARCHIVED"), qField, limit()], success: "200 Service[]" },
      {
        id: "services.create",
        method: "POST",
        path: `${ORG}/services`,
        summary: "Criar serviço",
        permission: "services.create",
        scope: "catalog.write",
        body: [{ name: "name", type: "string 1..200", required: true }, { name: "description", type: "string ≤2000" }, { name: "durationMinutes", type: "integer > 0", required: true }, { name: "price", type: "decimal string ≥ 0" }],
        success: "201 Service",
      },
      { id: "services.get", method: "GET", path: `${ORG}/services/{serviceId}`, summary: "Obter serviço", permission: "services.read", scope: "catalog.read", success: "200 Service", errors: ["404 NOT_FOUND"] },
      { id: "services.update", method: "PATCH", path: `${ORG}/services/{serviceId}`, summary: "Actualizar / arquivar / reactivar", permission: "services.update", scope: "catalog.write", body: [{ name: "name", type: "string" }, { name: "description", type: "string | null" }, { name: "durationMinutes", type: "integer > 0" }, { name: "price", type: "decimal string | null" }, status("ACTIVE | ARCHIVED")], success: "200 Service" },
    ],
  },
  {
    id: "professionals",
    name: "Profissionais",
    description: "Quem presta os serviços (não são utilizadores da UL Platform). A associação a serviços define quem pode fazer o quê.",
    endpoints: [
      { id: "professionals.list", method: "GET", path: `${ORG}/professionals`, summary: "Listar profissionais", permission: "professionals.read", scope: "catalog.read", query: [status("ACTIVE | ARCHIVED"), qField, { name: "serviceId", type: "uuid", description: "só quem está associado a este serviço" }, limit()], success: "200 Professional[]" },
      { id: "professionals.create", method: "POST", path: `${ORG}/professionals`, summary: "Criar profissional", permission: "professionals.create", scope: "catalog.write", body: [{ name: "name", type: "string 1..200", required: true }, { name: "description", type: "string ≤2000" }, { name: "phone", type: "string" }, { name: "email", type: "email" }], success: "201 Professional" },
      { id: "professionals.get", method: "GET", path: `${ORG}/professionals/{professionalId}`, summary: "Obter profissional", permission: "professionals.read", scope: "catalog.read", success: "200 Professional", errors: ["404 NOT_FOUND"] },
      { id: "professionals.update", method: "PATCH", path: `${ORG}/professionals/{professionalId}`, summary: "Actualizar / arquivar / reactivar", permission: "professionals.update", scope: "catalog.write", body: [{ name: "name", type: "string" }, { name: "description", type: "string | null" }, { name: "phone", type: "string | null" }, { name: "email", type: "email | null" }, status("ACTIVE | ARCHIVED")], success: "200 Professional" },
      { id: "professionals.services", method: "GET", path: `${ORG}/professionals/{professionalId}/services`, summary: "Serviços associados", permission: "professionals.read", scope: "catalog.read", success: "200 AssociatedService[]" },
      { id: "professionals.associate", method: "POST", path: `${ORG}/professionals/{professionalId}/services/{serviceId}`, summary: "Associar serviço", permission: "professionals.update", scope: "catalog.write", success: "201 Association", errors: ["409 PROFESSIONAL_ARCHIVED", "409 SERVICE_ARCHIVED", "409 CONFLICT (já associado)"] },
      { id: "professionals.dissociate", method: "DELETE", path: `${ORG}/professionals/{professionalId}/services/{serviceId}`, summary: "Remover associação", permission: "professionals.update", scope: "catalog.write", success: "200 { removed: true }" },
    ],
  },
  {
    id: "scheduling",
    name: "Horários",
    description: "Fuso horário da organização, horário semanal e excepções por profissional, e disponibilidade calculada (indicativa, não é garantia de reserva). Horas locais \"HH:mm\"; datas \"YYYY-MM-DD\".",
    endpoints: [
      { id: "settings.get", method: "GET", path: `${ORG}/settings`, summary: "Obter fuso horário (null se não configurado)", permission: "scheduling.read", scope: "catalog.read", success: "200 OrganizationSettings | null" },
      { id: "settings.put", method: "PUT", path: `${ORG}/settings`, summary: "Definir fuso horário (IANA)", permission: "scheduling.update", scope: "catalog.write", body: [{ name: "timezone", type: 'IANA id, e.g. "Africa/Luanda"', required: true }], success: "200 OrganizationSettings" },
      { id: "schedule.get", method: "GET", path: `${ORG}/professionals/{professionalId}/schedule`, summary: "Horário semanal", permission: "scheduling.read", scope: "catalog.read", success: "200 ScheduleRule[]" },
      { id: "schedule.put", method: "PUT", path: `${ORG}/professionals/{professionalId}/schedule`, summary: "Substituir horário semanal (conjunto completo)", permission: "scheduling.update", scope: "catalog.write", body: [{ name: "rules", type: "{ dayOfWeek 0..6, startLocalTime HH:mm, endLocalTime HH:mm }[] ≤100", required: true }], success: "200 ScheduleRule[]", errors: ["400 VALIDATION_ERROR (intervalos sobrepostos)"] },
      { id: "exceptions.list", method: "GET", path: `${ORG}/professionals/{professionalId}/schedule/exceptions`, summary: "Excepções", permission: "scheduling.read", scope: "catalog.read", success: "200 ScheduleException[]" },
      { id: "exceptions.create", method: "POST", path: `${ORG}/professionals/{professionalId}/schedule/exceptions`, summary: "Criar excepção (intervalo ou dia fechado)", permission: "scheduling.create", scope: "catalog.write", body: [{ name: "date", type: "YYYY-MM-DD", required: true }, { name: "startLocalTime", type: "HH:mm (omitir ambos = dia fechado)" }, { name: "endLocalTime", type: "HH:mm" }], success: "201 ScheduleException", errors: ["409 CONFLICT"] },
      { id: "exceptions.delete", method: "DELETE", path: `${ORG}/professionals/{professionalId}/schedule/exceptions/{exceptionId}`, summary: "Remover excepção", permission: "scheduling.update", scope: "catalog.write", success: "200 { removed: true }" },
      { id: "availability", method: "GET", path: `${ORG}/professionals/{professionalId}/availability`, summary: "Disponibilidade de trabalho (indicativa)", permission: "scheduling.read", scope: "catalog.read", query: [{ name: "from", type: "YYYY-MM-DD", required: true }, { name: "to", type: "YYYY-MM-DD (≤ 92 dias)", required: true }, { name: "serviceId", type: "uuid" }], success: "200 { timezone, days[] }", errors: ["409 TIMEZONE_NOT_CONFIGURED", "409 PROFESSIONAL_ARCHIVED", "409 SERVICE_ARCHIVED"] },
    ],
  },
  {
    id: "appointments",
    name: "Marcações",
    description: "SCHEDULED → COMPLETED | CANCELED | NO_SHOW (todos finais). Instantes ISO-8601 com Z ou offset; intervalo [startAt, endAt). A base de dados impede sobreposições (409 APPOINTMENT_CONFLICT).",
    endpoints: [
      {
        id: "appointments.create",
        method: "POST",
        path: `${ORG}/appointments`,
        summary: "Criar marcação (fica SCHEDULED)",
        permission: "appointments.create",
        scope: "catalog.write",
        body: [{ name: "customerId", type: "uuid", required: true }, { name: "professionalId", type: "uuid", required: true }, { name: "serviceId", type: "uuid", required: true }, { name: "startAt", type: "ISO-8601 com Z/offset, minuto certo", required: true }, { name: "notes", type: "string ≤2000" }],
        success: "201 Appointment",
        errors: ["409 APPOINTMENT_CONFLICT", "409 APPOINTMENT_OUTSIDE_AVAILABILITY", "400 BOOKING_HORIZON_EXCEEDED", "409 TIMEZONE_NOT_CONFIGURED", "409 CUSTOMER_ARCHIVED / PROFESSIONAL_ARCHIVED / SERVICE_ARCHIVED"],
      },
      { id: "appointments.list", method: "GET", path: `${ORG}/appointments`, summary: "Listar marcações (intervalo obrigatório ≤ 31 dias)", permission: "appointments.read", scope: "catalog.read", query: [{ name: "from", type: "YYYY-MM-DD (local)", required: true }, { name: "to", type: "YYYY-MM-DD (local)", required: true }, { name: "professionalId", type: "uuid" }, { name: "customerId", type: "uuid" }, { name: "serviceId", type: "uuid" }, status("SCHEDULED | COMPLETED | CANCELED | NO_SHOW"), limit(500, 200)], success: "200 Appointment[]" },
      { id: "appointments.get", method: "GET", path: `${ORG}/appointments/{appointmentId}`, summary: "Obter marcação", permission: "appointments.read", scope: "catalog.read", success: "200 Appointment", errors: ["404 APPOINTMENT_NOT_FOUND"] },
      { id: "appointments.update", method: "PATCH", path: `${ORG}/appointments/{appointmentId}`, summary: "Reagendar (startAt/professionalId) ou notas", permission: "appointments.update", scope: "catalog.write", body: [{ name: "startAt", type: "ISO-8601" }, { name: "professionalId", type: "uuid" }, { name: "notes", type: "string | null" }], success: "200 Appointment", errors: ["409 APPOINTMENT_CONFLICT", "409 INVALID_APPOINTMENT_STATE"] },
      { id: "appointments.cancel", method: "POST", path: `${ORG}/appointments/{appointmentId}/cancel`, summary: "Cancelar", permission: "appointments.update", scope: "catalog.write", body: [{ name: "reason", type: "string 1..500" }], success: "200 Appointment", errors: ["409 INVALID_APPOINTMENT_STATE"] },
      { id: "appointments.complete", method: "POST", path: `${ORG}/appointments/{appointmentId}/complete`, summary: "Concluir (a partir da hora de início)", permission: "appointments.update", scope: "catalog.write", success: "200 Appointment", errors: ["409 APPOINTMENT_COMPLETION_TOO_EARLY", "409 INVALID_APPOINTMENT_STATE"] },
      { id: "appointments.noShow", method: "POST", path: `${ORG}/appointments/{appointmentId}/no-show`, summary: "Registar falta (a partir da hora de início, sem corpo)", permission: "appointments.update", scope: "catalog.write", success: "200 Appointment", errors: ["409 APPOINTMENT_NO_SHOW_TOO_EARLY", "409 INVALID_APPOINTMENT_STATE"] },
      { id: "appointments.slots", method: "GET", path: `${ORG}/professionals/{professionalId}/bookable-slots`, summary: "Horários reserváveis de um dia (indicativos)", permission: "appointments.read", scope: "catalog.read", query: [{ name: "date", type: "YYYY-MM-DD", required: true }, { name: "serviceId", type: "uuid", required: true }], success: "200 { timezone, date, durationMinutes, slots[] }" },
    ],
  },
];

/** Errors any endpoint may return (envelope `{ "error": { "code", "message" } }`). */
export const COMMON_ERRORS: { status: number; code: string; meaning: string }[] = [
  { status: 400, code: "VALIDATION_ERROR", meaning: "Corpo/parâmetros inválidos (campos desconhecidos são rejeitados)." },
  { status: 401, code: "UNAUTHORIZED", meaning: "Sem credencial, credencial inválida, expirada ou revogada." },
  { status: 403, code: "FORBIDDEN", meaning: "Papel sem a permissão, âmbito (scope) em falta, ou credencial de outra organização." },
  { status: 403, code: "ENTITLEMENT_REQUIRED", meaning: "A subscrição da organização não inclui o módulo (catalog.enabled)." },
  { status: 404, code: "NOT_FOUND", meaning: "Recurso inexistente ou de outra organização (nunca revela qual)." },
  { status: 409, code: "CONFLICT", meaning: "Conflito com o estado actual." },
  { status: 503, code: "UPSTREAM_UNAVAILABLE", meaning: "UL Platform ou base de dados indisponível — falha fechada, tentar de novo." },
  { status: 500, code: "INTERNAL_ERROR", meaning: "Erro inesperado; nunca inclui SQL nem detalhes internos. Guardar o X-Request-Id." },
];

export function allEndpoints(): ApiEndpoint[] {
  return API_MODULES.flatMap((m) => m.endpoints);
}
