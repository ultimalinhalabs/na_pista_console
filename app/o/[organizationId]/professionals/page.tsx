"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { createProfessional, listProfessionals } from "../../../../lib/api/professionals";
import { ApiError } from "../../../../lib/api/errors";
import type { Professional } from "../../../../lib/api/types";

export default function ProfessionalsPage() {
  const params = useParams<{ organizationId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;

  const [professionals, setProfessionals] = useState<Professional[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "ARCHIVED">("ACTIVE");
  const [q, setQ] = useState("");
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setError(null);
    try {
      setProfessionals(await listProfessionals(params.organizationId, { status: statusFilter || undefined, q: q || undefined }));
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
        <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>Profissionais</h1>
        {roleCan(roleKey, "professionals.create") && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Novo profissional
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
        <CreateProfessionalForm
          organizationId={params.organizationId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {professionals === null && !error ? (
        <div className="empty-state">A carregar…</div>
      ) : professionals && professionals.length === 0 ? (
        <div className="empty-state card">Nenhum profissional encontrado.</div>
      ) : professionals ? (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Contacto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {professionals.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/o/${params.organizationId}/professionals/${p.id}`}>{p.name}</Link>
                </td>
                <td>{[p.phone, p.email].filter(Boolean).join(" · ") || "—"}</td>
                <td>
                  <span className={`badge${p.status === "ACTIVE" ? " badge-success" : ""}`}>{p.status}</span>
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
          {error.code === "ENTITLEMENT_REQUIRED" ? "Esta organização não tem o módulo de Profissionais activo no seu plano." : "Não tens permissão para esta operação."}
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

function CreateProfessionalForm({ organizationId, onClose, onCreated }: { organizationId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(new Error("O nome é obrigatório"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createProfessional(organizationId, { name, description: description || undefined, phone: phone || undefined, email: email || undefined });
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
        <label htmlFor="phone">Telefone</label>
        <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+244 923 456 789" />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
