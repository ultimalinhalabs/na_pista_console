"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useSession } from "../../../lib/session/SessionContext";
import { roleCan } from "../../../lib/permissions";
import { listAppointments } from "../../../lib/api/appointments";
import { listCustomers } from "../../../lib/api/customers";
import { listInventory } from "../../../lib/api/inventory";
import { listOrders } from "../../../lib/api/orders";
import { useAsync } from "../../../lib/useAsync";
import { formatCount, formatMoney, displayQuantity, unitLabel } from "../../../lib/format";
import { localDateTime, todayIn } from "../../../lib/datetime";
import { statusInfo } from "../../../lib/status";
import { isEntitlementError } from "../../../lib/errors";
import { PageHeader, Section } from "../../../components/patterns/Page";
import { Badge, DataTable, Stat } from "../../../components/ui/Data";
import { Alert, EmptyState, ErrorNotice, ModuleUnavailable, Skeleton } from "../../../components/ui/Feedback";
import { ButtonLink } from "../../../components/ui/Button";
import { AppointmentsTable, useAppointmentNames, useOrganizationTimezone } from "../../../lib/appointments/components";

const LIST_LIMIT = 100;

/** "100+" when the API page is full — the APIs cap lists at 100 and expose no total count (docs/f29-ui-audit.md §2). */
function countLabel(rows: unknown[] | null): ReactNode {
  if (!rows) return <Skeleton width={48} height={26} />;
  return rows.length >= LIST_LIMIT ? `${formatCount(LIST_LIMIT)}+` : formatCount(rows.length);
}

function Block({ state, moduleName, children }: { state: { error: unknown; loading: boolean }; moduleName: string; children: ReactNode }) {
  if (state.error) return isEntitlementError(state.error) ? <ModuleUnavailable moduleName={moduleName} /> : <ErrorNotice error={state.error} />;
  return <>{children}</>;
}

/**
 * F29 Overview — "what is happening in my business?" answered ONLY with
 * data the APIs provide: today's appointments, open orders, recent orders,
 * zero-stock products (server-side `zeroStock` filter), active customers.
 * Each block appears only if the role can read that module, and degrades
 * independently (entitlement / permission / error). No invented KPIs, no
 * activity feed (no audit-read API exists).
 */
