import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CredentialsPage from "./credentials/page";
import WebhooksPage from "./webhooks/page";
import EnvironmentsPage from "./environments/page";
import ApiDocsPage from "./docs/page";
import IntegrationsPage from "./page";
import { ApiError } from "../../../../lib/api/errors";

/** F29 Integration Center (Phase 8) — API overview, credentials (one-time secret), scopes, environments, webhooks, documentation. */
vi.mock("next/navigation", () => ({ useParams: () => ({ organizationId: "org-a" }) }));

const platform = vi.hoisted(() => ({
  NA_PISTA_APPLICATION: "NA_PISTA",
  listApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  listApplicationScopes: vi.fn(),
  listEnvironments: vi.fn(),
  listEnvironmentEndpoints: vi.fn(),
  listWebhooks: vi.fn(),
  createWebhook: vi.fn(),
  revokeWebhook: vi.fn(),
  testWebhook: vi.fn(),
  getApiRequestUsage: vi.fn(),
}));
vi.mock("../../../../lib/api/platform", () => platform);
vi.mock("../../../../lib/api/organizationSettings", () => ({ getOrganizationSettings: vi.fn().mockResolvedValue({ organizationId: "org-a", timezone: "Africa/Luanda", createdAt: "", updatedAt: "" }) }));

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
vi.mock("../../../../lib/session/SessionContext", () => ({ useSession: useSessionMock }));

function asRole(roleKey: string) {
  useSessionMock.mockReturnValue({ identity: { userId: "u-1", memberships: [{ organizationId: "org-a", roleKey, status: "active" }] }, refreshIdentity: vi.fn() });
}

const key = (overrides = {}) => ({
  id: "0f6c2a1e-1111-4111-8111-111111111111",
  application: "NA_PISTA",
  organizationId: "org-a",
  status: "ACTIVE",
  createdAt: "2026-09-20T10:00:00.000Z",
  expiresAt: null,
  revokedAt: null,
  scopes: ["catalog.read"],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  asRole("OWNER");
  platform.listApiKeys.mockResolvedValue([key(), key({ id: "22222222-2222-4222-8222-222222222222", application: "MICHA_EXPRESS" })]);
  platform.listApplicationScopes.mockResolvedValue({
    application: { key: "NA_PISTA", name: "Na Pista" },
    scopes: [
      { key: "catalog.read", description: "Read catalog data." },
      { key: "catalog.write", description: "Create/update catalog data." },
      { key: "usage.write", description: "Record usage." },
    ],
  });
  platform.listWebhooks.mockResolvedValue([{ id: "33333333-3333-4333-8333-333333333333", application: "NA_PISTA", organizationId: "org-a", status: "ACTIVE", createdAt: "2026-09-20T10:00:00.000Z", revokedAt: null, eventTypes: ["appointment.created"] }]);
  platform.listEnvironments.mockResolvedValue([
    { application: "NA_PISTA", key: "production", status: "ACTIVE" },
    { application: "NA_PISTA", key: "staging", status: "ACTIVE" },
  ]);
  platform.listEnvironmentEndpoints.mockImplementation(async (env: string) => (env === "staging" ? [{ type: "API", baseUrl: "https://staging.na-pista.example", status: "ACTIVE" }] : []));
  platform.getApiRequestUsage.mockResolvedValue({ quantity: 1234 });
});

