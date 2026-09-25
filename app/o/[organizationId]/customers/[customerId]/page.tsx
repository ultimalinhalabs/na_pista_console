"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { archiveCustomer, getCustomer, updateCustomer } from "../../../../../lib/api/customers";
import { listOrders } from "../../../../../lib/api/orders";
import type { Customer } from "../../../../../lib/api/types";
import { useAsync } from "../../../../../lib/useAsync";
import { useUnsavedChanges } from "../../../../../lib/useUnsavedChanges";
import { statusInfo } from "../../../../../lib/status";
import { formatMoney } from "../../../../../lib/format";
import { localDateTime } from "../../../../../lib/datetime";
import { AppointmentsSection, useOrganizationTimezone } from "../../../../../lib/appointments/components";
import { DetailGuard } from "../../../../../components/patterns/DetailGuard";
import { ResourceHeader, Section } from "../../../../../components/patterns/Page";
import { Badge, DataTable, Timeline } from "../../../../../components/ui/Data";
import { ErrorNotice } from "../../../../../components/ui/Feedback";
import { Button } from "../../../../../components/ui/Button";
import { Field } from "../../../../../components/ui/Form";
import { ConfirmDialog } from "../../../../../components/ui/Overlay";
import { useToast } from "../../../../../components/ui/Toast";

export default function CustomerDetailPage() {
  const params = useParams<{ organizationId: string; customerId: string }>();
  const org = params.organizationId;
  const customer = useAsync(() => getCustomer(org, params.customerId), [org, params.customerId]);
  return (
    <DetailGuard state={customer} resourceLabel="Cliente" backHref={`/o/${org}/customers`} backLabel="Clientes" moduleName="Clientes">
      {(c) => <CustomerDetail organizationId={org} customer={c} onChange={customer.setData} />}
    </DetailGuard>
  );
}

function CustomerDetail({ organizationId, customer, onChange }: { organizationId: string; customer: Customer; onChange: (c: Customer) => void }) {
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === organizationId)?.roleKey;
  const canEdit = roleCan(roleKey, "customers.update");
  const canArchive = roleCan(roleKey, "customers.delete");
  const tz = useOrganizationTimezone(organizationId);
  const toast = useToast();
  const orders = useAsync(() => listOrders(organizationId, { customerId: customer.id, limit: 10 }), [organizationId, customer.id], { enabled: roleCan(roleKey, "orders.read") });

  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    setName(customer.name);
    setEmail(customer.email ?? "");
    setPhone(customer.phone ?? "");
    setNotes(customer.notes ?? "");
  }, [customer]);

  const dirty = name !== customer.name || email !== (customer.email ?? "") || phone !== (customer.phone ?? "") || notes !== (customer.notes ?? "");
  useUnsavedChanges(canEdit && dirty);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onChange(await updateCustomer(organizationId, customer.id, { name, email: email || null, phone: phone || null, notes: notes || null }));
      toast.success("Cliente guardado.");
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function reactivate() {
    setError(null);
    try {
      onChange(await updateCustomer(organizationId, customer.id, { status: "ACTIVE" }));
      toast.success("Cliente reactivado.");
    } catch (err) {
      setError(err);
    }
  }

  const status = statusInfo("catalog", customer.status);
  const when = (iso: string) => (tz.timezone ? localDateTime(iso, tz.timezone) : new Date(iso).toLocaleString("pt-PT"));

  return (
    <div>
      <ResourceHeader
        name={customer.name}
        status={<Badge tone={status.tone}>{status.label}</Badge>}
        subtitle={[customer.email, customer.phone].filter(Boolean).join(" · ") || undefined}
        breadcrumbs={[{ label: "Clientes", href: `/o/${organizationId}/customers` }, { label: customer.name }]}
        actions={
          <>
            {canArchive && customer.status === "ACTIVE" && (
              <Button variant="danger" onClick={() => setArchiving(true)}>
                Arquivar
              </Button>
            )}
            {canEdit && customer.status === "ARCHIVED" && <Button onClick={reactivate}>Reactivar</Button>}
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
            <Field label="Email">
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Telefone">
              <input id="phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Notas">
              <textarea id="notes" className="textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
            </Field>
            {canEdit && (
              <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
                {saving ? "A guardar…" : "Guardar alterações"}
              </Button>
            )}
          </form>
        </Section>

        <div>
          {roleCan(roleKey, "orders.read") && (
            <Section title="Pedidos recentes" actions={<Link href={`/o/${organizationId}/orders`}>Todos os pedidos</Link>}>
              {orders.error ? (
                <ErrorNotice error={orders.error} />
              ) : (
                <DataTable
                  rows={orders.data}
                  loading={orders.loading && !orders.data}
                  rowKey={(o) => o.id}
                  empty={{ title: "Este cliente ainda não tem pedidos." }}
                  columns={[
                    { key: "created", header: "Criado", cell: (o) => <Link href={`/o/${organizationId}/orders/${o.id}`}>{when(o.createdAt)}</Link> },
                    { key: "status", header: "Estado", cell: (o) => <Badge tone={statusInfo("order", o.status).tone}>{statusInfo("order", o.status).label}</Badge> },
                    { key: "total", header: "Total", numeric: true, cell: (o) => formatMoney(o.total, o.currency) },
                  ]}
                />
              )}
            </Section>
          )}
          <Section title="Histórico">
            <Timeline
              label="Histórico do cliente"
              items={[
                { key: "created", label: "Cliente criado", at: when(customer.createdAt), tone: "gold" },
                ...(customer.updatedAt !== customer.createdAt ? [{ key: "updated", label: "Última alteração", at: when(customer.updatedAt) }] : []),
              ]}
            />
          </Section>
        </div>
      </div>

      {/* ---- Marcações (F27): this customer's appointments in a bounded window (≤ 31 days per query) ---- */}
      {roleCan(roleKey, "appointments.read") && (
        <AppointmentsSection organizationId={organizationId} filter={{ customerId: customer.id }} canCreate={roleCan(roleKey, "appointments.create") && customer.status === "ACTIVE"} defaultRangeDays={31} />
      )}

      <ConfirmDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        title="Arquivar cliente?"
        description={`"${customer.name}" deixa de poder receber novas marcações e pedidos. O histórico mantém-se. Pode ser reactivado.`}
        confirmLabel="Arquivar"
        onConfirm={async () => {
          onChange(await archiveCustomer(organizationId, customer.id));
          toast.success("Cliente arquivado.");
        }}
      />
    </div>
  );
}
