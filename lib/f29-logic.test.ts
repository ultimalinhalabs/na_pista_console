import { describe, expect, it } from "vitest";
import { ApiError } from "./api/errors";
import { describeError, errorDetail, isEntitlementError } from "./errors";
import { formatCount, formatMoney } from "./format";
import { activeNavPath, visibleNav } from "./navigation";
import { roleCan, rolePermissions } from "./permissions";
import { platformRoleCan } from "./platformPermissions";
import { statusInfo } from "./status";
import { API_MODULES, allEndpoints } from "./integration/apiCatalog";
import { describeScope, groupScopes } from "./integration/scopes";
import { localDate, localDateTime } from "./datetime";

describe("error mapping (Phase 9)", () => {
  it("maps known codes to contextual pt-PT messages", () => {
    expect(describeError(new ApiError(409, "TIMEZONE_NOT_CONFIGURED", "x", null))).toMatch(/fuso horário/);
    expect(describeError(new ApiError(409, "APPOINTMENT_CONFLICT", "x", null))).toMatch(/acabou de ser ocupado/);
    expect(describeError(new ApiError(403, "ENTITLEMENT_REQUIRED", "x", null))).toMatch(/não inclui este módulo/);
    expect(describeError(new ApiError(403, "FORBIDDEN", "x", null))).toBe("Não tens permissão para esta operação.");
    expect(describeError(new ApiError(401, "UNAUTHORIZED", "x", null))).toMatch(/sessão expirou/);
    expect(isEntitlementError(new ApiError(403, "ENTITLEMENT_REQUIRED", "x", null))).toBe(true);
  });

  it("never falls back to a bare 'something went wrong': unknown codes get a generic title AND keep the server's safe detail", () => {
    const error = new ApiError(500, "SOMETHING_NEW", "Date 2026-12-25 is already marked fully unavailable", "req-1");
    expect(describeError(error)).toBe("Não foi possível concluir a operação.");
    expect(errorDetail(error)).toBe("Date 2026-12-25 is already marked fully unavailable");
  });

  it("drops uninformative server messages as detail", () => {
    expect(errorDetail(new ApiError(500, "INTERNAL_ERROR", "Unexpected error", null))).toBeUndefined();
    expect(errorDetail(new ApiError(400, "VALIDATION_ERROR", "Invalid request payload", null))).toBeUndefined();
    expect(errorDetail(new ApiError(409, "CONFLICT", "Cannot remove the organization's last active owner", null))).toMatch(/last active owner/);
  });

  it("network failures (fetch TypeError) are explained, not shown raw", () => {
    expect(describeError(new TypeError("Failed to fetch"))).toMatch(/contactar o servidor/);
  });
});

describe("formatting", () => {
  it("formats decimal-string money without float math (pt-AO grouping, Kz)", () => {
    expect(formatMoney("10000.00")).toBe("10 000,00 Kz");
    expect(formatMoney("0.10")).toBe("0,10 Kz");
    expect(formatMoney("123456789012.99")).toBe("123 456 789 012,99 Kz");
    expect(formatMoney("5", "USD")).toBe("5,00 USD");
    expect(formatMoney("0.00")).toBe("0,00 Kz");
  });
  it("groups counts", () => {
    expect(formatCount(1234567)).toBe("1 234 567");
    expect(formatCount(0)).toBe("0");
  });
  it("invalid/missing timestamps render as '—' instead of crashing", () => {
    expect(localDate("", "Africa/Luanda")).toBe("—");
    expect(localDateTime("not-a-date", "Africa/Luanda")).toBe("—");
  });
});

