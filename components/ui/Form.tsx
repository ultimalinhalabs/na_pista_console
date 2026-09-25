"use client";

import { cloneElement, isValidElement, useId, type InputHTMLAttributes, type ReactElement, type ReactNode } from "react";

/**
 * Label + control + hint/error, wired for accessibility: the control gets
 * `id`, `aria-describedby` and `aria-invalid` automatically, so every form
 * in the Console announces its errors the same way.
 */
export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactElement; htmlFor?: string }) {
  const generated = useId();
  const childId = isValidElement<{ id?: string }>(children) ? children.props.id : undefined;
  const id = htmlFor ?? childId ?? generated;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })
    : children;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && (
        <span id={hintId} className="field-hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

/** A titled group of fields (create/edit forms). */
export function FormSection({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="card" style={{ border: "1px solid var(--np-border)", margin: 0, marginBottom: "var(--np-space-4)" }}>
      <legend className="sr-only">{title}</legend>
      <div style={{ fontWeight: 600, marginBottom: 4 }} aria-hidden>
        {title}
      </div>
      {description && <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{description}</p>}
      {children}
    </fieldset>
  );
}

/** Search box with a leading icon; Enter submits via `onSubmit` when provided. */
export function SearchInput({ label, onSubmit, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; onSubmit?: () => void }) {
  return (
    <div className="search-input">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        className="input"
        aria-label={label}
        placeholder={label}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        {...rest}
      />
    </div>
  );
}
