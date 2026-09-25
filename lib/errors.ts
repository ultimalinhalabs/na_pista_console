import { ApiError } from "./api/errors";

/**
 * F29: ONE mapping from the APIs' stable error codes to pt-PT messages, so
 * every screen explains the same failure the same way. The server decides;
 * this file only words it. Codes verified against na-pista
 * `src/shared/errors.ts` and ul-platform `src/shared/errors.ts`.
 *
 * Never rendered: SQL, constraint names, stack traces, driver errors —
 * neither backend returns them (error handlers map everything else to a
 * generic INTERNAL_ERROR), and unknown codes fall back to a generic text
 * plus the request reference, never to raw payloads.
 */
const MESSAGES: Record<string, string> = {
  // Generic
  VALIDATION_ERROR: "Os dados enviados não são válidos. Revê os campos e tenta de novo.",
  UNAUTHORIZED: "A tua sessão expirou. Entra novamente para continuar.",
  FORBIDDEN: "Não tens permissão para esta operação.",
  NOT_FOUND: "O recurso pedido não existe ou não pertence a esta organização.",
  CONFLICT: "O pedido entra em conflito com o estado actual. Actualiza a página e tenta de novo.",
  ENTITLEMENT_REQUIRED: "A subscrição actual desta organização não inclui este módulo.",
  LIMIT_EXCEEDED: "Foi atingido um limite do plano desta organização.",
  UPSTREAM_UNAVAILABLE: "Um serviço necessário está temporariamente indisponível. Tenta de novo dentro de momentos.",
  INTERNAL_ERROR: "Ocorreu um erro inesperado no servidor. Se persistir, partilha a referência abaixo com o suporte.",
  NETWORK_ERROR: "Não foi possível contactar o servidor. Verifica a ligação e tenta de novo.",
  // Catalog / commerce
  PRODUCT_NOT_FOUND: "Produto não encontrado.",
  PRODUCT_ARCHIVED: "O produto está arquivado — não aceita novos movimentos nem pedidos.",
  PRODUCT_PRICE_REQUIRED: "O produto não tem preço definido — define um preço antes de o adicionar a um pedido.",
  INVENTORY_NOT_FOUND: "Ainda não existe stock registado para este produto. Regista uma entrada primeiro.",
  INSUFFICIENT_STOCK: "Stock insuficiente para esta operação.",
  ORDER_NOT_FOUND: "Pedido não encontrado.",
  INVALID_ORDER_STATE: "Esta operação não é possível no estado actual do pedido.",
  EMPTY_ORDER: "Um pedido sem artigos não pode ser confirmado.",
  CUSTOMER_ARCHIVED: "O cliente está arquivado — não aceita novas marcações, pedidos nem reagendamentos.",
  // Services / professionals / scheduling
  PROFESSIONAL_ARCHIVED: "O profissional está arquivado — não aceita novas marcações, associações nem reagendamentos.",
  SERVICE_ARCHIVED: "O serviço está arquivado — não aceita novas marcações, associações nem reagendamentos.",
  TIMEZONE_NOT_CONFIGURED: "Esta organização ainda não configurou um fuso horário — configura-o em Definições antes de gerir marcações.",
  // Appointments
  APPOINTMENT_CONFLICT: "Este horário acabou de ser ocupado por outra marcação. Os horários foram actualizados — escolhe outro.",
  APPOINTMENT_OUTSIDE_AVAILABILITY:
    "Este horário está fora da disponibilidade do profissional para este serviço. Para marcar fora do horário normal, adiciona primeiro uma excepção no horário do profissional.",
  BOOKING_HORIZON_EXCEEDED: "Não é possível marcar com mais de 365 dias de antecedência.",
  APPOINTMENT_COMPLETION_TOO_EARLY: "Esta marcação ainda não começou — só pode ser concluída a partir da hora de início.",
  APPOINTMENT_NO_SHOW_TOO_EARLY: "Esta marcação ainda não começou — a falta só pode ser registada a partir da hora de início.",
  INVALID_APPOINTMENT_STATE: "Esta marcação já não pode ser alterada (foi concluída, cancelada ou registada como falta).",
  APPOINTMENT_NOT_FOUND: "Marcação não encontrada.",
};

const GENERIC = "Não foi possível concluir a operação.";

/** Server messages that carry no information beyond the code (generic fallbacks of both backends). */
const UNINFORMATIVE = /^(request failed|invalid request payload|unexpected error|resource not found|insufficient permissions|authentication required|conflicting resource state)$/i;

/** The contextual pt-PT explanation for an error — never empty, never a raw payload. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? GENERIC;
  if (error instanceof TypeError) return MESSAGES.NETWORK_ERROR!;
  return error instanceof Error && error.message ? error.message : GENERIC;
}

/**
 * The backend's own message, shown as secondary detail when it adds
 * information (e.g. "Date 2026-12-25 is already marked fully unavailable",
 * "Cannot remove the organization's last active owner"). Both backends
 * generate these messages themselves and never put SQL/driver text in them
 * (their error handlers collapse anything unexpected to INTERNAL_ERROR).
 */
export function errorDetail(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  const message = error.message?.trim();
  if (!message || UNINFORMATIVE.test(message) || message === MESSAGES[error.code]) return undefined;
  return message;
}

export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

export function isEntitlementError(error: unknown): boolean {
  return errorCode(error) === "ENTITLEMENT_REQUIRED";
}

export function isForbidden(error: unknown): boolean {
  return errorCode(error) === "FORBIDDEN";
}
