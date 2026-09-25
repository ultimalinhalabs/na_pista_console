"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { cancelAppointment, completeAppointment, getAppointment, getBookableSlots, markNoShow, updateAppointment } from "../../../../../lib/api/appointments";
import { getCustomer } from "../../../../../lib/api/customers";
import { ApiError } from "../../../../../lib/api/errors";
import { getProfessional, listProfessionals } from "../../../../../lib/api/professionals";
import type { Appointment, BookableSlot, BookableSlots, Customer, Professional } from "../../../../../lib/api/types";
import { APPOINTMENT_STATUS_LABELS, appointmentStatusBadge, localDate, localDateTime, localTime } from "../../../../../lib/datetime";
import { ErrorNotice, SlotPicker, TimezoneMissing, useOrganizationTimezone } from "../../../../../lib/appointments/components";
import { isConflict } from "../../../../../lib/appointments/messages";

/**
 * F27 appointment detail (F27A §42). Mutations are shown only when the
 * role allows (`appointments.update`, UX only — the API is the gate) AND
 * the appointment is SCHEDULED (ADR-043/048: COMPLETED, CANCELED and
 * NO_SHOW are terminal). "Too early" for complete/no-show is decided by the
 * server clock only — the buttons are not hidden by the browser's clock.
 * After every mutation the screen is replaced by the SERVER's response —
 * never an optimistic local guess.
 */
