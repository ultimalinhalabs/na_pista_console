"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { listAppointments } from "../../../../lib/api/appointments";
import { listProfessionals } from "../../../../lib/api/professionals";
import type { Appointment, Professional } from "../../../../lib/api/types";
import { addDaysTo, todayIn } from "../../../../lib/datetime";
import { AppointmentsTable, ErrorNotice, TimezoneMissing, useAppointmentNames, useOrganizationTimezone } from "../../../../lib/appointments/components";
import { PageHeader } from "../../../../components/patterns/Page";

/**
 * F27 day view (F27A §42): one organization-local date, optional
 * Professional filter, the day's appointments (canceled ones shown muted).
 * Not a calendar suite — a practical daily operations list.
 */
export default function AppointmentsDayPage() {
  const params = useParams<{ organizationId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;
  const canCreate = roleCan(roleKey, "appointments.create");

  const tz = useOrganizationTimezone(params.organizationId);
  const [date, setDate] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const names = useAppointmentNames(params.organizationId, appointments);

  useEffect(() => {
    if (tz.timezone) setDate(todayIn(tz.timezone));
  }, [tz.timezone]);

  useEffect(() => {
    listProfessionals(params.organizationId, { status: "ACTIVE" })
      .then(setProfessionals)
      .catch(() => undefined);
  }, [params.organizationId]);

  useEffect(() => {
    if (!date) return;
    setError(null);
    setAppointments(null);
    listAppointments(params.organizationId, { from: date, to: date, professionalId: professionalId || undefined })
      .then(setAppointments)
      .catch((err: Error) => setError(err));
  }, [params.organizationId, date, professionalId]);

  const newHref = `/o/${params.organizationId}/appointments/new?${new URLSearchParams({ ...(date ? { date } : {}), ...(professionalId ? { professionalId } : {}) }).toString()}`;

  return (
    <div>
      <PageHeader
        title="Marcações"
        description="Agenda do dia por profissional. Os horários mostrados estão no fuso horário da organização."
        actions={
          canCreate && tz.timezone ? (
            <Link className="btn btn-primary" href={newHref}>
              Nova marcação
            </Link>
          ) : undefined
        }
      />

      {tz.loading ? (
        <div className="empty-state">A carregar…</div>
      ) : tz.error ? (
        <ErrorNotice error={tz.error} />
      ) : !tz.timezone ? (
        <TimezoneMissing organizationId={params.organizationId} />
      ) : (
        <>
          <div className="card" style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
            <button type="button" className="btn" onClick={() => setDate((d) => addDaysTo(d, -1))} aria-label="Dia anterior">
              ←
            </button>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="day">Data</label>
              <input id="day" className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </div>
            <button type="button" className="btn" onClick={() => setDate((d) => addDaysTo(d, 1))} aria-label="Dia seguinte">
              →
            </button>
            <button type="button" className="btn" onClick={() => setDate(todayIn(tz.timezone!))}>
              Hoje
            </button>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="professionalFilter">Profissional</label>
              <select id="professionalFilter" className="select" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
                <option value="">Todos</option>
                {professionals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <span style={{ fontSize: 13, color: "var(--np-foreground-muted)" }}>Fuso horário: {tz.timezone}</span>
          </div>

          {error ? (
            <ErrorNotice error={error} />
          ) : appointments === null ? (
            <div className="empty-state">A carregar…</div>
          ) : appointments.length === 0 ? (
            <div className="empty-state card">Sem marcações neste dia.</div>
          ) : (
            <AppointmentsTable organizationId={params.organizationId} appointments={appointments} timezone={tz.timezone} names={names} showProfessional={!professionalId} />
          )}
        </>
      )}
    </div>
  );
}
