"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { addOrderItem, cancelOrder, completeOrder, confirmOrder, getOrder, removeOrderItem, updateOrderCustomer, updateOrderItemQuantity } from "../../../../../lib/api/orders";
import { listCustomers } from "../../../../../lib/api/customers";
import { listProducts } from "../../../../../lib/api/products";
import type { Order } from "../../../../../lib/api/types";
import { useAsync } from "../../../../../lib/useAsync";
import { useCustomerNames } from "../../../../../lib/useCustomerNames";
import { statusInfo } from "../../../../../lib/status";
import { displayQuantity, formatMoney, formatQuantity, unitLabel } from "../../../../../lib/format";
import { localDateTime } from "../../../../../lib/datetime";
import { useOrganizationTimezone } from "../../../../../lib/appointments/components";
import { DetailGuard } from "../../../../../components/patterns/DetailGuard";
import { ResourceHeader, Section } from "../../../../../components/patterns/Page";
import { Badge, DataTable, DetailList, Timeline } from "../../../../../components/ui/Data";
import { ErrorNotice } from "../../../../../components/ui/Feedback";
import { Button } from "../../../../../components/ui/Button";
import { Field } from "../../../../../components/ui/Form";
import { ConfirmDialog } from "../../../../../components/ui/Overlay";
import { useToast } from "../../../../../components/ui/Toast";

const DECIMAL = /^\d+(\.\d{1,6})?$/;

export default function OrderDetailPage() {
  const params = useParams<{ organizationId: string; orderId: string }>();
  const org = params.organizationId;
  const order = useAsync(() => getOrder(org, params.orderId), [org, params.orderId]);
  return (
    <DetailGuard state={order} resourceLabel="Pedido" backHref={`/o/${org}/orders`} backLabel="Pedidos" moduleName="Pedidos">
      {(o) => <OrderDetail organizationId={org} order={o} onChange={order.setData} />}
    </DetailGuard>
  );
}

type Transition = "confirm" | "complete" | "cancel";