export default function AppointmentDetailPage() {
  const params = useParams<{ organizationId: string; appointmentId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;
  const canUpdate = roleCan(roleKey, "appointments.update");
  const tz = useOrganizationTimezone(params.organizationId);

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);

  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleProfessionals, setRescheduleProfessionals] = useState<Professional[]>([]);
  const [targetProfessionalId, setTargetProfessionalId] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [slots, setSlots] = useState<BookableSlots | null>(null);
  const [selected, setSelected] = useState<BookableSlot | null>(null);
  const [conflict, setConflict] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  function applyServerState(next: Appointment) {
    setAppointment(next);
    setNotes(next.notes ?? "");
  }

  /** `keepError`: refresh the server state after a failed action WITHOUT hiding the error that explains it. */
  async function load(options: { keepError?: boolean } = {}) {
    if (!options.keepError) setError(null);
    setNotFound(false);
    try {
      const a = await getAppointment(params.organizationId, params.appointmentId);
      applyServerState(a);
      const [c, p] = await Promise.all([
        getCustomer(params.organizationId, a.customerId).catch(() => null),
        getProfessional(params.organizationId, a.professionalId).catch(() => null),
      ]);
      setCustomer(c);
      setProfessional(p);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.code === "APPOINTMENT_NOT_FOUND")) setNotFound(true);
      else setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.appointmentId]);

  // Any change of reschedule inputs invalidates loaded slots.
  useEffect(() => {
    setSlots(null);
    setSelected(null);
  }, [targetProfessionalId, targetDate]);

  async function run(action: () => Promise<Appointment>) {
    setBusy(true);
    setError(null);
    try {
      applyServerState(await action());
      return true;
    } catch (err) {
      setError(err as Error);
      // A terminal/changed state, or a time rule the server just evaluated, means our copy may be stale — reload it.
      if (err instanceof ApiError && ["INVALID_APPOINTMENT_STATE", "APPOINTMENT_COMPLETION_TOO_EARLY", "APPOINTMENT_NO_SHOW_TOO_EARLY"].includes(err.code)) await load({ keepError: true });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function openReschedule() {
    if (!appointment || !tz.timezone) return;
    setRescheduleOpen(true);
    setConflict(false);
    setTargetProfessionalId(appointment.professionalId);
    setTargetDate(localDate(appointment.startAt, tz.timezone));
    listProfessionals(params.organizationId, { status: "ACTIVE", serviceId: appointment.serviceId })
      .then(setRescheduleProfessionals)
      .catch((err: Error) => setError(err));
  }

  async function loadRescheduleSlots() {
    if (!appointment || !targetProfessionalId || !targetDate) return;
    setError(null);
    setSelected(null);
    try {
      setSlots(await getBookableSlots(params.organizationId, targetProfessionalId, { date: targetDate, serviceId: appointment.serviceId }));
    } catch (err) {
      setSlots(null);
      setError(err as Error);
    }
  }

  async function confirmReschedule() {
    if (!selected || !appointment) return;
    setBusy(true);
    setError(null);
    setConflict(false);
    try {
      const next = await updateAppointment(params.organizationId, params.appointmentId, {
        startAt: selected.startAt,
        ...(targetProfessionalId !== appointment.professionalId ? { professionalId: targetProfessionalId } : {}),
      });
      applyServerState(next);
      setRescheduleOpen(false);
      setSlots(null);
      setSelected(null);
      if (next.professionalId !== professional?.id) setProfessional(await getProfessional(params.organizationId, next.professionalId).catch(() => null));
    } catch (err) {
      setError(err as Error);
      if (isConflict(err)) {
        // Someone else took that interval first: say so, reload the slots, never retry automatically.
        setConflict(true);
        await loadRescheduleSlots();
      } else if (err instanceof ApiError && err.code === "INVALID_APPOINTMENT_STATE") {
        await load({ keepError: true });
      }
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="empty-state card">
        Marcação não encontrada. <Link href={`/o/${params.organizationId}/appointments`}>Voltar às marcações</Link>
      </div>
    );
  }
  if (tz.loading || (!appointment && !error)) return <div className="empty-state">A carregar…</div>;
  if (!tz.timezone && !tz.error) return <TimezoneMissing organizationId={params.organizationId} />;

  const timezone = tz.timezone;
  const editable = appointment?.status === "SCHEDULED" && canUpdate;

  return (
    <div>
      <p>
        <Link href={`/o/${params.organizationId}/appointments`}>← Marcações</Link>
      </p>
      <h1 style={{ fontSize: 20 }}>Marcação</h1>

      {tz.error && <ErrorNotice error={tz.error} />}

      {appointment && timezone && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="field">
            <label>Estado</label>
            <span className={appointmentStatusBadge(appointment.status)}>{APPOINTMENT_STATUS_LABELS[appointment.status]}</span>
          </div>
          <div className="field">
            <label>Data e hora ({timezone})</label>
            <div>
              {localDate(appointment.startAt, timezone)} · {localTime(appointment.startAt, timezone)}–{localTime(appointment.endAt, timezone)} ({appointment.durationMinutes} min)
            </div>
          </div>
          <div className="field">
            <label>Cliente</label>
            <div>{customer ? <Link href={`/o/${params.organizationId}/customers/${customer.id}`}>{customer.name}</Link> : "—"}</div>
          </div>
          <div className="field">
            <label>Profissional</label>
            <div>{professional ? <Link href={`/o/${params.organizationId}/professionals/${professional.id}`}>{professional.name}</Link> : "—"}</div>
          </div>
          <div className="field">
            <label>Serviço (no momento da marcação)</label>
            <div>
              {appointment.serviceName} — {appointment.servicePrice !== null ? `${appointment.servicePrice} ${appointment.currency}` : "sem preço"}
            </div>
          </div>
          {appointment.status === "CANCELED" && (
            <div className="field">
              <label>Cancelada</label>
              <div>
                {appointment.canceledAt && localDateTime(appointment.canceledAt, timezone)}
                {appointment.cancellationReason ? ` — ${appointment.cancellationReason}` : ""}
              </div>
            </div>
          )}
          {appointment.status === "NO_SHOW" && appointment.noShowAt && (
            <div className="field">
              <label>Falta registada</label>
              <div>
                {localDateTime(appointment.noShowAt, timezone)} — o cliente não compareceu; o horário continua ocupado.
              </div>
            </div>
          )}
          {appointment.status === "COMPLETED" && appointment.completedAt && (
            <div className="field">
              <label>Concluída</label>
              <div>{localDateTime(appointment.completedAt, timezone)}</div>
            </div>
          )}
          <div style={{ fontSize: 13, color: "var(--np-foreground-subtle)" }}>
            Criada {localDateTime(appointment.createdAt, timezone)} · actualizada {localDateTime(appointment.updatedAt, timezone)}
          </div>
        </div>
      )}

      {conflict && (
        <div className="card" role="status" style={{ marginBottom: 12, borderColor: "var(--np-warning)" }}>
          Conflito: outra marcação ocupou esse horário primeiro. Os horários foram recarregados — a marcação não foi alterada.
        </div>
      )}
      {error && <ErrorNotice error={error} />}

      {appointment && (
        <>
          <h2 style={{ fontSize: 16 }}>Notas</h2>
          {editable ? (
            <form
              className="card"
              style={{ marginBottom: 24 }}
              onSubmit={async (e) => {
                e.preventDefault();
                setNotesSaved(false);
                if (await run(() => updateAppointment(params.organizationId, params.appointmentId, { notes: notes.trim() ? notes.trim() : null }))) setNotesSaved(true);
              }}
            >
              <textarea aria-label="Notas" className="textarea" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button type="submit" className="btn" disabled={busy} style={{ marginTop: 8 }}>
                Guardar notas
              </button>
              {notesSaved && <span style={{ marginLeft: 12, color: "var(--np-success)" }}>Guardado.</span>}
            </form>
          ) : (
            <div className="card" style={{ marginBottom: 24 }}>{appointment.notes ?? "—"}</div>
          )}
        </>
      )}

      {editable && appointment && timezone && (
        <>
          <h2 style={{ fontSize: 16 }}>Acções</h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button type="button" className="btn" onClick={openReschedule} disabled={busy}>
              Reagendar
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => completeAppointment(params.organizationId, params.appointmentId))}>
              Concluir
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => run(() => markNoShow(params.organizationId, params.appointmentId))}>
              Marcar como falta
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setCancelOpen(true)} disabled={busy}>
              Cancelar marcação
            </button>
          </div>

          {rescheduleOpen && (
            <div className="card" aria-label="Reagendar" style={{ marginBottom: 16 }}>
              <div className="field">
                <label htmlFor="targetProfessional">Profissional</label>
                <select id="targetProfessional" className="select" value={targetProfessionalId} onChange={(e) => setTargetProfessionalId(e.target.value)}>
                  {!rescheduleProfessionals.some((p) => p.id === appointment.professionalId) && professional && <option value={professional.id}>{professional.name}</option>}
                  {rescheduleProfessionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="targetDate">Nova data</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input id="targetDate" className="input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} style={{ maxWidth: 200 }} />
                  <button type="button" className="btn" onClick={loadRescheduleSlots}>
                    Ver horários disponíveis
                  </button>
                </div>
              </div>
              {slots && <SlotPicker slots={slots.slots} selected={selected?.startAt ?? null} onSelect={setSelected} />}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-primary" disabled={!selected || busy} onClick={confirmReschedule}>
                  Confirmar reagendamento
                </button>
                <button type="button" className="btn" onClick={() => setRescheduleOpen(false)}>
                  Fechar
                </button>
              </div>
            </div>
          )}

          {cancelOpen && (
            <form
              className="card"
              aria-label="Cancelar marcação"
              style={{ marginBottom: 16 }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (await run(() => cancelAppointment(params.organizationId, params.appointmentId, cancelReason.trim() || undefined))) setCancelOpen(false);
              }}
            >
              <div className="field">
                <label htmlFor="cancelReason">Motivo (opcional)</label>
                <input id="cancelReason" className="input" maxLength={500} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
              </div>
              <p style={{ fontSize: 13, color: "var(--np-foreground-muted)" }}>O cancelamento é definitivo e liberta o horário. Para voltar a marcar, cria uma nova marcação.</p>
              <button type="submit" className="btn btn-danger" disabled={busy}>
                Confirmar cancelamento
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
