"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useSession } from "../../../../lib/session/SessionContext";
import { roleCan } from "../../../../lib/permissions";
import { createOrder, listOrders } from "../../../../lib/api/orders";
import { listCustomers } from "../../../../lib/api/customers";
import { listProducts } from "../../../../lib/api/products";
import type { OrderStatus } from "../../../../lib/api/types";
import { useAsync } from "../../../../lib/useAsync";
import { useCustomerNames } from "../../../../lib/useCustomerNames";
import { statusInfo } from "../../../../lib/status";
import { formatMoney } from "../../../../lib/format";
import { localDateTime } from "../../../../lib/datetime";
import { useOrganizationTimezone } from "../../../../lib/appointments/components";
import { LIST_LIMIT, ListPage, useCreateFromUrl } from "../../../../components/patterns/ListPage";
import { Badge } from "../../../../components/ui/Data";
import { Button } from "../../../../components/ui/Button";
import { Field, SearchInput } from "../../../../components/ui/Form";
import { Modal } from "../../../../components/ui/Overlay";
import { Alert, ErrorNotice } from "../../../../components/ui/Feedback";

const ORDER_STATUSES: OrderStatus[] = ["DRAFT", "CONFIRMED", "COMPLETED", "CANCELED"];

/** Orders: list by status (the API filters by status/customer, newest first), create a DRAFT and continue in its detail page. */
export default function OrdersPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const router = useRouter();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === org)?.roleKey;
  const [statusFilter, setStatusFilter] = useState<"" | OrderStatus>("");
  const [showCreate, setShowCreate] = useCreateFromUrl();
  const orders = useAsync(() => listOrders(org, { status: statusFilter || undefined, limit: LIST_LIMIT }), [org, statusFilter]);
  const names = useCustomerNames(org, orders.data?.map((o) => o.customerId) ?? null);
  const tz = useOrganizationTimezone(org);

  return (
    <ListPage
      title="Pedidos"
      description="Vendas de produtos: rascunho → confirmado (consome stock) → concluído. Os preços ficam fixados no momento em que cada artigo é adicionado."
      moduleName="Pedidos"
      primaryAction={
        roleCan(roleKey, "orders.create") ? (
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            + Novo pedido
          </Button>
        ) : undefined
      }
      filters={
        <select className="select" aria-label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | OrderStatus)}>
          <option value="">Todos os estados</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusInfo("order", s).label}
            </option>
          ))}
        </select>
      }
      state={orders}
      rowKey={(o) => o.id}
      empty={{ title: "Nenhum pedido encontrado." }}
      columns={[
        { key: "id", header: "Pedido", cell: (o) => <Link href={`/o/${org}/orders/${o.id}`}><code className="mono">{o.id.slice(0, 8)}…</code></Link> },
        { key: "customer", header: "Cliente", wrap: true, cell: (o) => (o.customerId ? names[o.customerId] ?? "…" : <span className="subtle">Sem cliente</span>) },
        { key: "status", header: "Estado", cell: (o) => <Badge tone={statusInfo("order", o.status).tone}>{statusInfo("order", o.status).label}</Badge> },
        { key: "total", header: "Total", numeric: true, cell: (o) => formatMoney(o.total, o.currency) },
        { key: "created", header: "Criado em", cell: (o) => (tz.timezone ? localDateTime(o.createdAt, tz.timezone) : new Date(o.createdAt).toLocaleString("pt-PT")) },
      ]}
    >
      {showCreate && <CreateOrderDialog organizationId={org} onClose={() => setShowCreate(false)} onCreated={(orderId) => router.push(`/o/${org}/orders/${orderId}`)} />}
    </ListPage>
  );
}

function CreateOrderDialog({ organizationId, onClose, onCreated }: { organizationId: string; onClose: () => void; onCreated: (orderId: string) => void }) {
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const customers = useAsync(() => listCustomers(organizationId, { status: "ACTIVE", q: customerQuery.trim() || undefined, limit: LIST_LIMIT }), [organizationId, customerQuery]);
  const priced = useAsync(async () => (await listProducts(organizationId, { status: "ACTIVE", limit: LIST_LIMIT })).some((p) => p.price !== null), [organizationId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const order = await createOrder(organizationId, { customerId: customerId || undefined, items: [] });
      onCreated(order.id);
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Novo pedido" description="Cria um pedido em rascunho — os produtos são adicionados a seguir, no detalhe do pedido.">
      <form onSubmit={handleSubmit}>
        <SearchInput label="Pesquisar cliente…" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
        <div style={{ height: 8 }} />
        <Field label="Cliente (opcional)">
          <select id="customer" className="select" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Sem cliente (venda anónima/balcão)</option>
            {(customers.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {priced.data === false && (
          <Alert tone="warning" title="Sem produtos com preço">
            Nenhum produto activo tem preço definido ainda — define um preço em Produtos antes de o adicionar a um pedido.
          </Alert>
        )}
        {error ? <ErrorNotice error={error} /> : null}
        <div className="modal-footer">
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {submitting ? "A criar…" : "Criar rascunho"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
