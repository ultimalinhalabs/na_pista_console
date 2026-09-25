import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfessionalsPage from "./page";
import { ApiError } from "../../../../lib/api/errors";
import type { Professional } from "../../../../lib/api/types";

/**
 * F25 brief §39: list, create, loading, empty, error, organization
 * context. `lib/api/professionals` and session/route params are mocked
 * so this exercises the page component in isolation, matching this
 * project's F25-established convention (see vitest.config.ts).
 */
vi.mock("next/navigation", () => ({
  useParams: () => ({ organizationId: "org-a" }),
}));

const { listProfessionalsMock, createProfessionalMock } = vi.hoisted(() => ({
  listProfessionalsMock: vi.fn(),
  createProfessionalMock: vi.fn(),
}));
vi.mock("../../../../lib/api/professionals", () => ({
  listProfessionals: listProfessionalsMock,
  createProfessional: createProfessionalMock,
}));

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
vi.mock("../../../../lib/session/SessionContext", () => ({
  useSession: useSessionMock,
}));

function professional(overrides: Partial<Professional> = {}): Professional {
  return {
    id: "p-1",
    organizationId: "org-a",
    name: "Ana Costa",
    description: null,
    phone: "+244923456789",
    email: null,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockSession(roleKey: string | undefined) {
  useSessionMock.mockReturnValue({
    identity: { memberships: roleKey ? [{ organizationId: "org-a", roleKey }] : [] },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfessionalsPage — organization context", () => {
  it("scopes the list request to the organizationId from the route params", async () => {
    mockSession("OWNER");
    listProfessionalsMock.mockResolvedValue([]);
    render(<ProfessionalsPage />);
    await waitFor(() => expect(listProfessionalsMock).toHaveBeenCalledWith("org-a", { status: "ACTIVE", q: undefined, limit: 100 }));
  });
});

describe("ProfessionalsPage — loading/empty/error", () => {
  it("shows a loading state before the list resolves", async () => {
    mockSession("OWNER");
    let resolve!: (v: Professional[]) => void;
    listProfessionalsMock.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<ProfessionalsPage />);
    expect(screen.getByText("A carregar…")).toBeInTheDocument();
    resolve([]);
    await waitFor(() => expect(screen.queryByText("A carregar…")).not.toBeInTheDocument());
  });

  it("shows an empty state when the list resolves with zero professionals", async () => {
    mockSession("OWNER");
    listProfessionalsMock.mockResolvedValue([]);
    render(<ProfessionalsPage />);
    await waitFor(() => expect(screen.getByText("Nenhum profissional encontrado.")).toBeInTheDocument());
  });

  it("renders a friendly message on a permission error (403 FORBIDDEN)", async () => {
    mockSession("STAFF");
    listProfessionalsMock.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Forbidden", "req-1"));
    render(<ProfessionalsPage />);
    await waitFor(() => expect(screen.getByText("Não tens permissão para esta operação.")).toBeInTheDocument());
  });

  it("renders an entitlement-specific message on 403 ENTITLEMENT_REQUIRED", async () => {
    mockSession("OWNER");
    listProfessionalsMock.mockRejectedValue(new ApiError(403, "ENTITLEMENT_REQUIRED", "Forbidden", "req-2"));
    render(<ProfessionalsPage />);
    await waitFor(() => expect(screen.getByText(/módulo de Profissionais activo/)).toBeInTheDocument());
  });

  it("renders the request reference on a generic error", async () => {
    mockSession("OWNER");
    listProfessionalsMock.mockRejectedValue(new ApiError(500, "INTERNAL", "Something broke", "req-999"));
    render(<ProfessionalsPage />);
    await waitFor(() => expect(screen.getByText(/Referência: req-999/)).toBeInTheDocument());
  });
});

describe("ProfessionalsPage — list rendering", () => {
  it("renders professional rows with name, contact and status", async () => {
    mockSession("OWNER");
    listProfessionalsMock.mockResolvedValue([professional({ name: "Ana Costa", phone: "+244923456789", email: "ana@example.com" })]);
    render(<ProfessionalsPage />);
    await waitFor(() => expect(screen.getByText("Ana Costa")).toBeInTheDocument());
    expect(screen.getByText("+244923456789 · ana@example.com")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument(); // F29: pt-PT status vocabulary (lib/status.ts)
  });
});

describe("ProfessionalsPage — create (permission-gated)", () => {
  it("hides the create button for STAFF (read-only role)", async () => {
    mockSession("STAFF");
    listProfessionalsMock.mockResolvedValue([]);
    render(<ProfessionalsPage />);
    await waitFor(() => expect(screen.queryByText("A carregar…")).not.toBeInTheDocument());
    expect(screen.queryByText("+ Novo profissional")).not.toBeInTheDocument();
  });

  it("OWNER can open the create form, submit it, and the list reloads", async () => {
    mockSession("OWNER");
    listProfessionalsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([professional({ name: "Novo Profissional" })]);
    createProfessionalMock.mockResolvedValue(professional({ name: "Novo Profissional" }));
    const user = userEvent.setup();
    render(<ProfessionalsPage />);
    await waitFor(() => expect(screen.getByText("+ Novo profissional")).toBeInTheDocument());

    await user.click(screen.getByText("+ Novo profissional"));
    await user.type(screen.getByLabelText("Nome"), "Novo Profissional");
    await user.click(screen.getByText("Criar"));

    await waitFor(() => expect(createProfessionalMock).toHaveBeenCalledWith("org-a", { name: "Novo Profissional", description: undefined, phone: undefined, email: undefined }));
    await waitFor(() => expect(screen.getByText("Novo Profissional")).toBeInTheDocument());
  });

  it("rejects submitting the create form with an empty name (client-side validation)", async () => {
    mockSession("OWNER");
    listProfessionalsMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<ProfessionalsPage />);
    await waitFor(() => expect(screen.getByText("+ Novo profissional")).toBeInTheDocument());
    await user.click(screen.getByText("+ Novo profissional"));
    // The name input has `required`; submit without typing to hit the client-side guard.
    const submit = screen.getByText("Criar");
    await user.click(submit);
    expect(createProfessionalMock).not.toHaveBeenCalled();
  });
});
