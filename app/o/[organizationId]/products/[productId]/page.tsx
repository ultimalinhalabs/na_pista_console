"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { listCategories } from "../../../../../lib/api/categories";
import { archiveProduct, getProduct, updateProduct } from "../../../../../lib/api/products";
import { ApiError } from "../../../../../lib/api/errors";
import type { Category, Product } from "../../../../../lib/api/types";

export default function ProductDetailPage() {
  const params = useParams<{ organizationId: string; productId: string }>();
  const router = useRouter();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setError(null);
    setNotFound(false);
    try {
      const [p, cats] = await Promise.all([
        getProduct(params.organizationId, params.productId),
        listCategories(params.organizationId),
      ]);
      setProduct(p);
      setName(p.name);
      setDescription(p.description ?? "");
      setCategoryId(p.categoryId ?? "");
      setCategories(cats);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.productId]);

  const canEdit = roleCan(roleKey, "products.update");
  const canDelete = roleCan(roleKey, "products.delete");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProduct(params.organizationId, params.productId, {
        name,
        description: description || null,
        categoryId: categoryId || null,
      });
      setProduct(updated);
    } catch (err) {
      setError(err as Error);
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    try {
      await archiveProduct(params.organizationId, params.productId);
      router.push(`/o/${params.organizationId}/products`);
    } catch (err) {
      setError(err as Error);
    }
  }

  if (notFound) {
    return (
      <div className="empty-state card">
        Produto não encontrado. <Link href={`/o/${params.organizationId}/products`}>Voltar à lista</Link>
      </div>
    );
  }

  if (!product && !error) return <div className="empty-state">A carregar…</div>;

  return (
    <div>
      <p>
        <Link href={`/o/${params.organizationId}/products`}>← Produtos</Link>
      </p>
      <h1 style={{ fontSize: 20 }}>{product?.name}</h1>
      {product && (
        <p>
          <Link href={`/o/${params.organizationId}/inventory/${product.id}`}>Ver inventário deste produto →</Link>
        </p>
      )}

      {error && (
        <div className="card error-text" style={{ marginBottom: 16 }}>
          {error.message}
          {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
        </div>
      )}

      {product && (
        <form onSubmit={handleSave} className="card">
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required />
          </div>
          <div className="field">
            <label htmlFor="description">Descrição</label>
            <textarea
              id="description"
              className="textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="field">
            <label htmlFor="category">Categoria</label>
            <select id="category" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={!canEdit}>
              <option value="">Sem categoria</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Estado</label>
            <span className={`badge${product.status === "ACTIVE" ? " badge-success" : ""}`}>{product.status}</span>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {canEdit && (
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "A guardar…" : "Guardar alterações"}
              </button>
            )}
            {canDelete && product.status === "ACTIVE" && (
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
