"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { listCategories } from "../../../../../lib/api/categories";
import { getInventoryBalance } from "../../../../../lib/api/inventory";
import { archiveProduct, getProduct, updateProduct } from "../../../../../lib/api/products";
import { ApiError } from "../../../../../lib/api/errors";
import type { Product } from "../../../../../lib/api/types";
import { useAsync } from "../../../../../lib/useAsync";
import { useUnsavedChanges } from "../../../../../lib/useUnsavedChanges";
import { statusInfo } from "../../../../../lib/status";
import { formatMoney, displayQuantity, unitLabel } from "../../../../../lib/format";
import { localDateTime } from "../../../../../lib/datetime";
import { useOrganizationTimezone } from "../../../../../lib/appointments/components";
import { DetailGuard } from "../../../../../components/patterns/DetailGuard";
import { ResourceHeader, Section } from "../../../../../components/patterns/Page";
import { Badge, DetailList, Timeline } from "../../../../../components/ui/Data";
import { ErrorNotice, Skeleton } from "../../../../../components/ui/Feedback";
import { Button, ButtonLink } from "../../../../../components/ui/Button";
import { Field } from "../../../../../components/ui/Form";
import { ConfirmDialog } from "../../../../../components/ui/Overlay";
import { useToast } from "../../../../../components/ui/Toast";

export default function ProductDetailPage() {
  const params = useParams<{ organizationId: string; productId: string }>();
  const org = params.organizationId;
  const product = useAsync(() => getProduct(org, params.productId), [org, params.productId]);
  return (
    <DetailGuard state={product} resourceLabel="Produto" backHref={`/o/${org}/products`} backLabel="Produtos" moduleName="Produtos">
      {(p) => <ProductDetail organizationId={org} product={p} onChange={product.setData} />}
    </DetailGuard>
  );
}

function ProductDetail({ organizationId, product, onChange }: { organizationId: string; product: Product; onChange: (p: Product) => void }) {
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === organizationId)?.roleKey;
  const canEdit = roleCan(roleKey, "products.update");
  const canArchive = roleCan(roleKey, "products.delete");
  const tz = useOrganizationTimezone(organizationId);
  const toast = useToast();
  const categories = useAsync(() => listCategories(organizationId, { limit: 100 }), [organizationId]);
  const balance = useAsync(
    () =>
      getInventoryBalance(organizationId, product.id).catch((err) => {
        if (err instanceof ApiError && err.code === "INVENTORY_NOT_FOUND") return null;
        throw err;
      }),
    [organizationId, product.id],
    { enabled: roleCan(roleKey, "inventory.read") },
  );

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [categoryId, setCategoryId] = useState(product.categoryId ?? "");
  const [price, setPrice] = useState(product.price ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    setName(product.name);
    setDescription(product.description ?? "");
    setCategoryId(product.categoryId ?? "");
    setPrice(product.price ?? "");
  }, [product]);

  const dirty = name !== product.name || description !== (product.description ?? "") || categoryId !== (product.categoryId ?? "") || price !== (product.price ?? "");
  useUnsavedChanges(canEdit && dirty);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onChange(await updateProduct(organizationId, product.id, { name, description: description || null, categoryId: categoryId || null, price: price.trim() || null }));
      toast.success("Produto guardado.");
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function reactivate() {
    setError(null);
    try {
      onChange(await updateProduct(organizationId, product.id, { status: "ACTIVE" }));
      toast.success("Produto reactivado.");
    } catch (err) {
      setError(err);
    }
  }

  const status = statusInfo("catalog", product.status);
  const when = (iso: string) => (tz.timezone ? localDateTime(iso, tz.timezone) : new Date(iso).toLocaleString("pt-PT"));

  return (
    <div>
      <ResourceHeader
        name={product.name}
        status={<Badge tone={status.tone}>{status.label}</Badge>}
        subtitle={product.price !== null ? formatMoney(product.price) : "Sem preço — não pode ser adicionado a pedidos"}
        breadcrumbs={[{ label: "Produtos", href: `/o/${organizationId}/products` }, { label: product.name }]}
        actions={
          <>
            <ButtonLink href={`/o/${organizationId}/inventory/${product.id}`}>Ver inventário</ButtonLink>
            {canArchive && product.status === "ACTIVE" && (
              <Button variant="danger" onClick={() => setArchiving(true)}>
                Arquivar
              </Button>
            )}
            {canEdit && product.status === "ARCHIVED" && <Button onClick={reactivate}>Reactivar</Button>}
          </>
        }
      />
      {error ? <ErrorNotice error={error} /> : null}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <Section title="Detalhes">
          <form onSubmit={save} className="card">
            <Field label="Nome">
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} required />
            </Field>
            <Field label="Descrição">
              <textarea id="description" className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Categoria">
              <select id="category" className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={!canEdit}>
                <option value="">Sem categoria</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.status === "ARCHIVED" ? " (arquivada)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Preço (AOA)" hint="Vazio = sem preço. Alterar o preço não muda pedidos já existentes.">
              <input id="price" className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(",", "."))} disabled={!canEdit} placeholder="Sem preço" />
            </Field>
            {canEdit && (
              <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
                {saving ? "A guardar…" : "Guardar alterações"}
              </Button>
            )}
          </form>
        </Section>

        <div>
          {roleCan(roleKey, "inventory.read") && (
            <Section title="Inventário" actions={<Link href={`/o/${organizationId}/inventory/${product.id}`}>Movimentos</Link>}>
              <div className="card">
                {balance.loading ? (
                  <Skeleton height={20} />
                ) : balance.error ? (
                  <ErrorNotice error={balance.error} />
                ) : balance.data ? (
                  <DetailList items={[{ label: "Saldo actual", value: `${displayQuantity(balance.data.quantity)} ${unitLabel(balance.data.productUnit)}` }]} />
                ) : (
                  <span className="muted">Ainda não existe stock registado para este produto.</span>
                )}
              </div>
            </Section>
          )}
          <Section title="Histórico">
            <Timeline
              label="Histórico do produto"
              items={[
                { key: "created", label: "Criado", at: when(product.createdAt), tone: "gold" },
                ...(product.updatedAt !== product.createdAt ? [{ key: "updated", label: "Última alteração", at: when(product.updatedAt) }] : []),
              ]}
            />
            <p className="subtle" style={{ fontSize: 12 }}>
              O histórico detalhado de alterações não está disponível através da API.
            </p>
          </Section>
        </div>
      </div>

      <ConfirmDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        title="Arquivar produto?"
        description={`"${product.name}" deixa de poder ser adicionado a pedidos e de receber movimentos de stock. Pedidos existentes não são afectados. Pode ser reactivado.`}
        confirmLabel="Arquivar"
        onConfirm={async () => {
          onChange(await archiveProduct(organizationId, product.id));
          toast.success("Produto arquivado.");
        }}
      />
    </div>
  );
}