describe("Credentials", () => {
  it("lists only NA_PISTA credentials with status and scopes; says 'last used' and environment are not tracked", async () => {
    render(<CredentialsPage />);
    expect(await screen.findByText("ulk_0f6c2a1e…")).toBeInTheDocument();
    expect(screen.queryByText("ulk_22222222…")).not.toBeInTheDocument();
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(screen.getByText(/Último uso: não disponível/)).toBeInTheDocument();
  });

  it("OWNER creates a credential: the secret is shown ONCE with the warning, copyable, and never kept after the dialog closes", async () => {
    platform.createApiKey.mockResolvedValue({ ...key({ id: "44444444-4444-4444-8444-444444444444", scopes: ["catalog.read", "catalog.write"] }), secret: "ulk_44444444.super-secret-value" });
    render(<CredentialsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Nova credencial" }));
    const dialog = screen.getByRole("dialog", { name: "Nova credencial" });
    await userEvent.click(within(dialog).getByLabelText("catalog.write"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Criar credencial" }));
    await waitFor(() => expect(platform.createApiKey).toHaveBeenCalledWith("org-a", { scopes: ["catalog.read", "catalog.write"] }));

    const secretDialog = await screen.findByRole("dialog", { name: "Credencial criada" });
    expect(secretDialog).toHaveTextContent("Este segredo só será mostrado uma vez.");
    expect(within(secretDialog).getByTestId("credential-secret")).toHaveTextContent("ulk_44444444.super-secret-value");
    expect(within(secretDialog).getByRole("button", { name: "Copiar" })).toBeInTheDocument();

    await userEvent.click(within(secretDialog).getByRole("button", { name: "Já guardei o segredo" }));
    expect(screen.queryByText("ulk_44444444.super-secret-value")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("super-secret-value");
    expect(await screen.findByText("ulk_44444444…")).toBeInTheDocument();
  });

  it("revoking asks for confirmation, then shows the server's state", async () => {
    platform.revokeApiKey.mockResolvedValue(key({ status: "REVOKED", revokedAt: "2026-09-25T10:00:00.000Z" }));
    render(<CredentialsPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Revogar" }));
    const dialog = screen.getByRole("dialog", { name: "Revogar credencial?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Revogar" }));
    await waitFor(() => expect(platform.revokeApiKey).toHaveBeenCalledWith("org-a", "0f6c2a1e-1111-4111-8111-111111111111"));
    expect(await screen.findByText("Revogada")).toBeInTheDocument();
  });

  it("ADMIN can read but not create/revoke; MANAGER/STAFF get a permission state and no API call", async () => {
    asRole("ADMIN");
    const { unmount } = render(<CredentialsPage />);
    expect(await screen.findByText("ulk_0f6c2a1e…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nova credencial" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revogar" })).not.toBeInTheDocument();
    unmount();

    platform.listApiKeys.mockClear();
    asRole("MANAGER");
    render(<CredentialsPage />);
    expect(screen.getByText("Sem permissão")).toBeInTheDocument();
    expect(platform.listApiKeys).not.toHaveBeenCalled();
  });

  it("scopes come from the Platform and are explained by what they unlock", async () => {
    render(<CredentialsPage />);
    expect(await screen.findByText("Catálogo e operação")).toBeInTheDocument();
    expect(screen.getAllByText(/endpoints da Na Pista API/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Credencial de plataforma/)).toBeInTheDocument();
  });

  it("a Platform error is explained with its reference", async () => {
    platform.listApiKeys.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Insufficient permissions", "req-9"));
    render(<CredentialsPage />);
    expect(await screen.findByText("Não tens permissão para esta operação.")).toBeInTheDocument();
    expect(screen.getByText("Referência: req-9")).toBeInTheDocument();
  });
});

describe("Webhooks", () => {
  it("states that Na Pista does not publish events yet and that URL/delivery history are not available", async () => {
    render(<WebhooksPage />);
    expect(await screen.findByText("A Na Pista ainda não publica eventos")).toBeInTheDocument();
    expect(screen.getByText(/histórico de entregas não são devolvidos/)).toBeInTheDocument();
    expect(await screen.findByText("appointment.created")).toBeInTheDocument();
  });

  it("test delivery shows the synchronous result", async () => {
    platform.testWebhook.mockResolvedValue({ status: "FAILED", responseStatus: 500 });
    render(<WebhooksPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Testar" }));
    expect(await screen.findByText("Falhou (HTTP 500)")).toBeInTheDocument();
  });

  it("create shows the signing secret once and the target URL", async () => {
    platform.createWebhook.mockResolvedValue({ id: "55555555-5555-4555-8555-555555555555", application: "NA_PISTA", organizationId: "org-a", status: "ACTIVE", createdAt: "2026-09-25T10:00:00.000Z", revokedAt: null, eventTypes: ["appointment.created"], secret: "whsec-once" });
    render(<WebhooksPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Novo webhook" }));
    await userEvent.type(screen.getByLabelText("URL de destino (HTTPS)"), "https://exemplo.ao/hook");
    await userEvent.click(screen.getByRole("button", { name: "Criar webhook" }));
    await waitFor(() => expect(platform.createWebhook).toHaveBeenCalledWith("org-a", { url: "https://exemplo.ao/hook", eventTypes: ["appointment.created"] }));
    const dialog = await screen.findByRole("dialog", { name: "Webhook criado" });
    expect(dialog).toHaveTextContent("whsec-once");
    expect(dialog).toHaveTextContent("https://exemplo.ao/hook");
  });

  it("rejects a malformed custom event type before calling the API", async () => {
    render(<WebhooksPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Novo webhook" }));
    fireEvent.change(screen.getByLabelText("Outro tipo de evento (opcional)"), { target: { value: "Bad Event" } });
    expect(screen.getByText(/formato "domínio.acção"/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar webhook" })).toBeDisabled();
  });

  it("MANAGER gets a permission state", () => {
    asRole("MANAGER");
    render(<WebhooksPage />);
    expect(screen.getByText("Sem permissão")).toBeInTheDocument();
    expect(platform.listWebhooks).not.toHaveBeenCalled();
  });
});

describe("Environments / API overview / Documentation", () => {
  it("shows the environments the Platform declares, with their endpoints, read-only", async () => {
    render(<EnvironmentsPage />);
    expect(await screen.findByText("production")).toBeInTheDocument();
    expect(screen.getByText("staging")).toBeInTheDocument();
    expect(await screen.findByText("https://staging.na-pista.example")).toBeInTheDocument();
    expect(screen.getByText("nenhum registado")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("API overview shows organization id, auth model, modules with scopes and the real usage meter (no secrets)", async () => {
    render(<IntegrationsPage />);
    expect(screen.getAllByText("org-a").length).toBeGreaterThan(0);
    expect(screen.getByText(/ulk_<id>.<segredo>/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Marcações" })).toHaveAttribute("href", "/o/org-a/integrations/docs#appointments");
    await waitFor(() => expect(platform.getApiRequestUsage).toHaveBeenCalledWith("org-a"));
    await waitFor(() => expect(document.body.textContent).toMatch(/Operações registadas\s*1\s234/));
  });

  it("STAFF does not request usage (no usage.read)", () => {
    asRole("STAFF");
    render(<IntegrationsPage />);
    expect(platform.getApiRequestUsage).not.toHaveBeenCalled();
  });

  it("documentation lists every module and filters endpoints", async () => {
    render(<ApiDocsPage />);
    expect(screen.getByRole("heading", { name: "Marcações" })).toBeInTheDocument();
    expect(screen.getAllByText("/organizations/{organizationId}/appointments/{appointmentId}/no-show").length).toBe(1);
    await userEvent.type(screen.getByRole("searchbox", { name: "Filtrar endpoints" }), "no-show");
    expect(screen.queryByRole("heading", { name: "Produtos" })).not.toBeInTheDocument();
    expect(screen.getByText("Registar falta (a partir da hora de início, sem corpo)")).toBeInTheDocument();
    await userEvent.clear(screen.getByRole("searchbox", { name: "Filtrar endpoints" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Filtrar endpoints" }), "xyz-nothing");
    expect(screen.getByText(/Nenhum endpoint corresponde/)).toBeInTheDocument();
  });
});
