import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AppointmentDetailPage from "./page";
import { ApiError } from "../../../../../lib/api/errors";
import type { Appointment } from "../../../../../lib/api/types";

/** F27 brief §50/§58: detail, reschedule (slots from the API), cancel, complete, conflict, permission- and lifecycle-aware controls. */
vi.mock("next/navigation", () => ({
  useParams: () => ({ organizationId: "org-a", appointmentId: "a-1" }),
}));

const api = vi.hoisted(() => ({
  getAppointment: vi.fn(),
  updateAppointment: vi.fn(),
  cancelAppointment: vi.fn(),
  completeAppointment: vi.fn(),
  getBookableSlots: vi.fn(),
  markNoShow: vi.fn(),
}));
vi.mock("../../../../../lib/api/appointments", () => api);

const { getCustomerMock } = vi.hoisted(() => ({ getCustomerMock: vi.fn() }));
vi.mock("../../../../../lib/api/customers", () => ({ getCustomer: getCustomerMock }));

const { getProfessionalMock, listProfessionalsMock } = vi.hoisted(() => ({ getProfessionalMock: vi.fn(), listProfessionalsMock: vi.fn() }));
vi.mock("../../../../../lib/api/professionals", () => ({ getProfessional: getProfessionalMock, listProfessionals: listProfessionalsMock }));

const { getOrganizationSettingsMock } = vi.hoisted(() => ({ getOrganizationSettingsMock: vi.fn() }));
vi.mock("../../../../../lib/api/organizationSettings", () => ({ getOrganizationSettings: getOrganizationSettingsMock }));

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
vi.mock("../../../../../lib/session/SessionContext", () => ({ useSession: useSessionMock }));

function appointment(overrides: Partial<Appointment> = {}): Appointment {
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
    notes: "Traz toalha",
    cancellationReason: null,
    canceledAt: null,
    completedAt: null,
    noShowAt: null,
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
  api.getAppointment.mockResolvedValue(appointment());
  getCustomerMock.mockResolvedValue({ id: "c-1", name: "João Silva", status: "ACTIVE" });
  getProfessionalMock.mockImplementation(async (_org: string, id: string) => ({ id, name: id === "p-2" ? "Bruno Dias" : "Ana Costa", status: "ACTIVE" }));
  listProfessionalsMock.mockResolvedValue([
    { id: "p-1", name: "Ana Costa", status: "ACTIVE" },
    { id: "p-2", name: "Bruno Dias", status: "ACTIVE" },
  ]);
  api.getBookableSlots.mockResolvedValue({
    timezone: "Africa/Luanda",
    date: "2026-10-06",
    serviceId: "s-1",
    durationMinutes: 60,
    slots: [{ localStartTime: "14:00", startAt: "2026-10-06T13:00:00.000Z", endAt: "2026-10-06T14:00:00.000Z" }],
  });
});

