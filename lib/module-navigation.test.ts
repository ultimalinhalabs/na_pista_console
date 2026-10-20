import { describe, expect, it } from "vitest";
import { buildCommands } from "../components/shell/CommandMenu";
import type { OrganizationModules } from "./api/types";
import { moduleEnabled, visibleNav } from "./navigation";

/** Na Pista ADR-070 (audit 2026-10-20): the Console shows only the modules the organization's plan enables. */
const labels = (role: string, modules?: OrganizationModules | null) => visibleNav(role, modules).flatMap((g) => g.items.map((i) => i.label));
const CATALOG_ONLY: OrganizationModules = { catalog: true, orders: false, customers: false, services: false };
const SERVICES_ONLY: OrganizationModules = { catalog: false, orders: false, customers: true, services: true };
const ALL: OrganizationModules = { catalog: true, orders: true, customers: true, services: true };

describe("module-aware navigation (ADR-070)", () => {
  it("catalog only: products, categories and stock — no services, professionals, appointments, schedules, orders or customers", () => {
    const owner = labels("OWNER", CATALOG_ONLY);
    expect(owner).toEqual(expect.arrayContaining(["Produtos", "Categorias", "Inventário"]));
    for (const hidden of ["Serviços", "Profissionais", "Marcações", "Horários e disponibilidade", "Pedidos", "Clientes"]) expect(owner).not.toContain(hidden);
  });

  it("services only: services, professionals, appointments, schedules and customers — no catalog or orders", () => {
    const owner = labels("OWNER", SERVICES_ONLY);
    expect(owner).toEqual(expect.arrayContaining(["Serviços", "Profissionais", "Marcações", "Horários e disponibilidade", "Clientes"]));
    for (const hidden of ["Produtos", "Categorias", "Inventário", "Pedidos"]) expect(owner).not.toContain(hidden);
  });

  it("non-module items (overview, integrations, settings) are never hidden by the plan", () => {
    for (const modules of [CATALOG_ONLY, SERVICES_ONLY, { catalog: false, orders: false, customers: false, services: false }]) {
      expect(labels("OWNER", modules)).toEqual(expect.arrayContaining(["Visão geral", "API", "Organização", "Equipa"]));
    }
  });

  it("modules unknown (loading or API error) → role filter only, exactly as before; the API stays the authority", () => {
    expect(labels("OWNER", null)).toEqual(labels("OWNER"));
    expect(labels("OWNER", undefined)).toEqual(labels("OWNER", ALL));
    expect(moduleEnabled(undefined, CATALOG_ONLY)).toBe(true);
  });

  it("the role filter still applies on top of the module filter (STAFF never sees Credentials, even with every module)", () => {
    expect(labels("STAFF", ALL)).not.toContain("Credenciais");
  });

  it("command menu: navigation and creation shortcuts follow the same module filter", () => {
    const cmds = buildCommands("org-a", "OWNER", CATALOG_ONLY).map((c) => c.label);
    expect(cmds).toContain("Novo produto");
    for (const hidden of ["Nova marcação", "Novo pedido", "Novo cliente"]) expect(cmds).not.toContain(hidden);
    expect(cmds.some((c) => c.includes("Serviços"))).toBe(false);
    const all = buildCommands("org-a", "OWNER", ALL).map((c) => c.label);
    expect(all).toEqual(expect.arrayContaining(["Nova marcação", "Novo pedido", "Novo produto", "Novo cliente"]));
  });
});
