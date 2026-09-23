"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { createCustomer, listCustomers } from "../../../../lib/api/customers";
import { ApiError } from "../../../../lib/api/errors";
import type { Customer } from "../../../../lib/api/types";

export default function CustomersPage() {
  const params = useParams<{ organizationId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;

  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "ARCHIVED">("ACTIVE");
  const [q, setQ] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setError(null);
    try {
      setCustomers(await listCustomers(params.organizationId, { status: statusFilter || undefined, q: q || undefined }));
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
        <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>Clientes</h1>
        {roleCan(roleKey, "customers.create") && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Novo cliente
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          className="input"
          placeholder="Pesquisar por nome, email ou telefone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          style={{ maxWidth: 280 }}
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

      {error && (
        <div className="card error-text" style={{ marginBottom: 16 }}>
          {error.message}
          {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
        </div>
      )}

      {showCreate && (
        <CreateCustomerForm
          organizationId={params.organizationId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {customers === null && !error ? (
        <div className="empty-state">A carregar…</div>
      ) : customers && customers.length === 0 ? (
        <div className="empty-state card">Nenhum cliente encontrado.</div>
      ) : customers ? (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Contacto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/o/${params.organizationId}/customers/${c.id}`}>{c.name}</Link>
                </td>
                <td>{[c.email, c.phone].filter(Boolean).join(" · ") || "—"}</td>
                <td>
                  <span className={`badge${c.status === "ACTIVE" ? " badge-success" : ""}`}>{c.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function CreateCustomerForm({ organizationId, onClose, onCreated }: { organizationId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(new Error("O nome é obrigatório"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createCustomer(organizationId, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        notes: notes || undefined,
      });
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
        <label htmlFor="email">Email</label>
        <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="phone">Telefone</label>
        <input id="phone" className="input" placeholder="+244923456789" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="notes">Notas</label>
        <textarea id="notes" className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && (
        <p className="error-text">
          {error.message}
          {error instanceof ApiError && error.requestId && <span className="request-ref"> — Referência: {error.requestId}</span>}
        </p>
      )}
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