describe("navigation & permissions (Phases 1, 3, 11)", () => {
  const labels = (role: string) => visibleNav(role).flatMap((g) => g.items.map((i) => i.label));

  it("STAFF sees every operational module it can read, but not Credentials/Webhooks (Platform api_key.read/webhook.read)", () => {
    const staff = labels("STAFF");
    for (const label of ["Visão geral", "Pedidos", "Marcações", "Clientes", "Inventário", "Produtos", "Categorias", "Serviços", "Profissionais", "Horários e disponibilidade", "API", "Documentação", "Equipa"]) {
      expect(staff).toContain(label);
    }
    expect(staff).not.toContain("Credenciais");
    expect(staff).not.toContain("Webhooks");
  });

  it("OWNER and ADMIN see Credentials and Webhooks; MANAGER does not", () => {
    expect(labels("OWNER")).toEqual(expect.arrayContaining(["Credenciais", "Webhooks"]));
    expect(labels("ADMIN")).toEqual(expect.arrayContaining(["Credenciais", "Webhooks"]));
    expect(labels("MANAGER")).not.toContain("Credenciais");
  });

  it("active item uses the longest matching prefix", () => {
    expect(activeNavPath("/o/org/products/123", "org")).toBe("/products");
    expect(activeNavPath("/o/org/integrations/credentials", "org")).toBe("/integrations/credentials");
    expect(activeNavPath("/o/org/integrations", "org")).toBe("/integrations");
    expect(activeNavPath("/o/org", "org")).toBe("");
    expect(activeNavPath("/o/other/products", "org")).toBeNull();
  });

  it("Platform mirror: only OWNER manages credentials/webhooks; STAFF cannot read usage", () => {
    expect(platformRoleCan("OWNER", "api_key.manage")).toBe(true);
    expect(platformRoleCan("ADMIN", "api_key.manage")).toBe(false);
    expect(platformRoleCan("ADMIN", "api_key.read")).toBe(true);
    expect(platformRoleCan("STAFF", "usage.read")).toBe(false);
    expect(platformRoleCan(undefined, "organization.read")).toBe(false);
  });

  it("rolePermissions exposes the same map roleCan uses", () => {
    for (const role of ["OWNER", "ADMIN", "MANAGER", "STAFF"]) {
      for (const permission of rolePermissions(role)) expect(roleCan(role, permission)).toBe(true);
    }
    expect(rolePermissions("STAFF")).not.toContain("appointments.create");
  });

  it("status vocabulary is pt-PT and falls back to the raw value for unknown enums", () => {
    expect(statusInfo("catalog", "ACTIVE")).toEqual({ label: "Activo", tone: "success" });
    expect(statusInfo("appointment", "NO_SHOW").label).toBe("Falta");
    expect(statusInfo("order", "SOMETHING_NEW")).toEqual({ label: "SOMETHING_NEW", tone: "neutral" });
  });
});

describe("API catalog consistency (Phase 8 documentation derived from the backend)", () => {
  const endpoints = allEndpoints();

  it("covers every module the backend exposes", () => {
    expect(API_MODULES.map((m) => m.id)).toEqual(["products", "categories", "customers", "inventory", "orders", "services", "professionals", "scheduling", "appointments"]);
    expect(endpoints.length).toBeGreaterThanOrEqual(56);
  });

  it("ids are unique", () => {
    expect(new Set(endpoints.map((e) => e.id)).size).toBe(endpoints.length);
  });

  it("reads require catalog.read and every write requires catalog.write (the backend's requireAuthorized pairs)", () => {
    for (const e of endpoints) {
      expect(e.scope, e.id).toBe(e.method === "GET" ? "catalog.read" : "catalog.write");
    }
  });

  it("every documented permission exists in the Na Pista permission model (OWNER holds all of them)", () => {
    for (const e of endpoints) {
      for (const permission of e.permission.match(/[a-z_]+\.[a-z_]+/g) ?? []) {
        expect(rolePermissions("OWNER"), `${e.id}: ${permission}`).toContain(permission);
      }
    }
  });

  it("every path is organization-scoped", () => {
    for (const e of endpoints) expect(e.path.startsWith("/organizations/{organizationId}/"), e.id).toBe(true);
  });
});

describe("scopes (Phase 8)", () => {
  it("explains real scopes by what they unlock; platform-facing scopes are flagged as not for integrations", () => {
    expect(describeScope("catalog.read").forIntegrations).toBe(true);
    expect(describeScope("catalog.write").usage).toMatch(/escrita em \d+ endpoints/);
    expect(describeScope("usage.write").forIntegrations).toBe(false);
    expect(describeScope("customer.read").usage).toMatch(/Não é verificado/);
  });

  it("groups by domain with integration-relevant groups first", () => {
    const groups = groupScopes([
      { key: "usage.write", description: "u" },
      { key: "catalog.write", description: "w" },
      { key: "catalog.read", description: "r" },
      { key: "event.publish", description: "e" },
    ]);
    expect(groups[0]!.domain).toBe("catalog");
    expect(groups[0]!.scopes.map((s) => s.key)).toEqual(["catalog.write", "catalog.read"]);
    expect(groups.map((g) => g.domain)).toEqual(["catalog", "event", "usage"]);
  });
});
