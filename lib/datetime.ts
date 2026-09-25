/**
 * F27 (ADR-040): Appointment instants are displayed in the ORGANIZATION's
 * configured timezone (`organization_settings.timezone`) — always passed
 * in explicitly, never the browser's own timezone, never UTC by default.
 * Formatting only: this UI never converts local times back to instants
 * (slot instants come from the server's bookable-slots endpoint).
 */

function parts(iso: string | Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const out: Record<string, string> = {};
  for (const part of formatter.formatToParts(typeof iso === "string" ? new Date(iso) : iso)) out[part.type] = part.value;
  return out;
}

function isValid(iso: string | Date): boolean {
  return !Number.isNaN((typeof iso === "string" ? new Date(iso) : iso).getTime());
}

/** "YYYY-MM-DD" of an instant, in the organization's calendar ("—" for a missing/invalid value — never a crash). */
export function localDate(iso: string | Date, timeZone: string): string {
  if (!isValid(iso)) return "—";
  const p = parts(iso, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** "HH:mm" of an instant, on the organization's wall clock. */
export function localTime(iso: string | Date, timeZone: string): string {
  if (!isValid(iso)) return "—";
  const p = parts(iso, timeZone);
  return `${p.hour}:${p.minute}`;
}

export function localDateTime(iso: string | Date, timeZone: string): string {
  if (!isValid(iso)) return "—";
  return `${localDate(iso, timeZone)} ${localTime(iso, timeZone)}`;
}

/** Today's date in the organization's calendar (not the browser's). */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return localDate(now, timeZone);
}

/** Pure calendar arithmetic on "YYYY-MM-DD". */
export function addDaysTo(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Agendada",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
  NO_SHOW: "Falta",
};

export function appointmentStatusBadge(status: string): string {
  if (status === "SCHEDULED") return "badge badge-gold";
  if (status === "COMPLETED") return "badge badge-success";
  if (status === "NO_SHOW") return "badge badge-warning";
  return "badge";
}
