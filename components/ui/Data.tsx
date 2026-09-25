"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { EmptyState, TableSkeleton } from "./Feedback";

export type BadgeTone = "neutral" | "gold" | "success" | "warning" | "danger";

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  const cls = tone === "neutral" ? "badge" : tone === "danger" ? "badge badge-destructive" : `badge badge-${tone}`;
  return <span className={cls}>{children}</span>;
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** right-aligned numeric column */
  numeric?: boolean;
  /** allow wrapping (long names, descriptions) */
  wrap?: boolean;
  /** hidden header text (icons/actions) */
  srHeader?: boolean;
}

/**
 * The one table of the Console: horizontal scroll container on narrow
 * screens, loading skeleton, empty state, optional primary link per row
 * (the first column renders it — rows stay keyboard-accessible links, not
 * clickable <tr>s).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  caption,
}: {
  columns: Column<T>[];
  rows: T[] | null;
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: { title: string; description?: ReactNode; action?: ReactNode };
  caption?: string;
}) {
  if (loading || rows === null) return <TableSkeleton columns={Math.min(columns.length, 5)} />;
  if (rows.length === 0) return <EmptyState title={empty?.title ?? "Sem resultados."} description={empty?.description} action={empty?.action} />;
  return (
    <div className="table-wrap">
      <table>
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={c.numeric ? "num" : undefined}>
                {c.srHeader ? <span className="sr-only">{c.header}</span> : c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.key} className={[c.numeric && "num", c.wrap && "wrap"].filter(Boolean).join(" ") || undefined}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="stat">
      {body}
    </Link>
  ) : (
    <div className="stat">{body}</div>
  );
}

export interface TimelineItem {
  key: string;
  label: ReactNode;
  at?: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "gold";
}

/** Lifecycle history derived from a resource's own timestamps (no activity API exists — docs/f29-ui-audit.md §2). */
export function Timeline({ items, label }: { items: TimelineItem[]; label: string }) {
  return (
    <ol className="timeline" aria-label={label}>
      {items.map((item) => (
        <li key={item.key} data-tone={item.tone ?? "neutral"}>
          <div>{item.label}</div>
          {item.at && <div className="subtle" style={{ fontSize: 12 }}>{item.at}</div>}
        </li>
      ))}
    </ol>
  );
}

export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="dl">
      {items.map((item) => (
        <div key={item.label} style={{ display: "contents" }}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Copies to the clipboard and confirms inline (screen readers get a live status). */
export function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2000);
  }
  return (
    <button type="button" className="btn btn-sm" onClick={copy} aria-live="polite">
      {copied === "done" ? "Copiado" : copied === "failed" ? "Copia manualmente" : label}
    </button>
  );
}
