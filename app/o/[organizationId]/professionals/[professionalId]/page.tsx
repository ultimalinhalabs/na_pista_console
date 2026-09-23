"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { listServices } from "../../../../../lib/api/services";
import {
  associateService,
  getProfessional,
  listServicesForProfessional,
  removeServiceAssociation,
  updateProfessional,
} from "../../../../../lib/api/professionals";
import { createException, getAvailability, getSchedule, listExceptions, removeException, replaceSchedule } from "../../../../../lib/api/scheduling";
import { ApiError } from "../../../../../lib/api/errors";
import type { AssociatedService, Availability, Professional, Service, ScheduleException, ScheduleRule } from "../../../../../lib/api/types";

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

interface DraftInterval {
  startLocalTime: string;
  endLocalTime: string;
}

export default function ProfessionalDetailPage() {
  const params = useParams<{ organizationId: string; professionalId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;
  const canEdit = roleCan(roleKey, "professionals.update");
  const canEditSchedule = roleCan(roleKey, "scheduling.update");

  const [professional, setProfessional] = useState<Professional | null>(null);
  const [associatedServices, setAssociatedServices] = useState<AssociatedService[] | null>(null);
  const [allActiveServices, setAllActiveServices] = useState<Service[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [associationError, setAssociationError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [associating, setAssociating] = useState(false);

  // ---- schedule (weekly rules) — ADR-039 ----
  const [weeklyDraft, setWeeklyDraft] = useState<Record<number, DraftInterval[]>>({});
  const [scheduleError, setScheduleError] = useState<Error | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  // ---- schedule exceptions — ADR-039 D4 ----
  const [exceptions, setExceptions] = useState<ScheduleException[] | null>(null);
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionClosedAllDay, setExceptionClosedAllDay] = useState(true);
  const [exceptionStart, setExceptionStart] = useState("");
  const [exceptionEnd, setExceptionEnd] = useState("");
  const [exceptionError, setExceptionError] = useState<Error | null>(null);
  const [creatingException, setCreatingException] = useState(false);

  // ---- availability preview — working availability, NOT a booking guarantee (ADR-041) ----
  const [availabilityFrom, setAvailabilityFrom] = useState("");
  const [availabilityTo, setAvailabilityTo] = useState("");
  const [availabilityServiceId, setAvailabilityServiceId] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [availabilityError, setAvailabilityError] = useState<Error | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  async function load() {
    setError(null);
    setNotFound(false);
    try {
      const [p, services, active, rules, exceptionRows] = await Promise.all([
        getProfessional(params.organizationId, params.professionalId),
        listServicesForProfessional(params.organizationId, params.professionalId),
        listServices(params.organizationId, { status: "ACTIVE" }),
        getSchedule(params.organizationId, params.professionalId),
        listExceptions(params.organizationId, params.professionalId),
      ]);
      setProfessional(p);
      setName(p.name);
      setDescription(p.description ?? "");
      setPhone(p.phone ?? "");
      setEmail(p.email ?? "");
      setAssociatedServices(services);
      setAllActiveServices(active);
      setWeeklyDraft(buildWeeklyDraft(rules));
      setExceptions(exceptionRows);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.professionalId]);

  function buildWeeklyDraft(rules: ScheduleRule[]): Record<number, DraftInterval[]> {
    const draft: Record<number, DraftInterval[]> = {};
    for (let day = 0; day <= 6; day++) draft[day] = [];
    for (const rule of rules) {
      draft[rule.dayOfWeek]!.push({ startLocalTime: rule.startLocalTime, endLocalTime: rule.endLocalTime });
    }
    return draft;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfessional(params.organizationId, params.professionalId, {
        name,
        description: description || null,
        phone: phone || null,
        email: email || null,
      });
      setProfessional(updated);
    } catch (err) {
      setError(err as Error);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!professional) return;
    setError(null);
    try {
      const updated = await updateProfessional(params.organizationId, params.professionalId, { status: professional.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" });
      setProfessional(updated);
    } catch (err) {
      setError(err as Error);
    }
  }

  async function handleAssociate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedServiceId) return;
    setAssociating(true);
    setAssociationError(null);
    try {
      await associateService(params.organizationId, params.professionalId, selectedServiceId);
      setSelectedServiceId("");
      setAssociatedServices(await listServicesForProfessional(params.organizationId, params.professionalId));
    } catch (err) {
      setAssociationError(err as Error);
    } finally {
      setAssociating(false);
    }
  }

  async function handleRemoveAssociation(serviceId: string) {
    setAssociationError(null);
    try {
      await removeServiceAssociation(params.organizationId, params.professionalId, serviceId);
      setAssociatedServices((prev) => prev?.filter((s) => s.id !== serviceId) ?? null);
    } catch (err) {
      setAssociationError(err as Error);
    }
  }

  // ---- schedule handlers ----

  function addInterval(dayOfWeek: number) {
    setWeeklyDraft((prev) => ({ ...prev, [dayOfWeek]: [...(prev[dayOfWeek] ?? []), { startLocalTime: "", endLocalTime: "" }] }));
  }

  function removeInterval(dayOfWeek: number, index: number) {
    setWeeklyDraft((prev) => ({ ...prev, [dayOfWeek]: (prev[dayOfWeek] ?? []).filter((_, i) => i !== index) }));
  }

  function updateInterval(dayOfWeek: number, index: number, field: keyof DraftInterval, value: string) {
    setWeeklyDraft((prev) => ({
      ...prev,
      [dayOfWeek]: (prev[dayOfWeek] ?? []).map((interval, i) => (i === index ? { ...interval, [field]: value } : interval)),
    }));
  }

  async function handleSaveSchedule(e: React.FormEvent) {
    e.preventDefault();
    setScheduleSaving(true);
    setScheduleSaved(false);
    setScheduleError(null);
    try {
      const rules = Object.entries(weeklyDraft).flatMap(([dayOfWeek, intervals]) =>
        intervals
          .filter((interval) => interval.startLocalTime && interval.endLocalTime)
          .map((interval) => ({ dayOfWeek: Number(dayOfWeek), startLocalTime: interval.startLocalTime, endLocalTime: interval.endLocalTime })),
      );
      await replaceSchedule(params.organizationId, params.professionalId, rules);
      setScheduleSaved(true);
    } catch (err) {
      setScheduleError(err as Error);
    } finally {
      setScheduleSaving(false);
    }
  }

  // ---- exception handlers ----

  async function handleCreateException(e: React.FormEvent) {
    e.preventDefault();
    if (!exceptionDate) return;
    setCreatingException(true);
    setExceptionError(null);
    try {
      const input = exceptionClosedAllDay
        ? { date: exceptionDate }
        : { date: exceptionDate, startLocalTime: exceptionStart, endLocalTime: exceptionEnd };
      const created = await createException(params.organizationId, params.professionalId, input);
      setExceptions((prev) => [...(prev ?? []), created].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)));
      setExceptionDate("");
      setExceptionStart("");
      setExceptionEnd("");
      setExceptionClosedAllDay(true);
    } catch (err) {
      setExceptionError(err as Error);
    } finally {
      setCreatingException(false);
    }
  }

  async function handleRemoveException(exceptionId: string) {
    setExceptionError(null);
    try {
      await removeException(params.organizationId, params.professionalId, exceptionId);
      setExceptions((prev) => prev?.filter((exc) => exc.id !== exceptionId) ?? null);
    } catch (err) {
      setExceptionError(err as Error);
    }
  }

  // ---- availability preview ----

  async function handleCheckAvailability(e: React.FormEvent) {
    e.preventDefault();
    if (!availabilityFrom || !availabilityTo) return;
    setCheckingAvailability(true);
    setAvailabilityError(null);
    setAvailability(null);
    try {
      const result = await getAvailability(params.organizationId, params.professionalId, {
        from: availabilityFrom,
        to: availabilityTo,
        serviceId: availabilityServiceId || undefined,
      });
      setAvailability(result);
    } catch (err) {
      setAvailabilityError(err as Error);
    } finally {
      setCheckingAvailability(false);
    }
  }

  if (notFound) {
    return (
      <div className="empty-state card">
        Profissional não encontrado. <Link href={`/o/${params.organizationId}/professionals`}>Voltar à lista</Link>
      </div>
    );
  }

  if (!professional && !error) return <div className="empty-state">A carregar…</div>;

  const associatedIds = new Set((associatedServices ?? []).map((s) => s.id));
  const availableToAssociate = allActiveServices.filter((s) => !associatedIds.has(s.id));

  return (
    <div>
      <p>
        <Link href={`/o/${params.organizationId}/professionals`}>← Profissionais</Link>
      </p>
      <h1 style={{ fontSize: 20 }}>{professional?.name}</h1>

      {error && (
        <div className="card error-text" style={{ marginBottom: 16 }}>
          {error.message}
          {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
        </div>
      )}

      {professional && (
        <form onSubmit={handleSave} className="card" style={{ marginBottom: 24 }}>
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required />
          </div>
          <div className="field">
            <label htmlFor="description">Descrição</label>
            <textarea id="description" className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label htmlFor="phone">Telefone</label>
            <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label>Estado</label>
            <span className={`badge${professional.status === "ACTIVE" ? " badge-success" : ""}`}>{professional.status}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {canEdit && (
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "A guardar…" : "Guardar alterações"}
              </button>
            )}
            {canEdit && (
              <button type="button" className="btn btn-danger" onClick={handleToggleStatus}>
                {professional.status === "ACTIVE" ? "Arquivar" : "Reactivar"}
              </button>
            )}
          </div>
        </form>
      )}

      <h2 style={{ fontSize: 16 }}>Serviços associados</h2>

      {canEdit && (
        <form onSubmit={handleAssociate} className="card" style={{ marginBottom: 16 }}>
          {availableToAssociate.length === 0 ? (
            <div className="empty-state">Nenhum serviço activo por associar.</div>
          ) : (
            <div className="field">
              <label htmlFor="service">Adicionar serviço</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select id="service" className="select" value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)} style={{ flex: 1 }}>
                  <option value="">Escolhe um serviço…</option>
                  {availableToAssociate.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.durationMinutes} min{s.price !== null ? ` — ${s.price} AOA` : ""}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn btn-primary" disabled={associating || !selectedServiceId}>
                  {associating ? "A associar…" : "Associar"}
                </button>
              </div>
            </div>
          )}
          {associationError && (
            <div className="error-text" style={{ marginTop: 12 }}>
              {associationError.message}
              {associationError instanceof ApiError && associationError.requestId && <div className="request-ref">Referência: {associationError.requestId}</div>}
            </div>
          )}
        </form>
      )}

      {associatedServices === null ? (
        <div className="empty-state">A carregar…</div>
      ) : associatedServices.length === 0 ? (
        <div className="empty-state card">Nenhum serviço associado ainda.</div>
      ) : (
        <table style={{ marginBottom: 24 }}>
          <thead>
            <tr>
              <th>Serviço</th>
              <th>Duração</th>
              <th>Preço</th>
              <th>Estado</th>
              {canEdit && <th></th>}
            </tr>
          </thead>
          <tbody>
            {associatedServices.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/o/${params.organizationId}/services/${s.id}`}>{s.name}</Link>
                </td>
                <td>{s.durationMinutes} min</td>
                <td>{s.price !== null ? `${s.price} AOA` : "—"}</td>
                <td>
                  <span className={`badge${s.status === "ACTIVE" ? " badge-success" : " badge-warning"}`}>{s.status}</span>
                </td>
                {canEdit && (
                  <td>
                    <button type="button" className="btn btn-danger" onClick={() => handleRemoveAssociation(s.id)}>
                      Remover
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ---- Horário (weekly schedule) — ADR-039, F26 ---- */}
      <h2 style={{ fontSize: 16 }}>Horário semanal</h2>
      <form onSubmit={handleSaveSchedule} className="card" style={{ marginBottom: 24 }}>
        {DAY_LABELS.map((label, dayOfWeek) => {
          const intervals = weeklyDraft[dayOfWeek] ?? [];
          return (
            <div key={dayOfWeek} className="field">
              <label>{label}</label>
              {intervals.length === 0 && <div style={{ fontSize: 13, color: "var(--np-foreground-muted)" }}>Fechado</div>}
              {intervals.map((interval, index) => (
                <div key={index} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                  <input
                    className="input"
                    type="time"
                    value={interval.startLocalTime}
                    onChange={(e) => updateInterval(dayOfWeek, index, "startLocalTime", e.target.value)}
                    disabled={!canEditSchedule}
                    style={{ maxWidth: 120 }}
                    required
                  />
                  <span>até</span>
                  <input
                    className="input"
                    type="time"
                    value={interval.endLocalTime}
                    onChange={(e) => updateInterval(dayOfWeek, index, "endLocalTime", e.target.value)}
                    disabled={!canEditSchedule}
                    style={{ maxWidth: 120 }}
                    required
                  />
                  {canEditSchedule && (
                    <button type="button" className="btn btn-danger" onClick={() => removeInterval(dayOfWeek, index)}>
                      Remover
                    </button>
                  )}
                </div>
              ))}
              {canEditSchedule && (
                <button type="button" className="btn" onClick={() => addInterval(dayOfWeek)}>
                  + Adicionar intervalo
                </button>
              )}
            </div>
          );
        })}

        {scheduleError && (
          <div className="error-text" style={{ marginTop: 12 }}>
            {scheduleError.message}
            {scheduleError instanceof ApiError && scheduleError.requestId && <div className="request-ref">Referência: {scheduleError.requestId}</div>}
          </div>
        )}

        {canEditSchedule && (
          <button type="submit" className="btn btn-primary" disabled={scheduleSaving} style={{ marginTop: 12 }}>
            {scheduleSaving ? "A guardar…" : "Guardar horário"}
          </button>
        )}
        {scheduleSaved && <span style={{ marginLeft: 12, color: "var(--np-success)" }}>Guardado.</span>}
      </form>

      {/* ---- Excepções (date-specific overrides) — ADR-039 D4 ---- */}
      <h2 style={{ fontSize: 16 }}>Excepções</h2>
      {canEditSchedule && (
        <form onSubmit={handleCreateException} className="card" style={{ marginBottom: 16 }}>
          <div className="field">
            <label htmlFor="exceptionDate">Data</label>
            <input id="exceptionDate" className="input" type="date" value={exceptionDate} onChange={(e) => setExceptionDate(e.target.value)} required style={{ maxWidth: 200 }} />
          </div>
          <div className="field">
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={exceptionClosedAllDay} onChange={(e) => setExceptionClosedAllDay(e.target.checked)} />
              Fechado o dia todo
            </label>
          </div>
          {!exceptionClosedAllDay && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <input className="input" type="time" value={exceptionStart} onChange={(e) => setExceptionStart(e.target.value)} required style={{ maxWidth: 120 }} />
              <span>até</span>
              <input className="input" type="time" value={exceptionEnd} onChange={(e) => setExceptionEnd(e.target.value)} required style={{ maxWidth: 120 }} />
            </div>
          )}
          <p style={{ fontSize: 13, color: "var(--np-foreground-muted)", marginBottom: 12 }}>
            Uma excepção substitui inteiramente o horário semanal nessa data — nunca é somada às horas normais.
          </p>
          <button type="submit" className="btn btn-primary" disabled={creatingException}>
            {creatingException ? "A adicionar…" : "Adicionar excepção"}
          </button>
          {exceptionError && (
            <div className="error-text" style={{ marginTop: 12 }}>
              {exceptionError.message}
              {exceptionError instanceof ApiError && exceptionError.requestId && <div className="request-ref">Referência: {exceptionError.requestId}</div>}
            </div>
          )}
        </form>
      )}

      {exceptions === null ? (
        <div className="empty-state">A carregar…</div>
      ) : exceptions.length === 0 ? (
        <div className="empty-state card">Nenhuma excepção configurada.</div>
      ) : (
        <table style={{ marginBottom: 24 }}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Horário</th>
              {canEditSchedule && <th></th>}
            </tr>
          </thead>
          <tbody>
            {exceptions.map((exc) => (
              <tr key={exc.id}>
                <td>{exc.date}</td>
                <td>{exc.startLocalTime && exc.endLocalTime ? `${exc.startLocalTime} - ${exc.endLocalTime}` : "Fechado o dia todo"}</td>
                {canEditSchedule && (
                  <td>
                    <button type="button" className="btn btn-danger" onClick={() => handleRemoveException(exc.id)}>
                      Remover
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ---- Disponibilidade (computed, read-only) — distinct from the schedule configuration above (ADR-040 D14) ---- */}
      <h2 style={{ fontSize: 16 }}>Disponibilidade</h2>
      <p style={{ fontSize: 13, color: "var(--np-foreground-muted)" }}>
        Horário de trabalho calculado a partir da configuração acima — não é uma garantia de reserva (ainda não existem Marcações nesta versão).
      </p>
      <form onSubmit={handleCheckAvailability} className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="availabilityFrom">De</label>
            <input id="availabilityFrom" className="input" type="date" value={availabilityFrom} onChange={(e) => setAvailabilityFrom(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="availabilityTo">Até</label>
            <input id="availabilityTo" className="input" type="date" value={availabilityTo} onChange={(e) => setAvailabilityTo(e.target.value)} required />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="availabilityService">Serviço (opcional)</label>
            <select id="availabilityService" className="select" value={availabilityServiceId} onChange={(e) => setAvailabilityServiceId(e.target.value)}>
              <option value="">Qualquer</option>
              {(associatedServices ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.durationMinutes} min
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={checkingAvailability}>
            {checkingAvailability ? "A consultar…" : "Consultar"}
          </button>
        </div>
        {availabilityError && (
          <div className="error-text" style={{ marginTop: 12 }}>
            {availabilityError instanceof ApiError && availabilityError.code === "TIMEZONE_NOT_CONFIGURED"
              ? "Esta organização ainda não configurou um fuso horário — configura-o em Definições antes de consultar disponibilidade."
              : availabilityError.message}
            {availabilityError instanceof ApiError && availabilityError.requestId && <div className="request-ref">Referência: {availabilityError.requestId}</div>}
          </div>
        )}
      </form>

      {availability && (
        availability.days.every((day) => day.workingIntervals.length === 0) ? (
          <div className="empty-state card">Sem disponibilidade no período indicado.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Horário de trabalho ({availability.timezone})</th>
                {availabilityServiceId && <th>Horas de início possíveis</th>}
              </tr>
            </thead>
            <tbody>
              {availability.days.map((day) => (
                <tr key={day.date}>
                  <td>{day.date}</td>
                  <td>{day.workingIntervals.length === 0 ? "—" : day.workingIntervals.map((iv) => `${iv.start}-${iv.end}`).join(", ")}</td>
                  {availabilityServiceId && <td>{day.serviceStartTimes && day.serviceStartTimes.length > 0 ? day.serviceStartTimes.join(", ") : "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
