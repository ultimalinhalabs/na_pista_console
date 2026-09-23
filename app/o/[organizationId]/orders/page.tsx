"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { listCustomers } from "../../../../lib/api/customers";
import { createOrder, listOrders } from "../../../../lib/api/orders";
import { listProducts } from "../../../../lib/api/products";
import { ApiError } from "../../../../lib/api/errors";
import type { Customer, OrderStatus, OrderSummary, Product } from "../../../../lib/api/types";

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

export default function OrdersPage() {
  const params = useParams<{ organizationId: string }>();
  const router = useRouter();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;

  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [statusFilter, setStatusFilter] = useState<"" | OrderStatus>("");
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setError(null);
    try {
      const [orderList, customerList] = await Promise.all([
        listOrders(params.organizationId, { status: statusFilter || undefined }),
        listCustomers(params.organizationId, { status: "ACTIVE" }),
      ]);
      setOrders(orderList);
      setCustomers(customerList);
    } catch (err) {
      setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? "—";

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>Pedidos</h1>
        {roleCan(roleKey, "orders.create") && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Novo pedido
          </button>
        )}
      </div>

      <div className="toolbar">
        <select className="select" style={{ maxWidth: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | OrderStatus)}>
          <option value="">Todos os estados</option>
          <option value="DRAFT">Rascunho</option>
          <option value="CONFIRMED">Confirmado</option>
          <option value="COMPLETED">Concluído</option>
          <option value="CANCELED">Cancelado</option>
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
        <CreateOrderForm
          organizationId={params.organizationId}
          customers={customers}
          onClose={() => setShowCreate(false)}
          onCreated={(orderId) => router.push(`/o/${params.organizationId}/orders/${orderId}`)}
        />
      )}

      {orders === null && !error ? (
        <div className="empty-state">A carregar…</div>
      ) : orders && orders.length === 0 ? (
        <div className="empty-state card">Nenhum pedido encontrado.</div>
      ) : orders ? (
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Total</th>
              <th>Criado em</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/o/${params.organizationId}/orders/${o.id}`}>{o.id.slice(0, 8)}…</Link>
                </td>
                <td>{customerName(o.customerId)}</td>
                <td>
                  <span className={statusBadgeClass(o.status)}>{STATUS_LABEL[o.status]}</span>
                </td>
                <td>
                  {o.total} {o.currency}
                </td>
                <td>{new Date(o.createdAt).toLocaleString("pt-PT")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function CreateOrderForm({
  organizationId,
  customers,
  onClose,
  onCreated,
}: {
  organizationId: string;
  customers: Customer[];
  onClose: () => void;
  onCreated: (orderId: string) => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [products, setProducts] = useState<Product[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    listProducts(organizationId, { status: "ACTIVE" }).then(setProducts).catch((err) => setError(err as Error));
  }, [organizationId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const order = await createOrder(organizationId, { customerId: customerId || undefined, items: [] });
      onCreated(order.id);
    } catch (err) {
      setError(err as Error);
    } finally {
      setSubmitting(false);
    }
  }

  const priceable = products?.filter((p) => p.price !== null) ?? [];
  const unpriceable = products?.filter((p) => p.price === null) ?? [];

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 16 }}>
      <p style={{ marginTop: 0, color: "var(--color-foreground-muted)", fontSize: 14 }}>
        Cria um pedido em rascunho — os produtos são adicionados a seguir, no detalhe do pedido.
      </p>
      <div className="field">
        <label htmlFor="customer">Cliente (opcional)</label>
        <select id="customer" className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          <option value="">Sem cliente (venda anónima/balcão)</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {priceable.length === 0 && unpriceable.length > 0 && (
        <div className="empty-state" style={{ marginBottom: 12 }}>
          Nenhum produto activo tem preço definido ainda — define um preço em Produtos antes de o adicionar a um pedido.
        </div>
      )}
      {error && <ErrorBanner error={error} />}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "A criar…" : "Criar rascunho"}
        </button>
        <button type="button" className="btn" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function ErrorBanner({ error }: { error: ApiError | Error }) {
  if (error instanceof ApiError) {
    if (error.status === 401) return <div className="card error-text">A tua sessão expirou. Por favor entra de novo.</div>;
    if (error.status === 403)
      return (
        <div className="card error-text">
          {error.code === "ENTITLEMENT_REQUIRED" ? "Esta organização não tem o módulo de Pedidos activo no seu plano." : "Não tens permissão para esta operação."}
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
