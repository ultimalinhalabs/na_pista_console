"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { listInventory } from "../../../../lib/api/inventory";
import { useAsync } from "../../../../lib/useAsync";
import { displayQuantity, unitLabel } from "../../../../lib/format";
import { localDateTime } from "../../../../lib/datetime";
import { useOrganizationTimezone } from "../../../../lib/appointments/components";
import { LIST_LIMIT, ListPage } from "../../../../components/patterns/ListPage";
import { Badge } from "../../../../components/ui/Data";

/**
 * Read-only balances listing — recording movements lives on each product's
 * inventory page (the API's movement endpoint is per product). "Sem stock"
 * uses the API's own `zeroStock` filter; there are no reorder thresholds in
 * the backend, so no invented "low stock" level.
 */
export default function InventoryPage() {
  const params = useParams<{ organizationId: string }>();
  const org = params.organizationId;
  const [zeroStockOnly, setZeroStockOnly] = useState(false);
  const balances = useAsync(() => listInventory(org, { zeroStock: zeroStockOnly || undefined, limit: LIST_LIMIT }), [org, zeroStockOnly]);
  const tz = useOrganizationTimezone(org);

  return (
    <ListPage
      title="Inventário"
      description="Saldo actual de cada produto. O stock só muda através de movimentos (entradas e ajustes) ou da confirmação/cancelamento de pedidos."
      moduleName="Inventário"
      filters={
        <label className="checkbox-row">
          <input type="checkbox" checked={zeroStockOnly} onChange={(e) => setZeroStockOnly(e.target.checked)} />
          Apenas sem stock
        </label>
      }
      state={balances}
      rowKey={(b) => b.id}
      empty={{
        title: zeroStockOnly ? "Nenhum produto sem stock." : "Nenhum registo de inventário.",
        description: zeroStockOnly ? undefined : "O stock de um produto aparece aqui assim que a primeira entrada for registada na página do produto.",
      }}
      columns={[
        {
          key: "product",
          header: "Produto",
          wrap: true,
          cell: (b) => (
            <span className="row">
              <Link href={`/o/${org}/inventory/${b.productId}`}>{b.productName}</Link>
              {b.productStatus === "ARCHIVED" && <Badge>Produto arquivado</Badge>}
            </span>
          ),
        },
        { key: "qty", header: "Quantidade", numeric: true, cell: (b) => `${displayQuantity(b.quantity)} ${unitLabel(b.productUnit)}` },
        { key: "state", header: "Estado", cell: (b) => (Number(b.quantity) === 0 ? <Badge tone="warning">Sem stock</Badge> : <Badge tone="success">Em stock</Badge>) },
        { key: "updated", header: "Última actualização", cell: (b) => (tz.timezone ? localDateTime(b.updatedAt, tz.timezone) : new Date(b.updatedAt).toLocaleString("pt-PT")) },
      ]}
    />
  );
}
