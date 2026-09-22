"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { archiveCategory, createCategory, listCategories } from "../../../../lib/api/categories";
import { ApiError } from "../../../../lib/api/errors";
import type { Category } from "../../../../lib/api/types";

export default function CategoriesPage() {
  const params = useParams<{ organizationId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;

  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setError(null);
    try {
      setCategories(await listCategories(params.organizationId));
    } catch (err) {
      setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await createCategory(params.organizationId, { name, description: description || undefined });
      setName("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err as Error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive(id: string) {
    try {
      await archiveCategory(params.organizationId, id);
      await load();
    } catch (err) {
      setError(err as Error);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20 }}>Categorias</h1>

      {error && (
        <div className="card error-text" style={{ marginBottom: 16 }}>
          {error.message}
          {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
        </div>
      )}

      {roleCan(roleKey, "categories.create") && (
        <form onSubmit={handleCreate} className="card" style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="cname">Nome</label>
            <input id="cname" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field" style={{ flex: 2, marginBottom: 0 }}>
            <label htmlFor="cdesc">Descrição</label>
            <input id="cdesc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "A criar…" : "Adicionar"}
          </button>
        </form>
      )}

      {categories === null && !error ? (
        <div className="empty-state">A carregar…</div>
      ) : categories && categories.length === 0 ? (
        <div className="empty-state card">Nenhuma categoria criada ainda.</div>
      ) : categories ? (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Descrição</th>
              <th>Estado</th>
              {roleCan(roleKey, "categories.delete") && <th />}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.description ?? "—"}</td>
                <td>
                  <span className="badge">{c.status}</span>
                </td>
                {roleCan(roleKey, "categories.delete") && (
                  <td>
                    {c.status === "ACTIVE" && (
                      <button className="btn btn-danger" onClick={() => handleArchive(c.id)}>
                        Arquivar
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
