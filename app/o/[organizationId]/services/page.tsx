"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { createService, listServices } from "../../../../lib/api/services";
import { ApiError } from "../../../../lib/api/errors";
import type { Service } from "../../../../lib/api/types";

export default function ServicesPage() {
  const params = useParams<{ organizationId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;

  const [services, setServices] = useState<Service[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "ARCHIVED">("ACTIVE");
  const [q, setQ] = useState("");
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setError(null);
    try {
      setServices(await listServices(params.organizationId, { status: statusFilter || undefined, q: q || undefined }));
    } catch (err) {
      setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>Serviços</h1>
        {roleCan(roleKey, "services.create") && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Novo serviço
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Pesquisar por nome…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          style={{ maxWidth: 240 }}
        />
        <select className="select" style={{ maxWidth: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | "ACTIVE" | "ARCHIVED")}>
          <option value="">Todos os estados</option>
          <option value="ACTIVE">Activos</option>
          <option value="ARCHIVED">Arquivados</option>
        </select>
        <button className="btn" onClick={load}>
          Filtrar
        </button>
      </div>

      {error && <ErrorBanner error={error} />}

      {showCreate && (
        <CreateServiceForm
          organizationId={params.organizationId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {services === null && !error ? (
        <div className="empty-state">A carregar…</div>
      ) : services && services.length === 0 ? (
        <div className="empty-state card">Nenhum serviço encontrado.</div>
      ) : services ? (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Duração</th>
              <th>Preço</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/o/${params.organizationId}/services/${s.id}`}>{s.name}</Link>
                </td>
                <td>{s.durationMinutes} min</td>
                <td>{s.price !== null ? `${s.price} AOA` : <span className="badge badge-warning">Sem preço</span>}</td>
                <td>
                  <span className={`badge${s.status === "ACTIVE" ? " badge-success" : ""}`}>{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function ErrorBanner({ error }: { error: ApiError | Error }) {
  if (error instanceof ApiError) {
    if (error.status === 401) return <div className="card error-text">A tua sessão expirou. Por favor entra de novo.</div>;
    if (error.status === 403)
      return (
        <div className="card error-text">
          {error.code === "ENTITLEMENT_REQUIRED" ? "Esta organização não tem o módulo de Serviços activo no seu plano." : "Não tens permissão para esta operação."}
        </div>
      );
    return (
      <div className="card error-text">
        {error.message}
        {error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
      </div>
    );
  }
  return <div className="card error-text">{error.message}</div>;
}

function CreateServiceForm({ organizationId, onClose, onCreated }: { organizationId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(new Error("O nome é obrigatório"));
      return;
    }
    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration <= 0) {
      setError(new Error("A duração tem de ser um número inteiro de minutos maior que zero"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createService(organizationId, { name, description: description || undefined, durationMinutes: duration, price: price ? Number(price) : undefined });
      onCreated();
    } catch (err) {
      setError(err as Error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 16 }}>
      <div className="field">
        <label htmlFor="name">Nome</label>
        <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="description">Descrição</label>
        <textarea id="description" className="textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="duration">Duração (minutos)</label>
        <input id="duration" className="input" type="number" min="1" step="1" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="price">Preço (AOA)</label>
        <input id="price" className="input" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Sem preço" />
      </div>
      {error && <ErrorBanner error={error} />}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "A criar…" : "Criar"}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
