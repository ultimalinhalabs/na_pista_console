import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfessionalDetailPage from "./page";
import { ApiError } from "../../../../../lib/api/errors";
import type { AssociatedService, Professional, Service } from "../../../../../lib/api/types";

/**
 * F25 brief §39: edit, archive, reactivate, detail, associate Service,
 * remove Service, loading, error, organization context.
 */
vi.mock("next/navigation", () => ({
  useParams: () => ({ organizationId: "org-a", professionalId: "p-1" }),
}));

const { getProfessionalMock, listServicesForProfessionalMock, updateProfessionalMock, associateServiceMock, removeServiceAssociationMock } = vi.hoisted(() => ({
  getProfessionalMock: vi.fn(),
  listServicesForProfessionalMock: vi.fn(),
  updateProfessionalMock: vi.fn(),
  associateServiceMock: vi.fn(),
  removeServiceAssociationMock: vi.fn(),
}));
vi.mock("../../../../../lib/api/professionals", () => ({
  getProfessional: getProfessionalMock,
  listServicesForProfessional: listServicesForProfessionalMock,
  updateProfessional: updateProfessionalMock,
  associateService: associateServiceMock,
  removeServiceAssociation: removeServiceAssociationMock,
}));

const { listServicesMock } = vi.hoisted(() => ({ listServicesMock: vi.fn() }));
vi.mock("../../../../../lib/api/services", () => ({
  listServices: listServicesMock,
}));

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
vi.mock("../../../../../lib/session/SessionContext", () => ({
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

function service(overrides: Partial<Service> = {}): Service {
  return {
    id: "s-1",
    organizationId: "org-a",
    name: "Corte de Cabelo",
    description: null,
    durationMinutes: 30,
    price: "15.00",
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function associatedService(overrides: Partial<AssociatedService> = {}): AssociatedService {
  return {
    id: "s-1",
    name: "Corte de Cabelo",
    durationMinutes: 30,
    price: "15.00",
    status: "ACTIVE",
    associatedAt: "2026-01-02T00:00:00Z",
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
  listServicesMock.mockResolvedValue([]);
  listServicesForProfessionalMock.mockResolvedValue([]);
});

describe("ProfessionalDetailPage — loading/error/organization context", () => {
  it("shows a loading state before the professional resolves", async () => {
    mockSession("OWNER");
    let resolve!: (v: Professional) => void;
    getProfessionalMock.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<ProfessionalDetailPage />);
    expect(screen.getByText("A carregar…")).toBeInTheDocument();
    resolve(professional());
    await waitFor(() => expect(screen.queryByText("A carregar…")).not.toBeInTheDocument());
  });

  it("requests the professional scoped to the organizationId/professionalId route params", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(getProfessionalMock).toHaveBeenCalledWith("org-a", "p-1"));
    expect(listServicesForProfessionalMock).toHaveBeenCalledWith("org-a", "p-1");
  });

  it("shows a not-found message on 404", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockRejectedValue(new ApiError(404, "NOT_FOUND", "Not found", "req-1"));
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText(/Profissional não encontrado/)).toBeInTheDocument());
  });

  it("shows the error message and request reference on a generic error", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockRejectedValue(new ApiError(500, "INTERNAL", "Something broke", "req-77"));
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("Something broke")).toBeInTheDocument());
    expect(screen.getByText(/Referência: req-77/)).toBeInTheDocument();
  });
});

describe("ProfessionalDetailPage — edit", () => {
  it("prefills the form from the loaded professional and disables fields for a read-only role (STAFF)", async () => {
    mockSession("STAFF");
    getProfessionalMock.mockResolvedValue(professional({ name: "Ana Costa", phone: "+244923456789" }));
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByLabelText("Nome")).toHaveValue("Ana Costa"));
    expect(screen.getByLabelText("Nome")).toBeDisabled();
    expect(screen.queryByText("Guardar alterações")).not.toBeInTheDocument();
    expect(screen.queryByText("Arquivar")).not.toBeInTheDocument();
  });

  it("OWNER can edit and save the form", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional({ name: "Ana Costa" }));
    updateProfessionalMock.mockResolvedValue(professional({ name: "Ana Costa Silva" }));
    const user = userEvent.setup();
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByLabelText("Nome")).toHaveValue("Ana Costa"));

    await user.clear(screen.getByLabelText("Nome"));
    await user.type(screen.getByLabelText("Nome"), "Ana Costa Silva");
    await user.click(screen.getByText("Guardar alterações"));

    await waitFor(() =>
      expect(updateProfessionalMock).toHaveBeenCalledWith("org-a", "p-1", {
        name: "Ana Costa Silva",
        description: null,
        phone: "+244923456789",
        email: null,
      }),
    );
  });
});