describe("Appointment detail", () => {
  it("shows date/time in the organization timezone, duration, customer, professional, snapshot price, notes, status", async () => {
    render(<AppointmentDetailPage />);
    expect(await screen.findByText(/2026-10-05 · 09:00–10:00 \(60 min\)/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "João Silva" })).toHaveAttribute("href", "/o/org-a/customers/c-1");
    expect(screen.getByRole("link", { name: "Ana Costa" })).toHaveAttribute("href", "/o/org-a/professionals/p-1");
    expect(screen.getByText("Personal Training — 10000.00 AOA")).toBeInTheDocument();
    expect(screen.getByText("Agendada")).toBeInTheDocument();
    expect(screen.getByLabelText("Notas")).toHaveValue("Traz toalha");
  });

  it("unpriced snapshot shows 'sem preço'", async () => {
    api.getAppointment.mockResolvedValue(appointment({ servicePrice: null }));
    render(<AppointmentDetailPage />);
    expect(await screen.findByText("Personal Training — sem preço")).toBeInTheDocument();
  });

  it("not found", async () => {
    api.getAppointment.mockRejectedValue(new ApiError(404, "APPOINTMENT_NOT_FOUND", "x", null));
    render(<AppointmentDetailPage />);
    expect(await screen.findByText(/Marcação não encontrada/)).toBeInTheDocument();
  });

  it("STAFF sees the appointment but no mutation controls", async () => {
    asRole("STAFF");
    render(<AppointmentDetailPage />);
    await screen.findByText("Agendada");
    expect(screen.queryByRole("button", { name: "Reagendar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Concluir" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar marcação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar notas" })).not.toBeInTheDocument();
  });

  it("terminal states (COMPLETED / CANCELED) show no mutation controls even for a MANAGER", async () => {
    api.getAppointment.mockResolvedValue(appointment({ status: "CANCELED", canceledAt: "2026-10-02T10:00:00.000Z", cancellationReason: "Pedido do cliente" }));
    render(<AppointmentDetailPage />);
    expect(await screen.findByText(/Pedido do cliente/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reagendar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar marcação" })).not.toBeInTheDocument();
  });

  it("cancel: sends the optional reason, then renders the SERVER's canceled state", async () => {
    api.cancelAppointment.mockResolvedValue(appointment({ status: "CANCELED", canceledAt: "2026-10-02T10:00:00.000Z", cancellationReason: "Doente" }));
    render(<AppointmentDetailPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar marcação" }));
    await userEvent.type(screen.getByLabelText("Motivo (opcional)"), "Doente");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar cancelamento" }));
    await waitFor(() => expect(api.cancelAppointment).toHaveBeenCalledWith("org-a", "a-1", "Doente"));
    expect(await screen.findByText("Cancelada", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reagendar" })).not.toBeInTheDocument();
  });

  it("complete: success renders COMPLETED; too-early is explained (the server decides, not the browser clock)", async () => {
    api.completeAppointment.mockRejectedValueOnce(new ApiError(409, "APPOINTMENT_COMPLETION_TOO_EARLY", "raw", null));
    render(<AppointmentDetailPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Concluir" }));
    expect(await screen.findByText(/ainda não começou/)).toBeInTheDocument();
    expect(screen.getByText("Agendada")).toBeInTheDocument();

    api.completeAppointment.mockResolvedValueOnce(appointment({ status: "COMPLETED", completedAt: "2026-10-05T09:00:00.000Z" }));
    await userEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(await screen.findByText("Concluída", { selector: "span" })).toBeInTheDocument();
  });

  it("notes: saving sends the text (or null when cleared)", async () => {
    api.updateAppointment.mockImplementation(async (_o: string, _a: string, patch: { notes: string | null }) => appointment({ notes: patch.notes }));
    render(<AppointmentDetailPage />);
    const textarea = await screen.findByLabelText("Notas");
    await userEvent.clear(textarea);
    await userEvent.click(screen.getByRole("button", { name: "Guardar notas" }));
    await waitFor(() => expect(api.updateAppointment).toHaveBeenCalledWith("org-a", "a-1", { notes: null }));
  });

  it("reschedule: slots from the API for the SAME service; can move to another associated professional; PATCH carries only startAt/professionalId", async () => {
    api.updateAppointment.mockResolvedValue(appointment({ startAt: "2026-10-06T13:00:00.000Z", endAt: "2026-10-06T14:00:00.000Z", professionalId: "p-2" }));
    render(<AppointmentDetailPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Reagendar" }));
    await waitFor(() => expect(listProfessionalsMock).toHaveBeenCalledWith("org-a", { status: "ACTIVE", serviceId: "s-1" }));
    await screen.findByRole("option", { name: "Bruno Dias" });
    await userEvent.selectOptions(screen.getByLabelText("Profissional"), "p-2");
    fireEvent.change(screen.getByLabelText("Nova data"), { target: { value: "2026-10-06" } });
    await userEvent.click(screen.getByRole("button", { name: "Ver horários disponíveis" }));
    expect(api.getBookableSlots).toHaveBeenCalledWith("org-a", "p-2", { date: "2026-10-06", serviceId: "s-1" });
    await userEvent.click(await screen.findByRole("radio", { name: "14:00" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reagendamento" }));
    await waitFor(() => expect(api.updateAppointment).toHaveBeenCalledWith("org-a", "a-1", { startAt: "2026-10-06T13:00:00.000Z", professionalId: "p-2" }));
    expect(await screen.findByText(/2026-10-06 · 14:00–15:00/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Bruno Dias" })).toBeInTheDocument();
  });

  it("reschedule CONFLICT: explicit message, slots reloaded, appointment unchanged, no automatic retry", async () => {
    api.updateAppointment.mockRejectedValue(new ApiError(409, "APPOINTMENT_CONFLICT", "raw", null));
    render(<AppointmentDetailPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Reagendar" }));
    await userEvent.click(screen.getByRole("button", { name: "Ver horários disponíveis" }));
    await userEvent.click(await screen.findByRole("radio", { name: "14:00" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar reagendamento" }));
    expect(await screen.findByText(/a marcação não foi alterada/)).toBeInTheDocument();
    await waitFor(() => expect(api.getBookableSlots).toHaveBeenCalledTimes(2));
    expect(api.updateAppointment).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/2026-10-05 · 09:00–10:00/)).toBeInTheDocument();
  });

  it("INVALID_APPOINTMENT_STATE (changed elsewhere) reloads the server state instead of keeping a stale screen", async () => {
    api.completeAppointment.mockRejectedValue(new ApiError(409, "INVALID_APPOINTMENT_STATE", "raw", null));
    render(<AppointmentDetailPage />);
    await screen.findByText("Agendada");
    api.getAppointment.mockResolvedValue(appointment({ status: "CANCELED", canceledAt: "2026-10-02T10:00:00.000Z" }));
    await userEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(await screen.findByText("Cancelada", { selector: "span" })).toBeInTheDocument();
    expect(api.getAppointment).toHaveBeenCalledTimes(2);
  });
});

describe("Appointment detail — NO_SHOW (F28B, ADR-048)", () => {
  it("'Marcar como falta' is offered for a SCHEDULED appointment to a role with appointments.update", async () => {
    render(<AppointmentDetailPage />);
    expect(await screen.findByRole("button", { name: "Marcar como falta" })).toBeInTheDocument();
  });

  it("success: sends the request with no body, re-renders from the server response — Falta badge, timestamp, still occupied, no further actions", async () => {
    api.markNoShow.mockResolvedValue(appointment({ status: "NO_SHOW", noShowAt: "2026-10-05T08:20:00.000Z" }));
    render(<AppointmentDetailPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Marcar como falta" }));
    await waitFor(() => expect(api.markNoShow).toHaveBeenCalledWith("org-a", "a-1"));
    expect(await screen.findByText("Falta", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/2026-10-05 09:20 — o cliente não compareceu; o horário continua ocupado/)).toBeInTheDocument();
    for (const name of ["Marcar como falta", "Concluir", "Reagendar", "Cancelar marcação", "Guardar notas"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("too early (server decides): explained in pt-PT, and the appointment is reloaded from the server", async () => {
    api.markNoShow.mockRejectedValue(new ApiError(409, "APPOINTMENT_NO_SHOW_TOO_EARLY", "raw", "req-7"));
    render(<AppointmentDetailPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Marcar como falta" }));
    expect(await screen.findByText(/a falta só pode ser registada a partir da hora de início/)).toBeInTheDocument();
    expect(screen.getByText("Referência: req-7")).toBeInTheDocument();
    await waitFor(() => expect(api.getAppointment).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Agendada")).toBeInTheDocument();
  });

  it("permission: STAFF never sees the action", async () => {
    asRole("STAFF");
    render(<AppointmentDetailPage />);
    await screen.findByText("Agendada");
    expect(screen.queryByRole("button", { name: "Marcar como falta" })).not.toBeInTheDocument();
  });

  it("a 403 from the server (UI bypassed / role changed) is explained, nothing changes", async () => {
    api.markNoShow.mockRejectedValue(new ApiError(403, "FORBIDDEN", "Missing permission: appointments.update", null));
    render(<AppointmentDetailPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Marcar como falta" }));
    expect(await screen.findByText("Não tens permissão para esta operação.")).toBeInTheDocument();
    expect(screen.getByText("Agendada")).toBeInTheDocument();
  });

  it("terminal NO_SHOW loaded from the server: shows Falta, no mutation controls", async () => {
    api.getAppointment.mockResolvedValue(appointment({ status: "NO_SHOW", noShowAt: "2026-10-05T08:20:00.000Z" }));
    render(<AppointmentDetailPage />);
    expect(await screen.findByText("Falta", { selector: "span" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como falta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Concluir" })).not.toBeInTheDocument();
  });

  it("COMPLETED / CANCELED appointments never offer the action", async () => {
    api.getAppointment.mockResolvedValue(appointment({ status: "COMPLETED", completedAt: "2026-10-05T09:00:00.000Z" }));
    const { unmount } = render(<AppointmentDetailPage />);
    await screen.findByText("Concluída", { selector: "span" });
    expect(screen.queryByRole("button", { name: "Marcar como falta" })).not.toBeInTheDocument();
    unmount();
    api.getAppointment.mockResolvedValue(appointment({ status: "CANCELED", canceledAt: "2026-10-02T10:00:00.000Z" }));
    render(<AppointmentDetailPage />);
    await screen.findByText("Cancelada", { selector: "span" });
    expect(screen.queryByRole("button", { name: "Marcar como falta" })).not.toBeInTheDocument();
  });
});
