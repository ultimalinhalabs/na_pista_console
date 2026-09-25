"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Menu button: click or Enter/Space opens, Esc or outside click closes,
 * ArrowUp/ArrowDown move between items. Items are regular buttons/links
 * rendered by the caller with `className="dropdown-item" role="menuitem"`.
 */
export function Dropdown({ trigger, label, children, align = "right" }: { trigger: ReactNode; label: string; children: ReactNode; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const first = ref.current?.querySelector<HTMLElement>('[role="menuitem"]');
    first?.focus();
    function onDocument(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocument);
    return () => document.removeEventListener("mousedown", onDocument);
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (!open) return;
    if (event.key === "Escape") {
      setOpen(false);
      ref.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next]?.focus();
    }
  }

  return (
    <div className="dropdown" ref={ref} onKeyDown={onKeyDown}>
      <button type="button" className="btn btn-ghost" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined} aria-label={label} onClick={() => setOpen((v) => !v)}>
        {trigger}
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={label} className={`dropdown-menu${align === "left" ? " dropdown-menu-left" : ""}`} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Hover/focus tooltip for icon-only controls; the text is also the accessible description. */
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <span className="tooltip-wrap" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)} onFocus={() => setVisible(true)} onBlur={() => setVisible(false)} aria-describedby={id}>
      {children}
      <span id={id} role="tooltip" className={visible ? "tooltip" : "sr-only"}>
        {content}
      </span>
    </span>
  );
}
