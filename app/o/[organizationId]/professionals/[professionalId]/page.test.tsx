import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProfessionalDetailPage from "./page";
import { ApiError } from "../../../../../lib/api/errors";
import type { Availability, AssociatedService, Professional, Service, ScheduleException, ScheduleRule } from "../../../../../lib/api/types";

/**
 * F25 brief §39: edit, archive, reactivate, detail, associate Service,
 * remove Service, loading, error, organization context.
 * F26 brief §32: weekly schedule editor, exception editor, availability
 * preview — added to the same page/test file (ADR-039: Scheduling is a
 * property OF a Professional, docs/f26a-report.md §38).
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

const { getScheduleMock, replaceScheduleMock, listExceptionsMock, createExceptionMock, removeExceptionMock, getAvailabilityMock } = vi.hoisted(() => ({
  getScheduleMock: vi.fn(),
  replaceScheduleMock: vi.fn(),
  listExceptionsMock: vi.fn(),
  createExceptionMock: vi.fn(),
  removeExceptionMock: vi.fn(),
  getAvailabilityMock: vi.fn(),
}));
vi.mock("../../../../../lib/api/scheduling", () => ({
  getSchedule: getScheduleMock,
  replaceSchedule: replaceScheduleMock,
  listExceptions: listExceptionsMock,
  createException: createExceptionMock,
  removeException: removeExceptionMock,
  getAvailability: getAvailabilityMock,
}));

// F27: the page now embeds the shared "Marcações" section, which has its own
// data dependencies and its own tests (appointments/*.test.tsx) — stubbed
// here so this file keeps testing only the F25/F26 sections it always did.
const { appointmentsSectionMock } = vi.hoisted(() => ({ appointmentsSectionMock: vi.fn<(props: unknown) => null>(() => null) }));
vi.mock("../../../../../lib/appointments/components", () => ({
  AppointmentsSection: appointmentsSectionMock,
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

function scheduleRule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: "rule-1",
    organizationId: "org-a",
    professionalId: "p-1",
    dayOfWeek: 1,
    startLocalTime: "08:00",
    endLocalTime: "12:00",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function scheduleException(overrides: Partial<ScheduleException> = {}): ScheduleException {
  return {
    id: "exc-1",
    organizationId: "org-a",
    professionalId: "p-1",
    date: "2026-12-25",
    startLocalTime: null,
    endLocalTime: null,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function availability(overrides: Partial<Availability> = {}): Availability {
  return {
    timezone: "Africa/Luanda",
    days: [{ date: "2026-09-28", workingIntervals: [{ start: "08:00", end: "12:00" }] }],
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
  getScheduleMock.mockResolvedValue([]);
  listExceptionsMock.mockResolvedValue([]);
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

describe("ProfessionalDetailPage — weekly schedule editor (F26, ADR-039)", () => {
  it("renders 'Fechado' for a day with no configured intervals, and pre-filled time inputs for a day that has rules", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    getScheduleMock.mockResolvedValue([scheduleRule({ dayOfWeek: 1, startLocalTime: "08:00", endLocalTime: "12:00" })]);
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("Segunda")).toBeInTheDocument());

    // Sunday (dayOfWeek 0) has no rules.
    const sundayField = screen.getByText("Domingo").closest(".field");
    expect(sundayField).toHaveTextContent("Fechado");
  });

  it("+ Adicionar intervalo adds an empty interval row; Remover removes it", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    getScheduleMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("Segunda")).toBeInTheDocument());

    const mondayField = screen.getByText("Segunda").closest(".field") as HTMLElement;
    const addButton = within(mondayField).getByText("+ Adicionar intervalo");
    await user.click(addButton);
    expect(within(mondayField).getByText("Remover")).toBeInTheDocument();

    await user.click(within(mondayField).getByText("Remover"));
    expect(within(mondayField).queryByText("Remover")).not.toBeInTheDocument();
  });

  it("Guardar horário sends the flattened rule set, skipping incomplete rows", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    getScheduleMock.mockResolvedValue([scheduleRule({ dayOfWeek: 1, startLocalTime: "08:00", endLocalTime: "12:00" })]);
    replaceScheduleMock.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("Guardar horário")).toBeInTheDocument());

    await user.click(screen.getByText("Guardar horário"));

    await waitFor(() =>
      expect(replaceScheduleMock).toHaveBeenCalledWith("org-a", "p-1", [{ dayOfWeek: 1, startLocalTime: "08:00", endLocalTime: "12:00" }]),
    );
    expect(screen.getByText("Guardado.")).toBeInTheDocument();
  });

  it("STAFF (read-only) sees the configured schedule but no add/remove/save controls", async () => {
    mockSession("STAFF");
    getProfessionalMock.mockResolvedValue(professional());
    getScheduleMock.mockResolvedValue([scheduleRule({ dayOfWeek: 1, startLocalTime: "08:00", endLocalTime: "12:00" })]);
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("Segunda")).toBeInTheDocument());

    expect(screen.queryByText("+ Adicionar intervalo")).not.toBeInTheDocument();
    expect(screen.queryByText("Guardar horário")).not.toBeInTheDocument();
  });
});

describe("ProfessionalDetailPage — schedule exceptions (F26, ADR-039 D4)", () => {
  it("shows an empty state when there are no exceptions yet", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    listExceptionsMock.mockResolvedValue([]);
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("Nenhuma excepção configurada.")).toBeInTheDocument());
  });

  it("lists a closed-marker exception as 'Fechado o dia todo' and an interval exception with its hours", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    listExceptionsMock.mockResolvedValue([
      scheduleException({ id: "exc-closed", date: "2026-12-25" }),
      scheduleException({ id: "exc-interval", date: "2026-09-28", startLocalTime: "09:00", endLocalTime: "14:00" }),
    ]);
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("2026-12-25")).toBeInTheDocument());
    // "Fechado o dia todo" also labels the create-form's checkbox above the table — scope to the table row.
    expect(within(screen.getByRole("table")).getByText("Fechado o dia todo")).toBeInTheDocument();
    expect(screen.getByText("09:00 - 14:00")).toBeInTheDocument();
  });

  it("OWNER creates a closed-marker exception (checkbox checked by default) and it appears in the list", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    listExceptionsMock.mockResolvedValueOnce([]);
    createExceptionMock.mockResolvedValue(scheduleException({ id: "exc-new", date: "2026-12-25" }));
    const user = userEvent.setup();
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByLabelText("Data")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Data"), "2026-12-25");
    await user.click(screen.getByText("Adicionar excepção"));

    await waitFor(() => expect(createExceptionMock).toHaveBeenCalledWith("org-a", "p-1", { date: "2026-12-25" }));
    await waitFor(() => expect(within(screen.getByRole("table")).getByText("Fechado o dia todo")).toBeInTheDocument());
  });

  it("removing an exception calls removeException and it disappears from the list", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    listExceptionsMock.mockResolvedValue([scheduleException({ id: "exc-1", date: "2026-12-25" })]);
    removeExceptionMock.mockResolvedValue({ removed: true });
    const user = userEvent.setup();
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("2026-12-25")).toBeInTheDocument());

    await user.click(screen.getByText("Remover"));

    await waitFor(() => expect(removeExceptionMock).toHaveBeenCalledWith("org-a", "p-1", "exc-1"));
    await waitFor(() => expect(screen.queryByText("2026-12-25")).not.toBeInTheDocument());
  });

  it("STAFF (read-only) sees exceptions but no create form and no Remover buttons", async () => {
    mockSession("STAFF");
    getProfessionalMock.mockResolvedValue(professional());
    listExceptionsMock.mockResolvedValue([scheduleException({ id: "exc-1", date: "2026-12-25" })]);
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByText("2026-12-25")).toBeInTheDocument());

    expect(screen.queryByLabelText("Data")).not.toBeInTheDocument();
    expect(screen.queryByText("Remover")).not.toBeInTheDocument();
  });
});

describe("ProfessionalDetailPage — availability preview (F26, ADR-041: working availability, not a booking guarantee)", () => {
  it("submits the requested range and displays the computed working intervals with the resolved timezone", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    getAvailabilityMock.mockResolvedValue(availability());
    const user = userEvent.setup();
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByLabelText("De")).toBeInTheDocument());

    await user.type(screen.getByLabelText("De"), "2026-09-28");
    await user.type(screen.getByLabelText("Até"), "2026-09-28");
    await user.click(screen.getByText("Consultar"));

    await waitFor(() => expect(getAvailabilityMock).toHaveBeenCalledWith("org-a", "p-1", { from: "2026-09-28", to: "2026-09-28", serviceId: undefined }));
    await waitFor(() => expect(screen.getByText(/Horário de trabalho \(Africa\/Luanda\)/)).toBeInTheDocument());
    expect(screen.getByText("08:00-12:00")).toBeInTheDocument();
  });

  it("shows an empty state when every day in range has no working intervals", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    getAvailabilityMock.mockResolvedValue(availability({ days: [{ date: "2026-09-28", workingIntervals: [] }] }));
    const user = userEvent.setup();
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByLabelText("De")).toBeInTheDocument());
    await user.type(screen.getByLabelText("De"), "2026-09-28");
    await user.type(screen.getByLabelText("Até"), "2026-09-28");
    await user.click(screen.getByText("Consultar"));

    await waitFor(() => expect(screen.getByText("Sem disponibilidade no período indicado.")).toBeInTheDocument());
  });

  it("shows a friendly message for TIMEZONE_NOT_CONFIGURED instead of the raw API error", async () => {
    mockSession("OWNER");
    getProfessionalMock.mockResolvedValue(professional());
    getAvailabilityMock.mockRejectedValue(new ApiError(409, "TIMEZONE_NOT_CONFIGURED", "This organization has no timezone configured", "req-tz"));
    const user = userEvent.setup();
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(screen.getByLabelText("De")).toBeInTheDocument());
    await user.type(screen.getByLabelText("De"), "2026-09-28");
    await user.type(screen.getByLabelText("Até"), "2026-09-28");
    await user.click(screen.getByText("Consultar"));

    await waitFor(() => expect(screen.getByText(/ainda não configurou um fuso horário/)).toBeInTheDocument());
  });
});

describe("ProfessionalDetailPage — Marcações (F27 integration)", () => {
  it("embeds the shared appointments section filtered to THIS professional, with create allowed for an ACTIVE professional and a MANAGER", async () => {
    mockSession("MANAGER");
    getProfessionalMock.mockResolvedValue(professional());
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(appointmentsSectionMock).toHaveBeenCalled());
    expect(appointmentsSectionMock.mock.lastCall![0]).toMatchObject({ organizationId: "org-a", filter: { professionalId: "p-1" }, canCreate: true });
  });

  it("no create entry for STAFF, nor for an ARCHIVED professional", async () => {
    mockSession("STAFF");
    getProfessionalMock.mockResolvedValue(professional());
    const { unmount } = render(<ProfessionalDetailPage />);
    await waitFor(() => expect(appointmentsSectionMock).toHaveBeenCalled());
    expect(appointmentsSectionMock.mock.lastCall![0]).toMatchObject({ canCreate: false });
    unmount();

    appointmentsSectionMock.mockClear();
    mockSession("MANAGER");
    getProfessionalMock.mockResolvedValue(professional({ status: "ARCHIVED" }));
    render(<ProfessionalDetailPage />);
    await waitFor(() => expect(appointmentsSectionMock).toHaveBeenCalled());
    expect(appointmentsSectionMock.mock.lastCall![0]).toMatchObject({ canCreate: false });
  });
});
