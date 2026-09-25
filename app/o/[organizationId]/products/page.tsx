"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { listCategories } from "../../../../lib/api/categories";
import { createProduct, listProducts } from "../../../../lib/api/products";
import type { Category } from "../../../../lib/api/types";
import { useAsync } from "../../../../lib/useAsync";
import { statusInfo } from "../../../../lib/status";
import { formatMoney, unitLabel } from "../../../../lib/format";
import { LIST_LIMIT, ListPage, StatusFilter, useCreateFromUrl, type StatusFilterValue } from "../../../../components/patterns/ListPage";
import { Badge } from "../../../../components/ui/Data";
import { Button } from "../../../../components/ui/Button";
import { Field, SearchInput } from "../../../../components/ui/Form";
import { Modal } from "../../../../components/ui/Overlay";
import { ErrorNotice } from "../../../../components/ui/Feedback";
import { useToast } from "../../../../components/ui/Toast";

export default function ProductsPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === org)?.roleKey;
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ACTIVE");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [showCreate, setShowCreate] = useCreateFromUrl();
  const products = useAsync(
    () => listProducts(org, { status: statusFilter || undefined, categoryId: categoryFilter || undefined, q: appliedQ || undefined, limit: LIST_LIMIT }),
    [org, statusFilter, categoryFilter, appliedQ],
  );
  const categories = useAsync(() => listCategories(org, { limit: LIST_LIMIT }), [org]);
  const categoryName = (id: string | null) => categories.data?.find((c) => c.id === id)?.name ?? "—";
  const canCreate = roleCan(roleKey, "products.create");

  return (
    <ListPage
      title="Produtos"
      description="Catálogo de produtos. Um produto sem preço não pode ser adicionado a pedidos."
      moduleName="Produtos"
      primaryAction={
        canCreate ? (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + Novo produto
          </Button>
        ) : undefined
      }
      filters={
        <>
          <SearchInput label="Pesquisar por nome…" value={q} onChange={(e) => setQ(e.target.value)} onSubmit={() => setAppliedQ(q.trim())} />
          <StatusFilter value={statusFilter} onChange={setStatusFilter} />
          <select className="select" aria-label="Categoria" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Todas as categorias</option>
            {(categories.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button onClick={() => setAppliedQ(q.trim())}>Filtrar</Button>
        </>
      }
      state={products}
      rowKey={(p) => p.id}
      empty={{ title: "Nenhum produto encontrado." }}
      columns={[
        { key: "name", header: "Nome", wrap: true, cell: (p) => <Link href={`/o/${org}/products/${p.id}`}>{p.name}</Link> },
        { key: "category", header: "Categoria", cell: (p) => categoryName(p.categoryId) },
        { key: "unit", header: "Unidade", cell: (p) => unitLabel(p.unit) },
        { key: "price", header: "Preço", numeric: true, cell: (p) => (p.price !== null ? formatMoney(p.price) : <Badge tone="warning">Sem preço</Badge>) },
        { key: "status", header: "Estado", cell: (p) => <Badge tone={statusInfo("catalog", p.status).tone}>{statusInfo("catalog", p.status).label}</Badge> },
      ]}
    >
      {showCreate && (
        <CreateProductDialog
          organizationId={org}
          categories={categories.data ?? []}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            products.reload();
          }}
        />
      )}
    </ListPage>
  );
}

function CreateProductDialog({ organizationId, categories, onClose, onCreated }: { organizationId: string; categories: Category[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("O nome é obrigatório");
      return;
    }
    setNameError(null);
    setSubmitting(true);
    setError(null);
    try {
      await createProduct(organizationId, { name, description: description || undefined, categoryId: categoryId || undefined, price: price.trim() || undefined });
      toast.success("Produto criado.");
      onCreated();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo produto">
      <form onSubmit={handleSubmit} noValidate>
        <Field label="Nome" error={nameError}>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} data-autofocus required />
        </Field>
        <Field label="Descrição">
          <textarea id="description" className="textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid-2">
          <Field label="Categoria">
            <select id="category" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sem categoria</option>
              {categories
                .filter((c) => c.status === "ACTIVE")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Preço (AOA)" hint="Vazio = sem preço (não vendável em pedidos até ter um)">
            <input id="price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(",", "."))} placeholder="ex.: 1500.00" />
          </Field>
        </div>
        {error ? <ErrorNotice error={error} /> : null}
        <div className="modal-footer">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? "A criar…" : "Criar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
