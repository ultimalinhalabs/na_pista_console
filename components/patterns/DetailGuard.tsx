"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ApiError } from "../../lib/api/errors";
import { isEntitlementError } from "../../lib/errors";
import { ErrorNotice, ModuleUnavailable, Skeleton } from "../ui/Feedback";

function isNotFound(error: unknown) {
  return error instanceof ApiError && error.status === 404;
}

/**
 * F29 detail page pattern (Phase 7): the loading / not-found /
 * entitlement-denied / error states every resource page shares, so each
 * page only renders its happy path.
 */
export function DetailGuard<T>({
  state,
  resourceLabel,
  backHref,
  backLabel,
  moduleName,
  children,
}: {
  state: { data: T | null; error: unknown; loading: boolean };
  resourceLabel: string;
  backHref: string;
  backLabel: string;
  moduleName: string;
  children: (data: T) => ReactNode;
}) {
  if (state.data) return <>{children(state.data)}</>;
  if (isNotFound(state.error)) {
    return (
      <div className="empty">
        <div className="empty-title">{resourceLabel} não encontrado.</div>
        <div className="empty-description">Não existe ou não pertence a esta organização.</div>
        <Link href={backHref}>Voltar a {backLabel}</Link>
      </div>
    );
  }
  if (isEntitlementError(state.error)) return <ModuleUnavailable moduleName={moduleName} />;
  if (state.error) return <ErrorNotice error={state.error} />;
  return (
    <div role="status" aria-live="polite" className="stack-sm">
      <span className="sr-only">A carregar…</span>
      <Skeleton width={260} height={24} />
      <Skeleton height={120} />
    </div>
  );
}
