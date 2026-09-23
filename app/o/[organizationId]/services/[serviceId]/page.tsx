"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { getService, updateService } from "../../../../../lib/api/services";
import { ApiError } from "../../../../../lib/api/errors";
import type { Service } from "../../../../../lib/api/types";

export default function ServiceDetailPage() {
  const params = useParams<{ organizationId: string; serviceId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;

  const [service, setService] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setError(null);
    setNotFound(false);
    try {
      const s = await getService(params.organizationId, params.serviceId);
      setService(s);
      setName(s.name);
      setDescription(s.description ?? "");
      setDurationMinutes(String(s.durationMinutes));
      setPrice(s.price ?? "");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.serviceId]);

  const canEdit = roleCan(roleKey, "services.update");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration <= 0) {
      setError(new Error("A duração tem de ser um número inteiro de minutos maior que zero"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateService(params.organizationId, params.serviceId, {
        name,
        description: description || null,
        durationMinutes: duration,
        price: price ? Number(price) : null,
      });
      setService(updated);
    } catch (err) {
      setError(err as Error);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!service) return;
    setError(null);
    try {
      const updated = await updateService(params.organizationId, params.serviceId, { status: service.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" });
      setService(updated);
    } catch (err) {
      setError(err as Error);
    }
  }

  if (notFound) {
    return (
      <div className="empty-state card">
        Serviço não encontrado. <Link href={`/o/${params.organizationId}/services`}>Voltar à lista</Link>
      </div>
    );
  }

  if (!service && !error) return <div className="empty-state">A carregar…</div>;

  return (
    <div>
      <p>
        <Link href={`/o/${params.organizationId}/services`}>← Serviços</Link>
      </p>
      <h1 style={{ fontSize: 20 }}>{service?.name}</h1>

      {error && (
        <div className="card error-text" style={{ marginBottom: 16 }}>
          {error.message}
          {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
        </div>
      )}

      {service && (
        <form onSubmit={handleSave} className="card">
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required />
          </div>
          <div className="field">
            <label htmlFor="description">Descrição</label>
            <textarea id="description" className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label htmlFor="duration">Duração (minutos)</label>
            <input id="duration" className="input" type="number" min="1" step="1" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} disabled={!canEdit} required />
          </div>
          <div className="field">
            <label htmlFor="price">Preço (AOA)</label>
            <input id="price" className="input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} disabled={!canEdit} placeholder="Sem preço" />
          </div>
          <div className="field">
            <label>Estado</label>
            <span className={`badge${service.status === "ACTIVE" ? " badge-success" : ""}`}>{service.status}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {canEdit && (
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "A guardar…" : "Guardar alterações"}
              </button>
            )}
            {canEdit && (
              <button type="button" className="btn btn-danger" onClick={handleToggleStatus}>
                {service.status === "ACTIVE" ? "Arquivar" : "Reactivar"}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