/** Order lifecycle (ADR-032): DRAFT → CONFIRMED (consumes stock) → COMPLETED; CANCELED from DRAFT or CONFIRMED (reverses stock). Every transition is confirmed and the screen re-renders from the server's response. */
function OrderDetail({ organizationId, order, onChange }: { organizationId: string; order: Order; onChange: (o: Order) => void }) {
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === organizationId)?.roleKey;
  const canWrite = roleCan(roleKey, "orders.update");
  const tz = useOrganizationTimezone(organizationId);
  const toast = useToast();
  const isDraft = order.status === "DRAFT";
  const editable = isDraft && canWrite;
  const customers = useAsync(() => listCustomers(organizationId, { status: "ACTIVE", limit: 100 }), [organizationId], { enabled: editable });
  const names = useCustomerNames(organizationId, order.customerId ? [order.customerId] : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [transition, setTransition] = useState<Transition | null>(null);

  async function run(action: () => Promise<Order>, success?: string) {
    setBusy(true);
    setError(null);
    try {
      onChange(await action());
      if (success) toast.success(success);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const status = statusInfo("order", order.status);
  const when = (iso: string) => (tz.timezone ? localDateTime(iso, tz.timezone) : new Date(iso).toLocaleString("pt-PT"));
  const dialogs: Record<Transition, { title: string; description: string; label: string; destructive: boolean; action: () => Promise<Order>; success: string }> = {
    confirm: {
      title: "Confirmar pedido?",
      description: "O stock de cada artigo é descontado agora. Se algum produto não tiver stock suficiente ou estiver arquivado, nada é alterado.",
      label: "Confirmar pedido",
      destructive: false,
      action: () => confirmOrder(organizationId, order.id),
      success: "Pedido confirmado.",
    },
    complete: {
      title: "Concluir pedido?",
      description: "Marca o pedido como entregue/concluído. Não altera o stock.",
      label: "Concluir",
      destructive: false,
      action: () => completeOrder(organizationId, order.id),
      success: "Pedido concluído.",
    },
    cancel: {
      title: "Cancelar pedido?",
      description: order.status === "CONFIRMED" ? "O stock consumido na confirmação é reposto. O cancelamento não pode ser desfeito." : "O rascunho é cancelado. Não pode ser desfeito.",
      label: order.status === "CONFIRMED" ? "Cancelar e repor stock" : "Cancelar pedido",
      destructive: true,
      action: () => cancelOrder(organizationId, order.id),
      success: "Pedido cancelado.",
    },
  };

  return (
    <div>
      <ResourceHeader
        name={
          <>
            Pedido <code className="mono">{order.id.slice(0, 8)}…</code>
          </>
        }
        status={<Badge tone={status.tone}>{status.label}</Badge>}
        subtitle={`Total ${formatMoney(order.total, order.currency)}`}
        breadcrumbs={[{ label: "Pedidos", href: `/o/${organizationId}/orders` }, { label: order.id.slice(0, 8) }]}
        actions={
          canWrite ? (
            <>
              {isDraft && (
                <Button variant="primary" disabled={busy || order.items.length === 0} onClick={() => setTransition("confirm")}>
                  Confirmar pedido
                </Button>
              )}
              {order.status === "CONFIRMED" && (
                <Button variant="primary" disabled={busy} onClick={() => setTransition("complete")}>
                  Concluir
                </Button>
              )}
              {(isDraft || order.status === "CONFIRMED") && (
                <Button variant="danger" disabled={busy} onClick={() => setTransition("cancel")}>
                  {order.status === "CONFIRMED" ? "Cancelar (repõe stock)" : "Cancelar"}
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      {error ? <ErrorNotice error={error} /> : null}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <Section title="Resumo">
          <div className="card">
            {editable ? (
              <Field label="Cliente">
                <select id="order-customer" className="select" value={order.customerId ?? ""} disabled={busy} onChange={(e) => run(() => updateOrderCustomer(organizationId, order.id, e.target.value || null), "Cliente actualizado.")}>
                  <option value="">Sem cliente (venda anónima/balcão)</option>
                  {order.customerId && !(customers.data ?? []).some((c) => c.id === order.customerId) && <option value={order.customerId}>{names[order.customerId] ?? "…"}</option>}
                  {(customers.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <DetailList
              items={[
                ...(editable
                  ? []
                  : [{ label: "Cliente", value: order.customerId ? <Link href={`/o/${organizationId}/customers/${order.customerId}`}>{names[order.customerId] ?? "…"}</Link> : "Sem cliente (venda anónima/balcão)" }]),
                { label: "Total", value: <strong>{formatMoney(order.total, order.currency)}</strong> },
                { label: "Artigos", value: String(order.items.length) },
              ]}
            />
          </div>
        </Section>
        <Section title="Histórico">
          <Timeline
            label="Histórico do pedido"
            items={[
              { key: "created", label: "Pedido criado", at: when(order.createdAt), tone: "gold" },
              ...(order.status !== "DRAFT" || order.updatedAt !== order.createdAt ? [{ key: "state", label: `Estado actual: ${status.label}`, at: `desde ${when(order.updatedAt)}`, tone: order.status === "CANCELED" ? ("danger" as const) : order.status === "COMPLETED" ? ("success" as const) : ("neutral" as const) }] : []),
            ]}
          />
        </Section>
      </div>

      {editable && (
        <Section title="Adicionar produto">
          <AddItemForm organizationId={organizationId} orderId={order.id} onAdded={(o) => onChange(o)} />
        </Section>
      )}

      <Section title="Artigos" description="Nome e preço de cada artigo ficam fixados quando o artigo é adicionado — alterações posteriores ao produto não mudam este pedido.">
        <DataTable
          rows={order.items}
          rowKey={(i) => i.id}
          empty={{ title: "Nenhum artigo ainda.", description: editable ? "Adiciona produtos acima antes de confirmar." : undefined }}
          columns={[
            { key: "product", header: "Produto", wrap: true, cell: (i) => i.productName },
            {
              key: "qty",
              header: "Quantidade",
              numeric: true,
              cell: (i) =>
                editable ? (
                  <input
                    className="input"
                    aria-label={`Quantidade de ${i.productName}`}
                    inputMode="decimal"
                    defaultValue={formatQuantity(i.quantity)}
                    style={{ maxWidth: 110, textAlign: "right" }}
                    disabled={busy}
                    onBlur={(e) => {
                      const next = e.target.value.trim().replace(",", ".");
                      if (!next || next === formatQuantity(i.quantity)) return;
                      if (!DECIMAL.test(next) || Number(next) <= 0) {
                        setError(new Error("Quantidade inválida — usa um número positivo (até 6 casas decimais)."));
                        e.target.value = formatQuantity(i.quantity);
                        return;
                      }
                      run(() => updateOrderItemQuantity(organizationId, order.id, i.id, next), "Quantidade actualizada.");
                    }}
                  />
                ) : (
                  displayQuantity(i.quantity)
                ),
            },
            { key: "price", header: "Preço unitário", numeric: true, cell: (i) => formatMoney(i.unitPrice, order.currency) },
            { key: "subtotal", header: "Subtotal", numeric: true, cell: (i) => formatMoney(i.subtotal, order.currency) },
            ...(editable
              ? [
                  {
                    key: "remove",
                    header: "Remover",
                    srHeader: true,
                    cell: (i: Order["items"][number]) => (
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => run(() => removeOrderItem(organizationId, order.id, i.id), "Artigo removido.")}>
                        Remover
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Section>

      {transition && (
        <ConfirmDialog
          open
          onClose={() => setTransition(null)}
          title={dialogs[transition].title}
          description={dialogs[transition].description}
          confirmLabel={dialogs[transition].label}
          destructive={dialogs[transition].destructive}
          onConfirm={async () => {
            onChange(await dialogs[transition].action());
            toast.success(dialogs[transition].success);
          }}
        />
      )}
    </div>
  );
}

function AddItemForm({ organizationId, orderId, onAdded }: { organizationId: string; orderId: string; onAdded: (order: Order) => void }) {
  const products = useAsync(async () => (await listProducts(organizationId, { status: "ACTIVE", limit: 100 })).filter((p) => p.price !== null), [organizationId]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = quantity.trim().replace(",", ".");
    if (!productId) return setFieldError("Escolhe um produto");
    if (!DECIMAL.test(value) || Number(value) <= 0) return setFieldError("Indica uma quantidade positiva (até 6 casas decimais)");
    setFieldError(null);
    setSubmitting(true);
    setError(null);
    try {
      onAdded(await addOrderItem(organizationId, orderId, { productId, quantity: value }));
      setProductId("");
      setQuantity("1");
      toast.success("Artigo adicionado.");
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (products.data && products.data.length === 0) {
    return <div className="empty">Nenhum produto activo com preço definido. Define um preço em Produtos para o poder vender.</div>;
  }
  return (
    <form onSubmit={handleSubmit} className="card" noValidate>
      <div className="grid-2">
        <Field label="Produto" error={fieldError}>
          <select id="add-item-product" className="select" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Escolhe um produto…</option>
            {(products.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatMoney(p.price!)} / {unitLabel(p.unit)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quantidade" hint="O subtotal é sempre calculado pelo servidor.">
          <input id="add-item-quantity" className="input" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </Field>
      </div>
      {products.error ? <ErrorNotice error={products.error} /> : null}
      {error ? <ErrorNotice error={error} /> : null}
      <Button type="submit" variant="primary" loading={submitting}>
        {submitting ? "A adicionar…" : "Adicionar ao pedido"}
      </Button>
    </form>
  );
}