describe("ProfessionalDetailPage — archive/reactivate", () => {
  it("OWNER can archive an ACTIVE professional via the toggle button", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional({ status: "ACTIVE" }));
    updateProfessionalMock.mockResolvedValue(professional({ status: "ARCHIVED" }));
    const user = userEvent.setup();
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("Arquivar")).toBeInTheDocument());

    await user.click(screen.getByText("Arquivar"));

    await waitFor(() => expect(updateProfessionalMock).toHaveBeenCalledWith("org-a", "p-1", { status: "ARCHIVED" }));
    await waitFor(() => expect(screen.getByText("Reactivar")).toBeInTheDocument());
  });

  it("OWNER can reactivate an ARCHIVED professional via the toggle button", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional({ status: "ARCHIVED" }));
    updateProfessionalMock.mockResolvedValue(professional({ status: "ACTIVE" }));
    const user = userEvent.setup();
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("Reactivar")).toBeInTheDocument());

    await user.click(screen.getByText("Reactivar"));

    await waitFor(() => expect(updateProfessionalMock).toHaveBeenCalledWith("org-a", "p-1", { status: "ACTIVE" }));
  });
});

describe("ProfessionalDetailPage — associated services (empty/associate/remove)", () => {
  it("shows an empty state when there are no associated services yet", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    listServicesForProfessionalMock.mockResolvedValue([]);
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("Nenhum serviço associado ainda.")).toBeInTheDocument());
  });

  it("lists associated services with duration/price/status and, for an editor, offers a Remover button", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    listServicesForProfessionalMock.mockResolvedValue([associatedService({ name: "Corte de Cabelo", durationMinutes: 30, price: "15.00" })]);
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("Corte de Cabelo")).toBeInTheDocument());
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("15.00 AOA")).toBeInTheDocument();
    expect(screen.getByText("Remover")).toBeInTheDocument();
  });

  it("hides the Remover button and the associate form for a read-only role (STAFF)", async () => {
    mockSession("STAFF");
    getProfessionalMock.mockResolvedValue(professional());
    listServicesForProfessionalMock.mockResolvedValue([associatedService()]);
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("Corte de Cabelo")).toBeInTheDocument());
    expect(screen.queryByText("Remover")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Adicionar serviço")).not.toBeInTheDocument();
  });

  it("OWNER associates a Service from the dropdown of active, not-yet-associated services", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    listServicesMock.mockResolvedValue([service({ id: "s-2", name: "Manicure" })]);
    listServicesForProfessionalMock.mockResolvedValueOnce([]).mockResolvedValueOnce([associatedService({ id: "s-2", name: "Manicure" })]);
    associateServiceMock.mockResolvedValue({ id: "assoc-1", professionalId: "p-1", serviceId: "s-2", createdAt: "2026-01-03T00:00:00Z" });
    const user = userEvent.setup();
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByLabelText("Adicionar serviço")).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("Adicionar serviço"), "s-2");
    await user.click(screen.getByText("Associar"));

    await waitFor(() => expect(associateServiceMock).toHaveBeenCalledWith("org-a", "p-1", "s-2"));
    await waitFor(() => expect(screen.getByText("Manicure")).toBeInTheDocument());
  });

  it("shows a dedicated association error without clobbering the main form", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    listServicesMock.mockResolvedValue([service({ id: "s-2", name: "Manicure" })]);
    associateServiceMock.mockRejectedValue(new ApiError(409, "PROFESSIONAL_ARCHIVED", "Professional is archived", "req-assoc"));
    const user = userEvent.setup();
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByLabelText("Adicionar serviço")).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("Adicionar serviço"), "s-2");
    await user.click(screen.getByText("Associar"));

    await waitFor(() => expect(screen.getByText("Professional is archived")).toBeInTheDocument());
    expect(screen.getByText(/Referência: req-assoc/)).toBeInTheDocument();
  });

  it("OWNER removes an associated service and it disappears from the table", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    listServicesForProfessionalMock.mockResolvedValue([associatedService({ id: "s-1", name: "Corte de Cabelo" })]);
    removeServiceAssociationMock.mockResolvedValue({ removed: true });
    const user = userEvent.setup();
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("Corte de Cabelo")).toBeInTheDocument());

    await user.click(screen.getByText("Remover"));

    await waitFor(() => expect(removeServiceAssociationMock).toHaveBeenCalledWith("org-a", "p-1", "s-1"));
    await waitFor(() => expect(screen.queryByText("Corte de Cabelo")).not.toBeInTheDocument());
  });
});
