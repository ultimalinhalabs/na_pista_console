"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { listCategories } from "../../../../lib/api/categories";
import { createProduct, listProducts } from "../../../../lib/api/products";
import { ApiError } from "../../../../lib/api/errors";
import type { Category, Product } from "../../../../lib/api/types";

export default function ProductsPage() {
  const params = useParams<{ organizationId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;

  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "ARCHIVED">("ACTIVE");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setError(null);
    try {
      const [productList, categoryList] = await Promise.all([
        listProducts(params.organizationId, {
          status: statusFilter || undefined,
          categoryId: categoryFilter || undefined,
          q: q || undefined,
        }),
        listCategories(params.organizationId),
      ]);
      setProducts(productList);
      setCategories(categoryList);
    } catch (err) {
      setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, categoryFilter]);

  const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>Produtos</h1>
        {roleCan(roleKey, "products.create") && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Novo produto
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
        <select
          className="select"
          style={{ maxWidth: 160 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | "ACTIVE" | "ARCHIVED")}
        >
          <option value="">Todos os estados</option>
          <option value="ACTIVE">Activos</option>
          <option value="ARCHIVED">Arquivados</option>
        </select>
        <select className="select" style={{ maxWidth: 200 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn" onClick={load}>
          Filtrar
        </button>
      </div>

      {error && <ErrorBanner error={error} />}

      {showCreate && (
        <CreateProductForm
          organizationId={params.organizationId}
          categories={categories}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {products === null && !error ? (
        <div className="empty-state">A carregar…</div>
      ) : products && products.length === 0 ? (
        <div className="empty-state card">Nenhum produto encontrado.</div>
      ) : products ? (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/o/${params.organizationId}/products/${p.id}`}>{p.name}</Link>
                </td>
                <td>{categoryName(p.categoryId)}</td>
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
          {error.code === "ENTITLEMENT_REQUIRED"
            ? "Esta organização não tem o módulo de Produtos activo no seu plano."
            : "Não tens permissão para esta operação."}
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

function CreateProductForm({
  organizationId,
  categories,
  onClose,
  onCreated,
}: {
  organizationId: string;
  categories: Category[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
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
      await createProduct(organizationId, {
        name,
        description: description || undefined,
        categoryId: categoryId || undefined,
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
        <label htmlFor="description">Descrição</label>
        <textarea id="description" className="textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="category">Categoria</label>
        <select id="category" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Sem categoria</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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
