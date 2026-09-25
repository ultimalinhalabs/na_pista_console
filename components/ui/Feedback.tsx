"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ApiError } from "../../lib/api/errors";
import { describeError, errorDetail } from "../../lib/errors";

export type Tone = "info" | "warning" | "danger" | "success";

export function Alert({ tone = "info", title, children, role }: { tone?: Tone; title?: ReactNode; children?: ReactNode; role?: "alert" | "status" }) {
  return (
    <div className={`alert alert-${tone}`} role={role ?? (tone === "danger" ? "alert" : "status")}>
      {title && <div className="alert-title">{title}</div>}
      {children && <div className="alert-body">{children}</div>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {description && <div className="empty-description">{description}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ width = "100%", height = 14 }: { width?: number | string; height?: number }) {
  return <div className="skeleton" style={{ width, height }} aria-hidden />;
}

/** Table-shaped loading placeholder; announces "A carregar…" to assistive tech. */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-wrap" role="status" aria-live="polite">
      <span className="sr-only">A carregar…</span>
      <table>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <td key={c}>
                  <Skeleton width={c === 0 ? "70%" : "50%"} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusIndicator({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger" | "gold"; children: ReactNode }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className={`status-dot${tone === "neutral" ? "" : ` status-dot-${tone}`}`} aria-hidden />
      <span>{children}</span>
    </span>
  );
}

/**
 * The one error presentation of the Console: contextual pt-PT explanation
 * for the code, the backend's own safe detail when it adds information,
 * and the request reference for support. Session expiry links to login.
 */
export function ErrorNotice({ error, title }: { error: unknown; title?: string }) {
  const detail = errorDetail(error);
  const requestId = error instanceof ApiError ? error.requestId : null;
  const unauthorized = error instanceof ApiError && error.status === 401;
  return (
    <div className="alert alert-danger" role="alert">
      <div className="alert-title">{title ?? describeError(error)}</div>
      {title && <div className="alert-body">{describeError(error)}</div>}
      {detail && <div className="alert-body">{detail}</div>}
      {unauthorized && (
        <div className="alert-body">
          <Link href="/login">Entrar novamente</Link>
        </div>
      )}
      {requestId && <div className="request-ref">Referência: {requestId}</div>}
    </div>
  );
}

/**
 * Entitlement denial (403 ENTITLEMENT_REQUIRED) — never a functional-looking
 * empty UI. The plan is not hardcoded: this is shown only when the API
 * itself refuses the module.
 */
export function ModuleUnavailable({ moduleName }: { moduleName: string }) {
  return (
    <div className="empty" role="status">
      <div className="empty-title">Módulo indisponível</div>
      <div className="empty-description">
        Esta organização não tem o módulo de {moduleName} activo no seu plano. A subscrição actual desta organização não inclui este módulo — fala com o
        responsável pela conta para o activar.
      </div>
    </div>
  );
}

export function PermissionDenied({ action }: { action?: string }) {
  return (
    <div className="empty" role="status">
      <div className="empty-title">Sem permissão</div>
      <div className="empty-description">{action ?? "O teu papel nesta organização não permite aceder a esta área."}</div>
    </div>
  );
}

/**
 * The APIs cap list sizes (≤ 100, no offset/cursor — docs/f29-ui-audit.md
 * §2). When a page is full we SAY the list may be incomplete instead of
 * pretending to paginate.
 */
export function ResultLimitNotice({ count, limit }: { count: number; limit: number }) {
  if (count < limit) return null;
  return <p className="result-limit">A mostrar os primeiros {limit} resultados (limite da API). Refina a pesquisa ou os filtros para encontrar outros registos.</p>;
}
