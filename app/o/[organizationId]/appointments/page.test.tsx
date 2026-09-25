import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppointmentsDayPage from "./page";
import { AppointmentsSection } from "../../../../lib/appointments/components";
import { ApiError } from "../../../../lib/api/errors";
import type { Appointment } from "../../../../lib/api/types";

/** F27 brief §58: day view, timezone semantics, permission-aware create entry, error/empty/timezone states, and the embeddable section used by Professional/Customer pages. */
vi.mock("next/navigation", () => ({
  useParams: () => ({ organizationId: "org-a" }),
}));

const { listAppointmentsMock } = vi.hoisted(() => ({ listAppointmentsMock: vi.fn() }));
vi.mock("../../../../lib/api/appointments", () => ({ listAppointments: listAppointmentsMock }));

const { getOrganizationSettingsMock } = vi.hoisted(() => ({ getOrganizationSettingsMock: vi.fn() }));
vi.mock("../../../../lib/api/organizationSettings", () => ({ getOrganizationSettings: getOrganizationSettingsMock }));

const { listProfessionalsMock } = vi.hoisted(() => ({ listProfessionalsMock: vi.fn() }));
vi.mock("../../../../lib/api/professionals", () => ({ listProfessionals: listProfessionalsMock }));

const { getCustomerMock } = vi.hoisted(() => ({ getCustomerMock: vi.fn() }));
vi.mock("../../../../lib/api/customers", () => ({ getCustomer: getCustomerMock }));

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
vi.mock("../../../../lib/session/SessionContext", () => ({ useSession: useSessionMock }));

export function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "a-1",
    organizationId: "org-a",
    customerId: "c-1",
    professionalId: "p-1",
    serviceId: "s-1",
    startAt: "2026-10-05T08:00:00.000Z",
    endAt: "2026-10-05T09:00:00.000Z",
    durationMinutes: 60,
    status: "SCHEDULED",
    serviceName: "Personal Training",
    servicePrice: "10000.00",
    currency: "AOA",
    notes: null,
    cancellationReason: null,
    canceledAt: null,
    completedAt: null,
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

