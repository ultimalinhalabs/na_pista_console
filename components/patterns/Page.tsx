"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Localização">
      <ol className="breadcrumb">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} aria-current={index === items.length - 1 ? "page" : undefined} title={item.label}>
            {item.href && index < items.length - 1 ? <Link href={item.href}>{item.label}</Link> : item.label}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * List/Create/Edit page header: breadcrumb, title, description, the ONE
 * primary action plus secondary actions (DESIGN.md §4).
 */
export function PageHeader({ title, description, breadcrumbs, actions, meta }: { title: ReactNode; description?: ReactNode; breadcrumbs?: Crumb[]; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <div className="stack-sm" style={{ marginBottom: "var(--np-space-5)" }}>
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumb items={breadcrumbs} />}
      <header className="page-header" style={{ marginBottom: 0 }}>
        <div style={{ minWidth: 0, flex: "1 1 320px" }}>
          <div className="row">
            <h1>{title}</h1>
            {meta}
          </div>
          {description && <p className="page-header-description">{description}</p>}
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </header>
    </div>
  );
}

/** Detail page header: resource name + status + primary/secondary actions. */
export function ResourceHeader({ name, status, subtitle, breadcrumbs, actions }: { name: ReactNode; status?: ReactNode; subtitle?: ReactNode; breadcrumbs: Crumb[]; actions?: ReactNode }) {
  return <PageHeader title={name} meta={status} description={subtitle} breadcrumbs={breadcrumbs} actions={actions} />;
}

export function Section({ title, description, actions, children, id }: { title: string; description?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="section" aria-labelledby={id ? `${id}-title` : undefined} id={id}>
      <div className="section-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
          {description && <p className="section-header-description">{description}</p>}
        </div>
        {actions && <div className="row">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function FilterBar({ children, label = "Filtros" }: { children: ReactNode; label?: string }) {
  return (
    <div className="filter-bar" role="search" aria-label={label}>
      {children}
    </div>
  );
}
