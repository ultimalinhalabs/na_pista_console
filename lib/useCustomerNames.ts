"use client";

import { useEffect, useRef, useState } from "react";
import { getCustomer } from "./api/customers";

/**
 * Resolves display names for the customers referenced by a list (orders,
 * appointments) — one GET per UNIQUE id, cached for the page's lifetime.
 * Replaces matching against a truncated "active customers" list, which
 * showed "—" for archived customers or anyone beyond the first page.
 */
export function useCustomerNames(organizationId: string, customerIds: (string | null | undefined)[] | null): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  const requested = useRef(new Set<string>());
  const key = customerIds ? [...new Set(customerIds.filter((id): id is string => Boolean(id)))].sort().join(",") : "";

  useEffect(() => {
    const missing = key ? key.split(",").filter((id) => !requested.current.has(id)) : [];
    if (missing.length === 0) return;
    missing.forEach((id) => requested.current.add(id));
    Promise.all(missing.map((id) => getCustomer(organizationId, id).then((c) => [id, c.name] as const).catch(() => [id, "—"] as const))).then((entries) =>
      setNames((current) => ({ ...current, ...Object.fromEntries(entries) })),
    );
  }, [organizationId, key]);

  return names;
}
