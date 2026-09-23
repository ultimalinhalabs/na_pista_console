import { callNaPista } from "./naPistaClient";
import type { Availability, ScheduleException, ScheduleRule } from "./types";

export function getSchedule(organizationId: string, professionalId: string) {
  return callNaPista<ScheduleRule[]>("GET", `/organizations/${organizationId}/professionals/${professionalId}/schedule`);
}

/** Whole-set replacement (ADR-039 D10) — never a partial patch; the entire week is sent every time. */
export function replaceSchedule(organizationId: string, professionalId: string, rules: { dayOfWeek: number; startLocalTime: string; endLocalTime: string }[]) {
  return callNaPista<ScheduleRule[]>("PUT", `/organizations/${organizationId}/professionals/${professionalId}/schedule`, { rules });
}

export function listExceptions(organizationId: string, professionalId: string) {
  return callNaPista<ScheduleException[]>("GET", `/organizations/${organizationId}/professionals/${professionalId}/schedule/exceptions`);
}

/** `startLocalTime`/`endLocalTime` both omitted = a closed-marker (fully unavailable that date). */
export function createException(organizationId: string, professionalId: string, input: { date: string; startLocalTime?: string; endLocalTime?: string }) {
  return callNaPista<ScheduleException>("POST", `/organizations/${organizationId}/professionals/${professionalId}/schedule/exceptions`, input);
}

export function removeException(organizationId: string, professionalId: string, exceptionId: string) {
  return callNaPista<{ removed: true }>("DELETE", `/organizations/${organizationId}/professionals/${professionalId}/schedule/exceptions/${exceptionId}`);
}

/** Working availability — NOT a booking guarantee (no Appointment conflicts exist yet, ADR-041). */
export function getAvailability(organizationId: string, professionalId: string, params: { from: string; to: string; serviceId?: string }) {
  const query = new URLSearchParams({ from: params.from, to: params.to, ...(params.serviceId ? { serviceId: params.serviceId } : {}) });
  return callNaPista<Availability>("GET", `/organizations/${organizationId}/professionals/${professionalId}/availability?${query.toString()}`);
}
