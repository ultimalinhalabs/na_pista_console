"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listAppointments } from "../api/appointments";
import { getCustomer } from "../api/customers";
import { ApiError } from "../api/errors";
import { getOrganizationSettings } from "../api/organizationSettings";
import { listProfessionals } from "../api/professionals";
import type { Appointment, BookableSlot } from "../api/types";
import { APPOINTMENT_STATUS_LABELS, addDaysTo, appointmentStatusBadge, localDate, localTime, todayIn } from "../datetime";
import { describeAppointmentError } from "./messages";

/** Error card in the existing Console style — pt-PT message for known Appointment codes, plus the request reference. */
export function ErrorNotice({ error }: { error: Error }) {
  return (
    <div className="error-text" role="alert" style={{ marginTop: 12 }}>
      {describeAppointmentError(error)}
      {error instanceof ApiError && error.code === "TIMEZONE_NOT_CONFIGURED" && (
        <>
          {" "}
          <OrgSettingsLink />
        </>
      )}
      {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
    </div>
  );
}

function OrgSettingsLink() {
  const [href, setHref] = useState<string | null>(null);
  useEffect(() => {
    const match = typeof window !== "undefined" ? window.location.pathname.match(/^\/o\/[^/]+/) : null;
    setHref(match ? `${match[0]}/settings` : null);
  }, []);
  return href ? <Link href={href}>Ir para Definições</Link> : null;
}

/**
 * The organization timezone, loaded once per screen. `null` = not
 * configured (ADR-040: no fallback — screens show a blocking message
 * instead of guessing the browser's timezone).
 */
export function useOrganizationTimezone(organizationId: string) {
  const [state, setState] = useState<{ loading: boolean; timezone: string | null; error: Error | null }>({ loading: true, timezone: null, error: null });
  useEffect(() => {
    let active = true;
    getOrganizationSettings(organizationId)
      .then((settings) => active && setState({ loading: false, timezone: settings?.timezone ?? null, error: null }))
      .catch((error: Error) => active && setState({ loading: false, timezone: null, error }));
    return () => {
      active = false;
    };
  }, [organizationId]);
  return state;
}

export function TimezoneMissing({ organizationId }: { organizationId: string }) {
  return (
    <div className="empty-state card">
      Esta organização ainda não configurou um fuso horário — as marcações precisam dele.{" "}
      <Link href={`/o/${organizationId}/settings`}>Configurar em Definições</Link>
    </div>
  );
}

/**
 * Resolves display names for the Professionals/Customers referenced by a
 * list of appointments. The Appointment API deliberately returns ids only
 * (ADR-042 — live records, no name snapshot); names are read live.
 */
export function useAppointmentNames(organizationId: string, appointments: Appointment[] | null) {
  const [professionals, setProfessionals] = useState<Record<string, string>>({});
  const [customers, setCustomers] = useState<Record<string, string>>({});

  useEffect(() => {
    listProfessionals(organizationId)
      .then((rows) => setProfessionals(Object.fromEntries(rows.map((p) => [p.id, p.name]))))
      .catch(() => undefined);
  }, [organizationId]);

  useEffect(() => {
    if (!appointments) return;
    const missing = [...new Set(appointments.map((a) => a.customerId))].filter((id) => !(id in customers));
    if (missing.length === 0) return;
    Promise.all(missing.map((id) => getCustomer(organizationId, id).then((c) => [id, c.name] as const).catch(() => [id, "—"] as const))).then((entries) =>
      setCustomers((prev) => ({ ...prev, ...Object.fromEntries(entries) })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, appointments]);

  return { professionals, customers };
}

export function AppointmentsTable({
  organizationId,
  appointments,
  timezone,
  names,
  showDate = false,
  showProfessional = true,
  showCustomer = true,
}: {
  organizationId: string;
  appointments: Appointment[];
  timezone: string;
  names: { professionals: Record<string, string>; customers: Record<string, string> };
  showDate?: boolean;
  showProfessional?: boolean;
  showCustomer?: boolean;
}) {
  return (
    <table>
      <thead>
        <tr>
          {showDate && <th>Data</th>}
          <th>Hora ({timezone})</th>
          {showProfessional && <th>Profissional</th>}
          {showCustomer && <th>Cliente</th>}
          <th>Serviço</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        {appointments.map((a) => (
          <tr key={a.id} style={a.status === "CANCELED" ? { opacity: 0.55 } : undefined}>
            {showDate && <td>{localDate(a.startAt, timezone)}</td>}
            <td>
              <Link href={`/o/${organizationId}/appointments/${a.id}`}>
                {localTime(a.startAt, timezone)}–{localTime(a.endAt, timezone)}
              </Link>
            </td>
            {showProfessional && <td>{names.professionals[a.professionalId] ?? "…"}</td>}
            {showCustomer && <td>{names.customers[a.customerId] ?? "…"}</td>}
            <td>
              {a.serviceName} <span style={{ color: "var(--np-foreground-muted)" }}>({a.durationMinutes} min)</span>
            </td>
            <td>
              <span className={appointmentStatusBadge(a.status)}>{APPOINTMENT_STATUS_LABELS[a.status] ?? a.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Slots come ONLY from the bookable-slots API (never computed in the browser). Times shown are the server's organization-local start times. */
export function SlotPicker({ slots, selected, onSelect }: { slots: BookableSlot[]; selected: string | null; onSelect: (slot: BookableSlot) => void }) {
  if (slots.length === 0) {
    return <div className="empty-state card">Sem horários disponíveis nesta data para este serviço.</div>;
  }
  return (
    <div role="radiogroup" aria-label="Horários disponíveis" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {slots.map((slot) => (
        <button
          key={slot.startAt}
          type="button"
          role="radio"
          aria-checked={selected === slot.startAt}
          className={`btn${selected === slot.startAt ? " btn-primary" : ""}`}
          onClick={() => onSelect(slot)}
        >
          {slot.localStartTime}
        </button>
      ))}
    </div>
  );
}

/**
 * The embeddable "Marcações" section used by the Professional and Customer
 * detail pages — a bounded, read-only list plus a link into the create
 * flow. It never re-implements booking logic.
 */
export function AppointmentsSection({
  organizationId,
  filter,
  canCreate,
  defaultRangeDays,
}: {
  organizationId: string;
  filter: { professionalId?: string; customerId?: string };
  canCreate: boolean;
  defaultRangeDays: number;
}) {
  const tz = useOrganizationTimezone(organizationId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const names = useAppointmentNames(organizationId, appointments);

  useEffect(() => {
    if (!tz.timezone) return;
    const today = todayIn(tz.timezone);
    setFrom(today);
    setTo(addDaysTo(today, defaultRangeDays - 1));
  }, [tz.timezone, defaultRangeDays]);

  useEffect(() => {
    if (!from || !to) return;
    setError(null);
    setAppointments(null);
    listAppointments(organizationId, { from, to, ...filter })
      .then(setAppointments)
      .catch((err: Error) => setError(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, from, to, filter.professionalId, filter.customerId]);

  const createQuery = new URLSearchParams(Object.entries(filter).filter((entry): entry is [string, string] => Boolean(entry[1])));

  return (
    <section aria-label="Marcações" style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16 }}>Marcações</h2>
      {tz.loading ? (
        <div className="empty-state">A carregar…</div>
      ) : tz.error ? (
        <ErrorNotice error={tz.error} />
      ) : !tz.timezone ? (
        <TimezoneMissing organizationId={organizationId} />
      ) : (
        <>
          <div className="toolbar" style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="appointmentsFrom">De</label>
              <input id="appointmentsFrom" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="appointmentsTo">Até</label>
              <input id="appointmentsTo" className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            {canCreate && (
              <Link className="btn btn-primary" href={`/o/${organizationId}/appointments/new${createQuery.size ? `?${createQuery.toString()}` : ""}`}>
                Nova marcação
              </Link>
            )}
          </div>
          {error ? (
            <ErrorNotice error={error} />
          ) : appointments === null ? (
            <div className="empty-state">A carregar…</div>
          ) : appointments.length === 0 ? (
            <div className="empty-state card">Sem marcações no período indicado.</div>
          ) : (
            <AppointmentsTable
              organizationId={organizationId}
              appointments={appointments}
              timezone={tz.timezone}
              names={names}
              showDate
              showProfessional={!filter.professionalId}
              showCustomer={!filter.customerId}
            />
          )}
        </>
      )}
    </section>
  );
}
