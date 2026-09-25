import { ApiError } from "../api/errors";

/**
 * F27: one place mapping the Appointment API's stable error codes to
 * pt-PT messages, so every screen explains the SAME failure the same way.
 * Server-side codes decide; this only words them.
 */
const MESSAGES: Record<string, string> = {
  APPOINTMENT_CONFLICT: "Este horário acabou de ser ocupado por outra marcação. Os horários foram actualizados — escolhe outro.",
  APPOINTMENT_OUTSIDE_AVAILABILITY:
    "Este horário está fora da disponibilidade do profissional para este serviço. Para marcar fora do horário normal, adiciona primeiro uma excepção no horário do profissional.",
  TIMEZONE_NOT_CONFIGURED: "Esta organização ainda não configurou um fuso horário — configura-o em Definições antes de gerir marcações.",
  BOOKING_HORIZON_EXCEEDED: "Não é possível marcar com mais de 365 dias de antecedência.",
  APPOINTMENT_COMPLETION_TOO_EARLY: "Esta marcação ainda não começou — só pode ser concluída a partir da hora de início.",
  APPOINTMENT_NO_SHOW_TOO_EARLY: "Esta marcação ainda não começou — a falta só pode ser registada a partir da hora de início.",
  INVALID_APPOINTMENT_STATE: "Esta marcação já não pode ser alterada (foi concluída, cancelada ou registada como falta).",
  APPOINTMENT_NOT_FOUND: "Marcação não encontrada.",
  PROFESSIONAL_ARCHIVED: "O profissional está arquivado — não aceita novas marcações nem reagendamentos.",
  SERVICE_ARCHIVED: "O serviço está arquivado — não aceita novas marcações nem reagendamentos.",
  CUSTOMER_ARCHIVED: "O cliente está arquivado — não aceita novas marcações nem reagendamentos.",
  ENTITLEMENT_REQUIRED: "O plano desta organização não inclui este módulo.",
  FORBIDDEN: "Não tens permissão para esta operação.",
};

export function describeAppointmentError(error: Error): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? error.message;
  return error.message;
}

export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === "APPOINTMENT_CONFLICT";
}