export default function OverviewPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const { identity } = useSession();
  const membership = identity?.memberships.find((m) => m.organizationId === org);
  const roleKey = membership?.roleKey;
  const can = (permission: string) => roleCan(roleKey, permission);

  const tz = useOrganizationTimezone(org);
  const today = tz.timezone ? todayIn(tz.timezone) : null;

  const appointments = useAsync(() => listAppointments(org, { from: today!, to: today! }), [org, today], { enabled: can("appointments.read") && Boolean(today) });
  const draftOrders = useAsync(() => listOrders(org, { status: "DRAFT", limit: LIST_LIMIT }), [org], { enabled: can("orders.read") });
  const confirmedOrders = useAsync(() => listOrders(org, { status: "CONFIRMED", limit: LIST_LIMIT }), [org], { enabled: can("orders.read") });
  const recentOrders = useAsync(() => listOrders(org, { limit: 5 }), [org], { enabled: can("orders.read") });
  const zeroStock = useAsync(() => listInventory(org, { zeroStock: true, limit: LIST_LIMIT }), [org], { enabled: can("inventory.read") });
  const customers = useAsync(() => listCustomers(org, { status: "ACTIVE", limit: LIST_LIMIT }), [org], { enabled: can("customers.read") });
  const names = useAppointmentNames(org, appointments.data);

  const scheduled = appointments.data?.filter((a) => a.status === "SCHEDULED") ?? null;
  const openOrders = draftOrders.data && confirmedOrders.data ? [...draftOrders.data, ...confirmedOrders.data] : null;
  const base = `/o/${org}`;

  return (
    <div>
      <PageHeader
        title="Visão geral"
        description={membership ? `${membership.organizationName}${today ? ` · hoje, ${today}${tz.timezone ? ` (${tz.timezone})` : ""}` : ""}` : undefined}
        actions={
          <>
            {can("appointments.create") && tz.timezone && (
              <ButtonLink href={`${base}/appointments/new`} variant="primary">
                Nova marcação
              </ButtonLink>
            )}
            {can("orders.create") && <ButtonLink href={`${base}/orders?new=1`}>Novo pedido</ButtonLink>}
          </>
        }
      />

      {can("scheduling.read") && !tz.loading && !tz.error && !tz.timezone && (
        <Alert tone="warning" title="Fuso horário por configurar">
          Sem fuso horário não é possível gerir horários nem marcações. <Link href={`${base}/settings`}>Configurar em Definições</Link>
        </Alert>
      )}

      <div className="grid-4" style={{ marginBottom: "var(--np-space-6)" }}>
        {can("appointments.read") && (
          <Stat label="Marcações hoje" value={tz.loading ? <Skeleton width={48} height={26} /> : tz.timezone ? (scheduled ? formatCount(scheduled.length) : appointments.error ? "—" : <Skeleton width={48} height={26} />) : "—"} hint={tz.loading || tz.timezone ? "por realizar (agendadas)" : "requer fuso horário"} href={`${base}/appointments`} />
        )}
        {can("orders.read") && <Stat label="Pedidos em aberto" value={draftOrders.error || confirmedOrders.error ? "—" : countLabel(openOrders)} hint="rascunho + confirmados" href={`${base}/orders`} />}
        {can("inventory.read") && <Stat label="Produtos sem stock" value={zeroStock.error ? "—" : countLabel(zeroStock.data)} hint="saldo igual a zero" href={`${base}/inventory`} />}
        {can("customers.read") && <Stat label="Clientes activos" value={customers.error ? "—" : countLabel(customers.data)} href={`${base}/customers`} />}
      </div>

      {can("appointments.read") && (
        <Section title="Marcações de hoje" actions={<Link href={`${base}/appointments`}>Ver agenda</Link>}>
          {tz.loading ? (
            <Skeleton height={40} />
          ) : !tz.timezone ? (
            <EmptyState title="Fuso horário por configurar" description="As marcações precisam do fuso horário da organização." action={<Link href={`${base}/settings`}>Configurar</Link>} />
          ) : (
            <Block state={appointments} moduleName="Marcações">
              {appointments.data === null ? (
                <Skeleton height={40} />
              ) : appointments.data.length === 0 ? (
                <EmptyState title="Sem marcações hoje." />
              ) : (
                <AppointmentsTable organizationId={org} appointments={appointments.data} timezone={tz.timezone} names={names} />
              )}
            </Block>
          )}
        </Section>
      )}

      <div className="grid-2">
        {can("orders.read") && (
          <Section title="Pedidos recentes" actions={<Link href={`${base}/orders`}>Ver todos</Link>}>
            <Block state={recentOrders} moduleName="Pedidos">
              <DataTable
                rows={recentOrders.data}
                loading={recentOrders.loading && !recentOrders.data}
                rowKey={(o) => o.id}
                empty={{ title: "Ainda não existem pedidos." }}
                columns={[
                  { key: "created", header: "Criado", cell: (o) => <Link href={`${base}/orders/${o.id}`}>{tz.timezone ? localDateTime(o.createdAt, tz.timezone) : o.createdAt.slice(0, 16).replace("T", " ")}</Link> },
                  { key: "status", header: "Estado", cell: (o) => <Badge tone={statusInfo("order", o.status).tone}>{statusInfo("order", o.status).label}</Badge> },
                  { key: "total", header: "Total", numeric: true, cell: (o) => formatMoney(o.total, o.currency) },
                ]}
              />
            </Block>
          </Section>
        )}
        {can("inventory.read") && (
          <Section title="Produtos sem stock" actions={<Link href={`${base}/inventory`}>Ver inventário</Link>}>
            <Block state={zeroStock} moduleName="Inventário">
              <DataTable
                rows={zeroStock.data?.slice(0, 5) ?? null}
                loading={zeroStock.loading && !zeroStock.data}
                rowKey={(b) => b.id}
                empty={{ title: "Nenhum produto com stock a zero." }}
                columns={[
                  { key: "product", header: "Produto", wrap: true, cell: (b) => <Link href={`${base}/inventory/${b.productId}`}>{b.productName}</Link> },
                  { key: "qty", header: "Saldo", numeric: true, cell: (b) => `${displayQuantity(b.quantity)} ${unitLabel(b.productUnit)}` },
                ]}
              />
            </Block>
          </Section>
        )}
      </div>
    </div>
  );
}