function asRole(roleKey: string) {
  useSessionMock.mockReturnValue({ identity: { memberships: [{ organizationId: "org-a", roleKey, status: "active" }] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  asRole("MANAGER");
  getOrganizationSettingsMock.mockResolvedValue({ organizationId: "org-a", timezone: "Africa/Luanda", createdAt: "", updatedAt: "" });
  listProfessionalsMock.mockResolvedValue([{ id: "p-1", name: "Ana Costa", status: "ACTIVE" }]);
  getCustomerMock.mockResolvedValue({ id: "c-1", name: "João Silva", status: "ACTIVE" });
  listAppointmentsMock.mockResolvedValue([]);
});

describe("Appointments day view", () => {
  it("lists the day's appointments with times in the ORGANIZATION timezone, customer/professional names, service and status", async () => {
    listAppointmentsMock.mockResolvedValue([appointment(), appointment({ id: "a-2", startAt: "2026-10-05T10:00:00.000Z", endAt: "2026-10-05T10:30:00.000Z", status: "CANCELED", durationMinutes: 30 })]);
    render(<AppointmentsDayPage />);
    expect(await screen.findByText("09:00–10:00")).toBeInTheDocument(); // 08:00Z = 09:00 in Luanda
    expect(screen.getByText("11:00–11:30")).toBeInTheDocument();
    expect(await screen.findAllByText("João Silva")).toHaveLength(2);
    expect(screen.getAllByText("Ana Costa").length).toBeGreaterThan(0);
    expect(screen.getByText("Agendada")).toBeInTheDocument();
    expect(screen.getByText("Cancelada")).toBeInTheDocument();
    expect(screen.getByText("Fuso horário: Africa/Luanda")).toBeInTheDocument();
  });

  it("queries ONE local date (from = to) and re-queries with a professional filter", async () => {
    render(<AppointmentsDayPage />);
    await waitFor(() => expect(listAppointmentsMock).toHaveBeenCalled());
    const [, firstQuery] = listAppointmentsMock.mock.calls[0]!;
    expect(firstQuery.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(firstQuery.to).toBe(firstQuery.from);

    await screen.findByRole("option", { name: "Ana Costa" });
    await userEvent.selectOptions(screen.getByLabelText("Profissional"), "p-1");
    await waitFor(() => expect(listAppointmentsMock).toHaveBeenLastCalledWith("org-a", expect.objectContaining({ professionalId: "p-1" })));
  });

  it("changing the date re-queries that date", async () => {
    render(<AppointmentsDayPage />);
    await waitFor(() => expect(listAppointmentsMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-12-24" } });
    await waitFor(() => expect(listAppointmentsMock).toHaveBeenLastCalledWith("org-a", expect.objectContaining({ from: "2026-12-24", to: "2026-12-24" })));
  });

  it("empty state", async () => {
    render(<AppointmentsDayPage />);
    expect(await screen.findByText("Sem marcações neste dia.")).toBeInTheDocument();
  });

  it("MANAGER sees 'Nova marcação'; STAFF (read-only) does not", async () => {
    const { unmount } = render(<AppointmentsDayPage />);
    expect(await screen.findByRole("link", { name: "Nova marcação" })).toBeInTheDocument();
    unmount();
    asRole("STAFF");
    render(<AppointmentsDayPage />);
    await screen.findByText("Sem marcações neste dia.");
    expect(screen.queryByRole("link", { name: "Nova marcação" })).not.toBeInTheDocument();
  });

  it("timezone not configured: blocking message with a link to Definições, no list request", async () => {
    getOrganizationSettingsMock.mockResolvedValue(null);
    render(<AppointmentsDayPage />);
    expect(await screen.findByText(/ainda não configurou um fuso horário/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configurar em Definições" })).toHaveAttribute("href", "/o/org-a/settings");
    expect(listAppointmentsMock).not.toHaveBeenCalled();
  });

  it("entitlement denied and permission denied are explained, with the request reference", async () => {
    listAppointmentsMock.mockRejectedValue(new ApiError(403, "ENTITLEMENT_REQUIRED", "raw", "req-123"));
    render(<AppointmentsDayPage />);
    expect(await screen.findByText(/não inclui este módulo/)).toBeInTheDocument();
    expect(screen.getByText("Referência: req-123")).toBeInTheDocument();
  });

  it("permission denied (403 FORBIDDEN) is explained", async () => {
    listAppointmentsMock.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Missing permission: appointments.read", null));
    render(<AppointmentsDayPage />);
    expect(await screen.findByText("Não tens permissão para esta operação.")).toBeInTheDocument();
  });
});

describe("AppointmentsSection (Professional / Customer integration)", () => {
  it("Professional integration: lists only that professional's appointments and prefills the create link", async () => {
    listAppointmentsMock.mockResolvedValue([appointment()]);
    render(<AppointmentsSection organizationId="org-a" filter={{ professionalId: "p-1" }} canCreate defaultRangeDays={7} />);
    expect(await screen.findByText("09:00–10:00")).toBeInTheDocument();
    const [, query] = listAppointmentsMock.mock.calls[0]!;
    expect(query.professionalId).toBe("p-1");
    expect(screen.getByRole("link", { name: "Nova marcação" })).toHaveAttribute("href", "/o/org-a/appointments/new?professionalId=p-1");
    expect(screen.queryByRole("columnheader", { name: "Profissional" })).not.toBeInTheDocument();
  });

  it("Customer integration: lists that customer's appointments over a bounded (≤ 31-day) window", async () => {
    render(<AppointmentsSection organizationId="org-a" filter={{ customerId: "c-1" }} canCreate={false} defaultRangeDays={31} />);
    await waitFor(() => expect(listAppointmentsMock).toHaveBeenCalled());
    const [, query] = listAppointmentsMock.mock.calls[0]!;
    expect(query.customerId).toBe("c-1");
    const days = (Date.parse(`${query.to}T00:00:00Z`) - Date.parse(`${query.from}T00:00:00Z`)) / 86_400_000 + 1;
    expect(days).toBe(31);
    expect(await screen.findByText("Sem marcações no período indicado.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nova marcação" })).not.toBeInTheDocument();
  });
});
