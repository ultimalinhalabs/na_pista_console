"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { getProduct } from "../../../../../lib/api/products";
import { createMovement, getInventoryBalance, listMovements } from "../../../../../lib/api/inventory";
import { ApiError } from "../../../../../lib/api/errors";
import type { Product, StockMovementType } from "../../../../../lib/api/types";
import { useAsync } from "../../../../../lib/useAsync";
import { statusInfo } from "../../../../../lib/status";
import { displayQuantity, unitLabel } from "../../../../../lib/format";
import { localDateTime } from "../../../../../lib/datetime";
import { useOrganizationTimezone } from "../../../../../lib/appointments/components";
import { DetailGuard } from "../../../../../components/patterns/DetailGuard";
import { ResourceHeader, Section } from "../../../../../components/patterns/Page";
import { Badge, DataTable, Stat } from "../../../../../components/ui/Data";
import { Alert, ErrorNotice, ResultLimitNotice, Skeleton } from "../../../../../components/ui/Feedback";
import { Button } from "../../../../../components/ui/Button";
import { Field } from "../../../../../components/ui/Form";
import { useToast } from "../../../../../components/ui/Toast";

const MOVEMENTS_LIMIT = 100;
const DECIMAL = /^\d+(\.\d{1,6})?$/;

export default function InventoryDetailPage() {
  const params = useParams<{ organizationId: string; productId: string }>();
  const org = params.organizationId;
  const product = useAsync(() => getProduct(org, params.productId), [org, params.productId]);
  return (
    <DetailGuard state={product} resourceLabel="Produto" backHref={`/o/${org}/inventory`} backLabel="Inventário" moduleName="Inventário">
      {(p) => <InventoryDetail organizationId={org} product={p} />}
    </DetailGuard>
  );
}

function InventoryDetail({ organizationId, product }: { organizationId: string; product: Product }) {
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === organizationId)?.roleKey;
  const canReceive = roleCan(roleKey, "inventory.create");
  const canAdjust = roleCan(roleKey, "inventory.update");
  const tz = useOrganizationTimezone(organizationId);
  // INVENTORY_NOT_FOUND = "never stocked", a normal state — not an error.
  const balance = useAsync(
    () =>
      getInventoryBalance(organizationId, product.id).catch((err) => {
        if (err instanceof ApiError && err.code === "INVENTORY_NOT_FOUND") return null;
        throw err;
      }),
    [organizationId, product.id],
  );
  const movements = useAsync(() => listMovements(organizationId, product.id, { limit: MOVEMENTS_LIMIT }), [organizationId, product.id]);
  const unit = unitLabel(product.unit);
  const archived = product.status === "ARCHIVED";

  return (
    <div>
      <ResourceHeader
        name={product.name}
        status={archived ? <Badge>Produto arquivado</Badge> : undefined}
        subtitle="Saldo e movimentos de stock"
        breadcrumbs={[{ label: "Inventário", href: `/o/${organizationId}/inventory` }, { label: product.name }]}
        actions={<Link href={`/o/${organizationId}/products/${product.id}`}>Ver produto</Link>}
      />

      <div className="grid-3" style={{ marginBottom: "var(--np-space-5)" }}>
        <Stat
          label="Quantidade actual"
          value={balance.loading ? <Skeleton width={80} height={26} /> : balance.error ? "—" : balance.data ? `${displayQuantity(balance.data.quantity)} ${unit}` : "Sem stock registado"}
        />
      </div>
      {balance.error ? <ErrorNotice error={balance.error} /> : null}

      {archived ? (
        <Alert tone="info" title="Produto arquivado">
          Este produto está arquivado — o histórico permanece disponível, mas não são permitidos novos movimentos.
        </Alert>
      ) : (
        (canReceive || canAdjust) && (
          <Section title="Registar movimento">
            <MovementForm
              organizationId={organizationId}
              productId={product.id}
              unit={unit}
              canReceive={canReceive}
              canAdjust={canAdjust}
              onRecorded={() => {
                balance.reload();
                movements.reload();
              }}
            />
          </Section>
        )
      )}

      <Section title="Histórico de movimentos">
        {movements.error ? (
          <ErrorNotice error={movements.error} />
        ) : (
          <>
            <DataTable
              rows={movements.data}
              loading={movements.loading && !movements.data}
              rowKey={(m) => m.id}
              empty={{ title: "Nenhum movimento registado ainda." }}
              columns={[
                { key: "type", header: "Tipo", cell: (m) => <Badge tone={statusInfo("movement", m.type).tone}>{statusInfo("movement", m.type).label}</Badge> },
                { key: "qty", header: "Quantidade", numeric: true, cell: (m) => `${m.type === "ADJUSTMENT_OUT" ? "−" : "+"}${displayQuantity(m.quantity)} ${unit}` },
                { key: "reason", header: "Motivo", wrap: true, cell: (m) => m.reason ?? <span className="subtle">—</span> },
                { key: "actor", header: "Origem", cell: (m) => (m.actorType === "service" ? "Integração" : "Utilizador") },
                { key: "at", header: "Data", cell: (m) => (tz.timezone ? localDateTime(m.createdAt, tz.timezone) : new Date(m.createdAt).toLocaleString("pt-PT")) },
              ]}
            />
            {movements.data && <ResultLimitNotice count={movements.data.length} limit={MOVEMENTS_LIMIT} />}
          </>
        )}
      </Section>
    </div>
  );
}

function MovementForm({ organizationId, productId, unit, canReceive, canAdjust, onRecorded }: { organizationId: string; productId: string; unit: string; canReceive: boolean; canAdjust: boolean; onRecorded: () => void }) {
  const availableTypes: StockMovementType[] = [...(canReceive ? (["RECEIPT"] as const) : []), ...(canAdjust ? (["ADJUSTMENT_IN", "ADJUSTMENT_OUT"] as const) : [])];
  const [type, setType] = useState<StockMovementType>(availableTypes[0]!);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [quantityError, setQuantityError] = useState<string | null>(null);
  const toast = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = quantity.trim().replace(",", ".");
    if (!DECIMAL.test(value) || Number(value) <= 0) {
      setQuantityError("Indica uma quantidade positiva (até 6 casas decimais)");
      return;
    }
    setQuantityError(null);
    setSubmitting(true);
    setError(null);
    try {
      // Sent as the typed decimal string — never through float arithmetic (numeric(20,6), ADR-027).
      await createMovement(organizationId, productId, { type, quantity: value, reason: reason || undefined });
      setQuantity("");
      setReason("");
      toast.success("Movimento registado.");
      onRecorded();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" noValidate>
      <div className="grid-3">
        <Field label="Tipo">
          <select id="movement-type" className="select" value={type} onChange={(e) => setType(e.target.value as StockMovementType)}>
            {canReceive && <option value="RECEIPT">Receber stock</option>}
            {canAdjust && <option value="ADJUSTMENT_IN">Ajuste — aumentar</option>}
            {canAdjust && <option value="ADJUSTMENT_OUT">Ajuste — diminuir</option>}
          </select>
        </Field>
        <Field label={`Quantidade (${unit})`} error={quantityError}>
          <input id="movement-quantity" className="input" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        </Field>
        <Field label="Motivo (opcional)">
          <input id="movement-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
      </div>
      {error ? <ErrorNotice error={error} /> : null}
      <Button type="submit" variant="primary" loading={submitting}>
        {submitting ? "A registar…" : "Registar movimento"}
      </Button>
    </form>
  );
}
