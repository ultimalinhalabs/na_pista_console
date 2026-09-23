"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { listCustomers } from "../../../../../lib/api/customers";
import { listProducts } from "../../../../../lib/api/products";
import {
  addOrderItem,
  cancelOrder,
  completeOrder,
  confirmOrder,
  getOrder,
  removeOrderItem,
  updateOrderCustomer,
  updateOrderItemQuantity,
} from "../../../../../lib/api/orders";
import { ApiError } from "../../../../../lib/api/errors";
import type { Customer, Order, OrderStatus, Product } from "../../../../../lib/api/types";
import { unitLabel } from "../../../../../lib/format";

const STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: "Rascunho",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
};

function statusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case "CONFIRMED":
      return "badge badge-gold";
    case "COMPLETED":
      return "badge badge-success";
    case "CANCELED":
      return "badge badge-destructive";
    default:
      return "badge";
  }
}

export default function OrderDetailPage() {
  const params = useParams<{ organizationId: string; orderId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;
  const canWrite = roleCan(roleKey, "orders.update");

  const [order, setOrder] = useState<Order | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [actionError, setActionError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError(null);
    setNotFound(false);
    try {
      const [o, customerList, productList] = await Promise.all([
        getOrder(params.organizationId, params.orderId),
        listCustomers(params.organizationId, { status: "ACTIVE" }),
        listProducts(params.organizationId, { status: "ACTIVE" }),
      ]);
      setOrder(o);
      setCustomers(customerList);
      setProducts(productList);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orderId]);

  async function withBusy(action: () => Promise<Order>) {
    setBusy(true);
    setActionError(null);
    try {
      setOrder(await action());
    } catch (err) {
      setActionError(err as Error);
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="empty-state card">
        Pedido não encontrado. <Link href={`/o/${params.organizationId}/orders`}>Voltar aos pedidos</Link>
      </div>
    );
  }

  if (!order && !error) return <div className="empty-state">A carregar…</div>;

  const isDraft = order?.status === "DRAFT";
  const isConfirmed = order?.status === "CONFIRMED";
  const priceableProducts = products.filter((p) => p.price !== null);
  const customerName = customers.find((c) => c.id === order?.customerId)?.name;

  return (
    <div>
      <p>
        <Link href={`/o/${params.organizationId}/orders`}>← Pedidos</Link>
      </p>
      <div className="toolbar">
        <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>Pedido {order?.id.slice(0, 8)}…</h1>
        {order && <span className={statusBadgeClass(order.status)}>{STATUS_LABEL[order.status]}</span>}
      </div>

      {error && (
        <div className="card error-text" style={{ marginBottom: 16 }}>
          {error.message}
          {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
        </div>
      )}
      {actionError && (
        <div className="card error-text" style={{ marginBottom: 16 }}>
          {actionError.message}
          {actionError instanceof ApiError && actionError.requestId && <div className="request-ref">Referência: {actionError.requestId}</div>}
        </div>
      )}

      {order && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="field">
              <label>Cliente</label>
              {isDraft && canWrite ? (
                <select
                  className="select"
                  value={order.customerId ?? ""}
                  onChange={(e) =>
                    withBusy(() => updateOrderCustomer(params.organizationId, order.id, e.target.value || null))
                  }
                  disabled={busy}
                >
                  <option value="">Sem cliente (venda anónima/balcão)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ margin: "4px 0" }}>{customerName ?? "Sem cliente (venda anónima/balcão)"}</p>
              )}
            </div>
            <div className="field">
              <label>Total</label>
              <p style={{ fontSize: 24, margin: "4px 0", color: "var(--color-foreground)" }}>
                {order.total} {order.currency}
              </p>
            </div>
          </div>

          {isDraft && canWrite && (
            <AddItemForm
              organizationId={params.organizationId}
              orderId={order.id}
              products={priceableProducts}
              onAdded={(o) => setOrder(o)}
            />
          )}

          <h2 style={{ fontSize: 16, marginTop: 24 }}>Itens</h2>
          {order.items.length === 0 ? (
            <div className="empty-state card">Nenhum item ainda.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Quantidade</th>
                  <th>Preço unitário</th>
                  <th>Subtotal</th>
                  {isDraft && canWrite && <th></th>}
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productName}</td>
                    <td>
                      {isDraft && canWrite ? (
                        <input
                          className="input"
                          type="number"
                          min="0"
                          step="any"
                          defaultValue={item.quantity}
                          style={{ maxWidth: 120 }}
                          disabled={busy}
                          onBlur={(e) => {
                            const next = e.target.value;
                            if (next && next !== item.quantity) {
                              withBusy(() => updateOrderItemQuantity(params.organizationId, order.id, item.id, next));
                            }
                          }}
                        />
                      ) : (
                        item.quantity
                      )}
                    </td>
                    <td>
                      {item.unitPrice} {order.currency}
                    </td>
                    <td>
                      {item.subtotal} {order.currency}
                    </td>
                    {isDraft && canWrite && (
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busy}
                          onClick={() => withBusy(() => removeOrderItem(params.organizationId, order.id, item.id))}
                        >
                          Remover
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {canWrite && (
            <div className="toolbar" style={{ marginTop: 24 }}>
              {isDraft && (
                <>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => withBusy(() => confirmOrder(params.organizationId, order.id))}>
                    Confirmar pedido
                  </button>
                  <button type="button" className="btn btn-danger" disabled={busy} onClick={() => withBusy(() => cancelOrder(params.organizationId, order.id))}>
                    Cancelar
                  </button>
                </>
              )}
              {isConfirmed && (
                <>
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => withBusy(() => completeOrder(params.organizationId, order.id))}>
                    Concluir
                  </button>
                  <button type="button" className="btn btn-danger" disabled={busy} onClick={() => withBusy(() => cancelOrder(params.organizationId, order.id))}>
                    Cancelar (repõe stock)
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AddItemForm({
  organizationId,
  orderId,
  products,
  onAdded,
}: {
  organizationId: string;
  orderId: string;
  products: Product[];
  onAdded: (order: Order) => void;
}) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const selected = products.find((p) => p.id === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) {
      setError(new Error("Escolhe um produto"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const order = await addOrderItem(organizationId, orderId, { productId, quantity: Number(quantity) });
      onAdded(order);
      setProductId("");
      setQuantity("1");
    } catch (err) {
      setError(err as Error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, marginTop: 0 }}>Adicionar produto</h2>
      {products.length === 0 ? (
        <div className="empty-state">Nenhum produto activo com preço definido.</div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="add-item-product">Produto</label>
            <select id="add-item-product" className="select" value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Escolhe um produto…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.price} AOA / {unitLabel(p.unit)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="add-item-quantity">Quantidade</label>
            <input id="add-item-quantity" className="input" type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </div>
          {selected && (
            <p style={{ fontSize: 14, color: "var(--color-foreground-muted)" }}>
              Subtotal estimado: {(Number(selected.price) * Number(quantity || 0)).toFixed(2)} AOA (o valor final é sempre calculado pelo servidor)
            </p>
          )}
        </>
      )}
      {error && (
        <div className="error-text" style={{ marginBottom: 12 }}>
          {error.message}
          {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
        </div>
      )}
      <button type="submit" className="btn btn-primary" disabled={submitting || products.length === 0}>
        {submitting ? "A adicionar…" : "Adicionar ao pedido"}
      </button>
    </form>
  );
}
