import type { BadgeTone } from "../components/ui/Data";

/**
 * F29: one vocabulary for every status value the APIs return, so a status
 * reads the same on every page (previously raw enums like `ACTIVE` in most
 * modules and pt-PT labels only in Appointments). Values verified against
 * the backend enums; an unknown value renders as-is (never hidden).
 */
const STATUS: Record<string, Record<string, { label: string; tone: BadgeTone }>> = {
  catalog: {
    ACTIVE: { label: "Activo", tone: "success" },
    ARCHIVED: { label: "Arquivado", tone: "neutral" },
  },
  order: {
    DRAFT: { label: "Rascunho", tone: "neutral" },
    CONFIRMED: { label: "Confirmado", tone: "gold" },
    COMPLETED: { label: "Concluído", tone: "success" },
    CANCELED: { label: "Cancelado", tone: "neutral" },
  },
  appointment: {
    SCHEDULED: { label: "Agendada", tone: "gold" },
    COMPLETED: { label: "Concluída", tone: "success" },
    CANCELED: { label: "Cancelada", tone: "neutral" },
    NO_SHOW: { label: "Falta", tone: "warning" },
  },
  credential: {
    ACTIVE: { label: "Activa", tone: "success" },
    REVOKED: { label: "Revogada", tone: "neutral" },
  },
  webhook: {
    ACTIVE: { label: "Activo", tone: "success" },
    REVOKED: { label: "Revogado", tone: "neutral" },
  },
  membership: {
    active: { label: "Activo", tone: "success" },
    invited: { label: "Convidado", tone: "gold" },
    suspended: { label: "Suspenso", tone: "warning" },
  },
  movement: {
    RECEIPT: { label: "Entrada", tone: "success" },
    ADJUSTMENT_IN: { label: "Ajuste +", tone: "gold" },
    ADJUSTMENT_OUT: { label: "Ajuste −", tone: "warning" },
  },
};

export type StatusDomain = keyof typeof STATUS;

export function statusInfo(domain: StatusDomain, value: string): { label: string; tone: BadgeTone } {
  return STATUS[domain]?.[value] ?? { label: value, tone: "neutral" };
}

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  STAFF: "Colaborador",
};
