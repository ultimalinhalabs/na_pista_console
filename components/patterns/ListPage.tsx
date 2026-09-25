"use client";

import { useEffect, useState, type ReactNode } from "react";
import { isEntitlementError } from "../../lib/errors";
import type { AsyncState } from "../../lib/useAsync";
import { DataTable, type Column } from "../ui/Data";
import { ErrorNotice, ModuleUnavailable, ResultLimitNotice } from "../ui/Feedback";
import { FilterBar, PageHeader, type Crumb } from "./Page";

/** The list size requested by every list page — the APIs' maximum (docs/f29-ui-audit.md §2). */
export const LIST_LIMIT = 100;

/**
 * F29 resource list pattern (Phase 6): header (title, description, the
 * one primary action) → filter bar → table → truncation notice, with the
 * loading / empty / error / entitlement-denied states handled once.
 */
export function ListPage<T>({
  title,
  description,
  breadcrumbs,
  primaryAction,
  filters,
  state,
  moduleName,
  columns,
  rowKey,
  empty,
  children,
}: {
  title: string;
  description?: ReactNode;
  breadcrumbs?: Crumb[];
  primaryAction?: ReactNode;
  filters?: ReactNode;
  state: AsyncState<T[]>;
  moduleName: string;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  empty: { title: string; description?: ReactNode; action?: ReactNode };
  children?: ReactNode;
}) {
  const entitlementDenied = isEntitlementError(state.error);
  return (
    <div>
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} actions={entitlementDenied ? undefined : primaryAction} />
      {children}
      {entitlementDenied ? (
        <ModuleUnavailable moduleName={moduleName} />
      ) : (
        <>
          {filters && <FilterBar>{filters}</FilterBar>}
          {state.error ? (
            <ErrorNotice error={state.error} />
          ) : (
            <>
              <DataTable rows={state.data} loading={state.loading && !state.data} rowKey={rowKey} columns={columns} empty={empty} caption={title} />
              {state.data && <ResultLimitNotice count={state.data.length} limit={LIST_LIMIT} />}
            </>
          )}
        </>
      )}
    </div>
  );
}

export type StatusFilterValue = "" | "ACTIVE" | "ARCHIVED";

export function StatusFilter({ value, onChange, label = "Estado" }: { value: StatusFilterValue; onChange: (value: StatusFilterValue) => void; label?: string }) {
  return (
    <select className="select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value as StatusFilterValue)}>
      <option value="">Todos os estados</option>
      <option value="ACTIVE">Activos</option>
      <option value="ARCHIVED">Arquivados</option>
    </select>
  );
}

/** Opens a create dialog when the page is reached with `?new=1` (Command Menu shortcuts) — read once from the URL, no Suspense boundary needed. */
export function useCreateFromUrl(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new") === "1") setOpen(true);
  }, []);
  return [open, setOpen];
}
