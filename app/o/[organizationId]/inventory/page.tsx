"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { listInventory } from "../../../../lib/api/inventory";
import { ApiError } from "../../../../lib/api/errors";
import type { InventoryBalance } from "../../../../lib/api/types";
import { formatQuantity, unitLabel } from "../../../../lib/format";

/** Read-only listing — no gated action on this page itself; recording a movement lives on the product's own inventory page. */
export default function InventoryPage() {
  const params = useParams<{ organizationId: string }>();

  const [balances, setBalances] = useState<InventoryBalance[] | null>(null);
  const [zeroStockOnly, setZeroStockOnly] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  async function load() {
    setError(null);
    try {
      setBalances(await listInventory(params.organizationId, { zeroStock: zeroStockOnly || undefined }));
    } catch (err) {
      setError(err as Error);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zeroStockOnly]);

  return (
    <div>
      <div className="toolbar">
        <h1 style={{ fontSize: 20, margin: 0, flex: 1 }}>Inventário</h1>
      </div>

      <div className="toolbar">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--color-foreground-muted)" }}>
          <input type="checkbox" checked={zeroStockOnly} onChange={(e) => setZeroStockOnly(e.target.checked)} />
          Apenas sem stock
        </label>
        <button className="btn" onClick={load}>
          Actualizar
        </button>
      </div>

      {error && (
        <div className="card error-text" style={{ marginBottom: 16 }}>
          {error.message}
          {error instanceof ApiError && error.requestId && <div className="request-ref">Referência: {error.requestId}</div>}
        </div>
      )}

      {balances === null && !error ? (
        <div className="empty-state">A carregar…</div>
      ) : balances && balances.length === 0 ? (
        <div className="empty-state card">
          Nenhum registo de inventário. O stock de um produto aparece aqui assim que a primeira recepção for registada.
        </div>
      ) : balances ? (
        <table>
          <thead>
            <tr>
              <th>Produto</th>
              <th>Quantidade</th>
              <th>Unidade</th>
              <th>Estado</th>
              <th>Última actualização</th>
            </tr>
          </thead>
          <tbody>
            {balances.map((b) => {
              const isZero = Number(b.quantity) === 0;
              return (
                <tr key={b.id}>
                  <td>
                    <Link href={`/o/${params.organizationId}/inventory/${b.productId}`}>{b.productName}</Link>
                    {b.productStatus === "ARCHIVED" && (
                      <span className="badge" style={{ marginLeft: 8 }}>
                        Produto arquivado
                      </span>
                    )}
                  </td>
                  <td>{formatQuantity(b.quantity)}</td>
                  <td>{unitLabel(b.productUnit)}</td>
                  <td>
                    <span className={`badge${isZero ? " badge-warning" : " badge-success"}`}>{isZero ? "SEM STOCK" : "EM STOCK"}</span>
                  </td>
                  <td>{new Date(b.updatedAt).toLocaleString("pt-PT")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
