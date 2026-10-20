"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { roleCan } from "../../lib/permissions";
import type { OrganizationModules } from "../../lib/api/types";
import { moduleEnabled, visibleNav } from "../../lib/navigation";

interface Command {
  id: string;
  group: string;
  label: string;
  href: string;
  keywords: string;
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Builds the command list from the SAME permission-filtered navigation the sidebar shows, plus creation shortcuts the role can use. */
export function buildCommands(organizationId: string, roleKey: string | undefined, modules?: OrganizationModules | null): Command[] {
  const base = `/o/${organizationId}`;
  const navigation = visibleNav(roleKey, modules).flatMap((group) =>
    group.items.map((item) => ({
      id: `nav:${item.path}`,
      group: "Ir para",
      label: group.label ? `${group.label} › ${item.label}` : item.label,
      href: `${base}${item.path}`,
      keywords: normalize(`${item.label} ${group.label ?? ""} ${item.keywords ?? ""}`),
    })),
  );
  const actions: Command[] = [];
  if (roleCan(roleKey, "appointments.create") && moduleEnabled("services", modules)) actions.push({ id: "act:appointment", group: "Acções", label: "Nova marcação", href: `${base}/appointments/new`, keywords: "nova marcacao appointment create booking" });
  if (roleCan(roleKey, "orders.create") && moduleEnabled("orders", modules)) actions.push({ id: "act:order", group: "Acções", label: "Novo pedido", href: `${base}/orders?new=1`, keywords: "novo pedido order create" });
  if (roleCan(roleKey, "products.create") && moduleEnabled("catalog", modules)) actions.push({ id: "act:product", group: "Acções", label: "Novo produto", href: `${base}/products?new=1`, keywords: "novo produto product create" });
  if (roleCan(roleKey, "customers.create") && moduleEnabled("customers", modules)) actions.push({ id: "act:customer", group: "Acções", label: "Novo cliente", href: `${base}/customers?new=1`, keywords: "novo cliente customer create" });
  actions.push({ id: "act:orgs", group: "Acções", label: "Mudar de organização", href: "/", keywords: "organizacao switch trocar" });
  return [...navigation, ...actions];
}

export function CommandMenu({ organizationId, roleKey, modules, open, onOpenChange }: { organizationId: string; roleKey: string | undefined; modules?: OrganizationModules | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const commands = useMemo(() => buildCommands(organizationId, roleKey, modules), [organizationId, roleKey, modules]);
  const results = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return terms.length === 0 ? commands : commands.filter((c) => terms.every((t) => c.keywords.includes(t) || normalize(c.label).includes(t)));
  }, [commands, query]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  if (!open) return null;

  function go(command: Command | undefined) {
    if (!command) return;
    onOpenChange(false);
    router.push(command.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(results[active]);
    }
  }

  let lastGroup = "";
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onOpenChange(false)}>
      <div className="command" role="dialog" aria-modal="true" aria-label="Menu de comandos" onKeyDown={onKeyDown}>
        <input
          ref={inputRef}
          className="command-input"
          placeholder="Procurar páginas e acções…"
          aria-label="Procurar páginas e acções"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[active] ? `${listId}-${results[active]!.id}` : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length === 0 ? (
          <div className="command-empty">Nenhum resultado para “{query}”.</div>
        ) : (
          <ul className="command-list" role="listbox" id={listId}>
            {results.map((command, index) => {
              const header = command.group !== lastGroup ? command.group : null;
              lastGroup = command.group;
              return (
                <li key={command.id} role="presentation">
                  {header && <div className="command-group" aria-hidden>{header}</div>}
                  <div
                    id={`${listId}-${command.id}`}
                    role="option"
                    aria-selected={index === active}
                    className="command-item"
                    onMouseEnter={() => setActive(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      go(command);
                    }}
                  >
                    {command.label}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
