"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { archiveCustomer, getCustomer, updateCustomer } from "../../../../../lib/api/customers";
import { ApiError } from "../../../../../lib/api/errors";
import type { Customer } from "../../../../../lib/api/types";

export default function CustomerDetailPage() {
  const params = useParams<{ organizationId: string; customerId: string }>();
  const router = useRouter();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setError(null);
    setNotFound(false);
    try {
      const c = await getCustomer(params.organizationId, params.customerId);
      setCustomer(c);
      setName(c.name);
      setEmail(c.email ?? "");
      setPhone(c.phone ?? "");
      setNotes(c.notes ?? "");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.customerId]);

  const canEdit = roleCan(roleKey, "customers.update");
  const canDelete = roleCan(roleKey, "customers.delete");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCustomer(params.organizationId, params.customerId, {
        name,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
      });
      setCustomer(updated);
    } catch (err) {
      setError(err as Error);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    try {
      await archiveCustomer(params.organizationId, params.customerId);
      router.push(`/o/${params.organizationId}/customers`);
    } catch (err) {
      setError(err as Error);
    }
  }

  if (notFound) {
    return (
      <div className="empty-state card">
        Cliente não encontrado. <Link href={`/o/${params.organizationId}/customers`}>Voltar à lista</Link>
      </div>
    );
  }

  if (!customer && !error) return <div className="empty-state">A carregar…</div>;

  return (
    <div>
      <p>
        <Link href={`/o/${params.organizationId}/customers`}>← Clientes</Link>
      </p>
      <h1 style={{ fontSize: 20 }}>{customer?.name}</h1>

      {error && (
        <div className="card error-text" style={{ marginBottom: 16 }}>
          {error.message}
          {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
        </div>
      )}

      {customer && (
        <form onSubmit={handleSave} className="card">
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label htmlFor="phone">Telefone</label>
            <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label htmlFor="notes">Notas</label>
            <textarea id="notes" className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
          </div>
          <div className="field">
            <label>Estado</label>
            <span className={`badge${customer.status === "ACTIVE" ? " badge-success" : ""}`}>{customer.status}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {canEdit && (
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "A guardar…" : "Guardar alterações"}
              </button>
            )}
            {canDelete && customer.status === "ACTIVE" && (
              <button type="button" className="btn btn-danger" onClick={handleArchive}>
                Arquivar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
