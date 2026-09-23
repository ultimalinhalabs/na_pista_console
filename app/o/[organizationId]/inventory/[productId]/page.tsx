"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../../../../../lib/session/SessionContext";
import { roleCan } from "../../../../../lib/permissions";
import { getProduct } from "../../../../../lib/api/products";
import { createMovement, getInventoryBalance, listMovements } from "../../../../../lib/api/inventory";
import { ApiError } from "../../../../../lib/api/errors";
import type { InventoryBalance, Product, StockMovement, StockMovementType } from "../../../../../lib/api/types";
import { formatQuantity, unitLabel } from "../../../../../lib/format";

const MOVEMENT_LABEL: Record<StockMovementType, string> = {
  RECEIPT: "Recepção",
  ADJUSTMENT_IN: "Ajuste (entrada)",
  ADJUSTMENT_OUT: "Ajuste (saída)",
};

export default function InventoryDetailPage() {
  const params = useParams<{ organizationId: string; productId: string }>();
  const { identity } = useSession();
  const roleKey = identity?.memberships.find((m) => m.organizationId === params.organizationId)?.roleKey;

  const [product, setProduct] = useState<Product | null>(null);
  const [balance, setBalance] = useState<InventoryBalance | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [neverStocked, setNeverStocked] = useState(false);

  async function load() {
    setError(null);
    setNotFound(false);
    setNeverStocked(false);
    try {
      const p = await getProduct(params.organizationId, params.productId);
      setProduct(p);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
        return;
      }
      setError(err as Error);
      return;
    }
    try {
      setBalance(await getInventoryBalance(params.organizationId, params.productId));
    } catch (err) {
      if (err instanceof ApiError && err.code === "INVENTORY_NOT_FOUND") setNeverStocked(true);
      else {
        setError(err as Error);
        return;
      }
    }
    try {
      setMovements(await listMovements(params.organizationId, params.productId));
    } catch (err) {
      setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.productId]);

  if (notFound) {
    return (
      <div className="empty-state card">
        Produto não encontrado. <Link href={`/o/${params.organizationId}/inventory`}>Voltar ao inventário</Link>
      </div>
    );
  }

  if (!product && !error) return <div className="empty-state">A carregar…</div>;

  const canReceive = roleCan(roleKey, "inventory.create");
  const canAdjust = roleCan(roleKey, "inventory.update");
  const isArchived = product?.status === "ARCHIVED";

  return (
    <div>
      <p>
        <Link href={`/o/${params.organizationId}/inventory`}>← Inventário</Link>
      </p>
      <h1 style={{ fontSize: 20 }}>{product?.name}</h1>
      {isArchived && (
        <p>
          <span className="badge">Produto arquivado</span>
        </p>
      )}

      {error && (
        <div className="card error-text" style={{ marginBottom: 16 }}>
          {error.message}
          {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Quantidade actual</label>
          <p style={{ fontSize: 24, margin: "4px 0", color: "var(--color-foreground)" }}>
            {neverStocked ? "Sem stock registado" : `${formatQuantity(balance!.quantity)} ${unitLabel(product!.unit)}`}
          </p>
        </div>
      </div>

      {isArchived ? (
        <div className="empty-state card" style={{ marginBottom: 16 }}>
          Este produto está arquivado — o histórico permanece disponível, mas não são permitidos novos movimentos.
        </div>
      ) : (
        (canReceive || canAdjust) && (
          <MovementForm
            organizationId={params.organizationId}
            productId={params.productId}
            canReceive={canReceive}
            canAdjust={canAdjust}
            onRecorded={load}
          />
        )
      )}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Histórico de movimentos</h2>
      {movements.length === 0 ? (
        <div className="empty-state card">Nenhum movimento registado ainda.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Quantidade</th>
              <th>Motivo</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>
                  <span className={`badge${m.type === "ADJUSTMENT_OUT" ? " badge-warning" : " badge-success"}`}>{MOVEMENT_LABEL[m.type]}</span>
                </td>
                <td>
                  {m.type === "ADJUSTMENT_OUT" ? "−" : "+"}
                  {formatQuantity(m.quantity)} {unitLabel(product!.unit)}
                </td>
                <td>{m.reason ?? "—"}</td>
                <td>{new Date(m.createdAt).toLocaleString("pt-PT")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MovementForm({
  organizationId,
  productId,
  canReceive,
  canAdjust,
  onRecorded,
}: {
  organizationId: string;
  productId: string;
  canReceive: boolean;
  canAdjust: boolean;
  onRecorded: () => void;
}) {
  const availableTypes: StockMovementType[] = [
    ...(canReceive ? (["RECEIPT"] as const) : []),
    ...(canAdjust ? (["ADJUSTMENT_IN", "ADJUSTMENT_OUT"] as const) : []),
  ];
  const [type, setType] = useState<StockMovementType>(availableTypes[0]!);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(quantity);
    if (!quantity || !Number.isFinite(parsed) || parsed <= 0) {
      setError(new Error("Indica uma quantidade positiva"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createMovement(organizationId, productId, { type, quantity: parsed, reason: reason || undefined });
      setQuantity("");
      setReason("");
      onRecorded();
    } catch (err) {
      setError(err as Error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, marginTop: 0 }}>Registar movimento</h2>
      <div className="field">
        <label htmlFor="movement-type">Tipo</label>
        <select id="movement-type" className="select" value={type} onChange={(e) => setType(e.target.value as StockMovementType)}>
          {canReceive && <option value="RECEIPT">Receber stock</option>}
          {canAdjust && <option value="ADJUSTMENT_IN">Ajuste — aumentar</option>}
          {canAdjust && <option value="ADJUSTMENT_OUT">Ajuste — diminuir</option>}
        </select>
      </div>
      <div className="field">
        <label htmlFor="movement-quantity">Quantidade</label>
        <input
          id="movement-quantity"
          className="input"
          type="number"
          min="0"
          step="any"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="movement-reason">Motivo (opcional)</label>
        <input id="movement-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </div>
      {error && (
        <div className="error-text" style={{ marginBottom: 12 }}>
          {error.message}
          {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
        </div>
      )}
      <button type="submit" className="btn btn-primary" disabled={submitting}>
        {submitting ? "A registar…" : "Registar movimento"}
      </button>
    </form>
  );
}
