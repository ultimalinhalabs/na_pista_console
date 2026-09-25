import { callNaPista } from "./naPistaClient";
import type { Appointment, AppointmentStatus, BookableSlots } from "./types";

/** F27A §41: `from`/`to` are organization-local dates ("YYYY-MM-DD", inclusive, ≤ 31 days) — the server converts them with the organization timezone, so this UI never does timezone math for queries. */
export function listAppointments(
  organizationId: string,
  query: { from: string; to: string; professionalId?: string; customerId?: string; serviceId?: string; status?: AppointmentStatus },
) {
  const params = new URLSearchParams({ from: query.from, to: query.to });
  if (query.professionalId) params.set("professionalId", query.professionalId);
  if (query.customerId) params.set("customerId", query.customerId);
  if (query.serviceId) params.set("serviceId", query.serviceId);
  if (query.status) params.set("status", query.status);
  return callNaPista<Appointment[]>("GET", `/organizations/${organizationId}/appointments?${params.toString()}`);
}

export function getAppointment(organizationId: string, appointmentId: string) {
  return callNaPista<Appointment>("GET", `/organizations/${organizationId}/appointments/${appointmentId}`);
}

/** `startAt` must be a slot instant obtained from `getBookableSlots` — the browser never invents a start time. End/duration/price are always server-derived. */
export function createAppointment(organizationId: string, input: { customerId: string; professionalId: string; serviceId: string; startAt: string; notes?: string }) {
  return callNaPista<Appointment>("POST", `/organizations/${organizationId}/appointments`, input);
}

/** Reschedule (`startAt`/`professionalId`) and/or notes — never status, customer or service (ADR-043). */
export function updateAppointment(organizationId: string, appointmentId: string, patch: { startAt?: string; professionalId?: string; notes?: string | null }) {
  return callNaPista<Appointment>("PATCH", `/organizations/${organizationId}/appointments/${appointmentId}`, patch);
}

export function cancelAppointment(organizationId: string, appointmentId: string, reason?: string) {
  return callNaPista<Appointment>("POST", `/organizations/${organizationId}/appointments/${appointmentId}/cancel`, reason ? { reason } : {});
}

export function completeAppointment(organizationId: string, appointmentId: string) {
  return callNaPista<Appointment>("POST", `/organizations/${organizationId}/appointments/${appointmentId}/complete`);
}

/** ADR-048: SCHEDULED -> NO_SHOW. No body. The server clock decides "too early" (409 APPOINTMENT_NO_SHOW_TOO_EARLY). */
export function markNoShow(organizationId: string, appointmentId: string) {
  return callNaPista<Appointment>("POST", `/organizations/${organizationId}/appointments/${appointmentId}/no-show`);
}

/** Advisory bookable slots for ONE local date and ONE service — computed server-side from F26 availability minus existing bookings. */
export function getBookableSlots(organizationId: string, professionalId: string, query: { date: string; serviceId: string }) {
  const params = new URLSearchParams({ date: query.date, serviceId: query.serviceId });
  return callNaPista<BookableSlots>("GET", `/organizations/${organizationId}/professionals/${professionalId}/bookable-slots?${params.toString()}`);
}
