"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { createAppointment, getBookableSlots } from "../../../../../lib/api/appointments";
import { getCustomer, listCustomers } from "../../../../../lib/api/customers";
import { listProfessionals, listServicesForProfessional } from "../../../../../lib/api/professionals";
import type { AssociatedService, BookableSlot, BookableSlots, Customer, Professional } from "../../../../../lib/api/types";
import { todayIn } from "../../../../../lib/datetime";
import { ErrorNotice, SlotPicker, TimezoneMissing, useOrganizationTimezone } from "../../../../../lib/appointments/components";
import { isConflict } from "../../../../../lib/appointments/messages";

export default function NewAppointmentPage() {
  return (
    <Suspense fallback={<div className="empty-state">A carregar…</div>}>
      <NewAppointmentFlow />
    </Suspense>
  );
}

/**
 * F27 create flow (F27A §42): Customer -> Professional -> Service -> Date
 * -> bookable slot (from the API, never computed here) -> review ->
 * create. A 409 APPOINTMENT_CONFLICT (someone else booked the slot first)
 * is shown explicitly, the slots are reloaded, and nothing is retried
 * automatically.
 */
function NewAppointmentFlow() {
  const params = useParams<{ organizationId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;
  const canCreate = roleCan(roleKey, "appointments.create");
  const tz = useOrganizationTimezone(params.organizationId);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<AssociatedService[] | null>(null);
  const [customerId, setCustomerId] = useState(search.get("customerId") ?? "");
  const [professionalId, setProfessionalId] = useState(search.get("professionalId") ?? "");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(search.get("date") ?? "");
  const [slots, setSlots] = useState<BookableSlots | null>(null);
  const [selected, setSelected] = useState<BookableSlot | null>(null);
  const [notes, setNotes] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [conflict, setConflict] = useState(false);

  const [customerQuery, setCustomerQuery] = useState("");

  useEffect(() => {
    listProfessionals(params.organizationId, { status: "ACTIVE" })
      .then(setProfessionals)
      .catch((err: Error) => setError(err));
  }, [params.organizationId]);

  // Active customers only (ADR-042: archived customers cannot be booked); server-side name search for larger lists.
  useEffect(() => {
    listCustomers(params.organizationId, { status: "ACTIVE", ...(customerQuery.trim() ? { q: customerQuery.trim() } : {}) })
      .then(async (rows) => {
        const prefilled = search.get("customerId");
        if (prefilled && !rows.some((c) => c.id === prefilled)) {
          const extra = await getCustomer(params.organizationId, prefilled).catch(() => null);
          if (extra && extra.status === "ACTIVE") rows = [extra, ...rows];
        }
        setCustomers(rows);
      })
      .catch((err: Error) => setError(err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.organizationId, customerQuery]);

  useEffect(() => {
    if (tz.timezone && !date) setDate(todayIn(tz.timezone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tz.timezone]);

  useEffect(() => {
    setServices(null);
    setServiceId("");
    if (!professionalId) return;
    listServicesForProfessional(params.organizationId, professionalId)
      .then((rows) => setServices(rows.filter((s) => s.status === "ACTIVE")))
      .catch((err: Error) => setError(err));
  }, [params.organizationId, professionalId]);

  // Any change to the inputs invalidates previously loaded slots — never book a stale selection.
  useEffect(() => {
    setSlots(null);
    setSelected(null);
  }, [professionalId, serviceId, date]);

  async function loadSlots() {
    if (!professionalId || !serviceId || !date) return;
    setLoadingSlots(true);
    setError(null);
    setSelected(null);
    try {
      setSlots(await getBookableSlots(params.organizationId, professionalId, { date, serviceId }));
    } catch (err) {
      setSlots(null);
      setError(err as Error);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    setConflict(false);
    try {
      const created = await createAppointment(params.organizationId, {
        customerId,
        professionalId,
        serviceId,
        startAt: selected.startAt,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      router.push(`/o/${params.organizationId}/appointments/${created.id}`);
    } catch (err) {
      setError(err as Error);
      if (isConflict(err)) {
        setConflict(true);
        await loadSlots();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const backLink = (
    <p>
      <Link href={`/o/${params.organizationId}/appointments`}>← Marcações</Link>
    </p>
  );

  if (!canCreate) {
    return (
      <div>
        {backLink}
        <div className="empty-state card">Não tens permissão para criar marcações.</div>
      </div>
    );
  }
  if (tz.loading) return <div className="empty-state">A carregar…</div>;
  if (tz.error) return <ErrorNotice error={tz.error} />;
  if (!tz.timezone) {
    return (
      <div>
        {backLink}
        <TimezoneMissing organizationId={params.organizationId} />
      </div>
    );
  }

  const customer = customers.find((c) => c.id === customerId);
  const professional = professionals.find((p) => p.id === professionalId);
  const service = services?.find((s) => s.id === serviceId);

  return (
    <div>
      {backLink}
      <h1 style={{ fontSize: 20 }}>Nova marcação</h1>

      <form onSubmit={handleCreate} className="card" style={{ marginBottom: 24 }}>
        <div className="field">
          <label htmlFor="customer">1. Cliente</label>
          <input
            className="input"
            aria-label="Pesquisar cliente"
            placeholder="Pesquisar cliente por nome…"
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
            style={{ marginBottom: 6 }}
          />
          <select id="customer" className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            <option value="">Escolhe um cliente…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` — ${c.phone}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="professional">2. Profissional</label>
          <select id="professional" className="select" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} required>
            <option value="">Escolhe um profissional…</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="service">3. Serviço</label>
          <select id="service" className="select" value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={!professionalId || services === null} required>
            <option value="">{professionalId ? "Escolhe um serviço…" : "Escolhe primeiro o profissional"}</option>
            {(services ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.durationMinutes} min{s.price !== null ? ` — ${s.price} AOA` : ""}
              </option>
            ))}
          </select>
          {services !== null && services.length === 0 && <div style={{ fontSize: 13, color: "var(--np-foreground-muted)" }}>Este profissional não tem serviços activos associados.</div>}
        </div>

        <div className="field">
          <label htmlFor="date">4. Data</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input id="date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required style={{ maxWidth: 200 }} />
            <button type="button" className="btn" onClick={loadSlots} disabled={!professionalId || !serviceId || !date || loadingSlots}>
              {loadingSlots ? "A consultar…" : "Ver horários disponíveis"}
            </button>
          </div>
        </div>

        {slots && (
          <div className="field">
            <label>5. Horário ({slots.timezone})</label>
            <SlotPicker slots={slots.slots} selected={selected?.startAt ?? null} onSelect={setSelected} />
            <div style={{ fontSize: 13, color: "var(--np-foreground-muted)", marginTop: 6 }}>
              Horários indicativos: só a confirmação garante a marcação.
            </div>
          </div>
        )}

        {selected && customer && professional && service && (
          <div className="card-elevated" aria-label="Revisão" style={{ marginBottom: 12 }}>
            <strong>6. Revisão</strong>
            <div>Cliente: {customer.name}</div>
            <div>Profissional: {professional.name}</div>
            <div>
              Serviço: {service.name} — {slots?.durationMinutes ?? service.durationMinutes} min{service.price !== null ? ` — ${service.price} AOA` : " — sem preço"}
            </div>
            <div>
              Data/hora: {date} às {selected.localStartTime} ({tz.timezone})
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="notes">Notas (opcional)</label>
              <textarea id="notes" className="textarea" rows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}

        {conflict && (
          <div className="card" role="status" style={{ marginBottom: 12, borderColor: "var(--np-warning)" }}>
            Conflito: outra marcação ocupou este horário primeiro. A lista de horários foi recarregada — nada foi marcado.
          </div>
        )}
        {error && <ErrorNotice error={error} />}

        <button type="submit" className="btn btn-primary" disabled={!selected || !customerId || submitting} style={{ marginTop: 12 }}>
          {submitting ? "A marcar…" : "7. Confirmar marcação"}
        </button>
      </form>
    </div>
  );
}
