import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewAppointmentPage from "./page";
import { ApiError } from "../../../../../lib/api/errors";
import type { BookableSlots } from "../../../../../lib/api/types";

/** F27 brief §48/§49/§58: guided create flow, slots only from the bookable-slots API, no-slots state, explicit conflict handling (no silent retry), permission and timezone states. */
const { pushMock, searchParamsMock } = vi.hoisted(() => ({ pushMock: vi.fn(), searchParamsMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ organizationId: "org-a" }),
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParamsMock(),
}));

const { createAppointmentMock, getBookableSlotsMock } = vi.hoisted(() => ({ createAppointmentMock: vi.fn(), getBookableSlotsMock: vi.fn() }));
vi.mock("../../../../../lib/api/appointments", () => ({ createAppointment: createAppointmentMock, getBookableSlots: getBookableSlotsMock }));

const { listCustomersMock, getCustomerMock } = vi.hoisted(() => ({ listCustomersMock: vi.fn(), getCustomerMock: vi.fn() }));
vi.mock("../../../../../lib/api/customers", () => ({ listCustomers: listCustomersMock, getCustomer: getCustomerMock }));

const { listProfessionalsMock, listServicesForProfessionalMock } = vi.hoisted(() => ({ listProfessionalsMock: vi.fn(), listServicesForProfessionalMock: vi.fn() }));
vi.mock("../../../../../lib/api/professionals", () => ({ listProfessionals: listProfessionalsMock, listServicesForProfessional: listServicesForProfessionalMock }));

const { getOrganizationSettingsMock } = vi.hoisted(() => ({ getOrganizationSettingsMock: vi.fn() }));
vi.mock("../../../../../lib/api/organizationSettings", () => ({ getOrganizationSettings: getOrganizationSettingsMock }));

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
vi.mock("../../../../../lib/session/SessionContext", () => ({ useSession: useSessionMock }));

function slots(times: string[]): BookableSlots {
  return {
    timezone: "Africa/Luanda",
    date: "2026-10-05",
    serviceId: "s-1",
    durationMinutes: 60,
    slots: times.map((t) => {
      const hour = Number(t.slice(0, 2)) - 1;
      const iso = `2026-10-05T${String(hour).padStart(2, "0")}:${t.slice(3)}:00.000Z`;
      return { localStartTime: t, startAt: iso, endAt: iso };
    }),
  };
}

function asRole(roleKey: string) {
  useSessionMock.mockReturnValue({ identity: { memberships: [{ organizationId: "org-a", roleKey, status: "active" }] } });
}

beforeEach(() => {
  vi.clearAllMocks();
  asRole("MANAGER");
  searchParamsMock.mockReturnValue(new URLSearchParams());
  getOrganizationSettingsMock.mockResolvedValue({ organizationId: "org-a", timezone: "Africa/Luanda", createdAt: "", updatedAt: "" });
  listCustomersMock.mockResolvedValue([{ id: "c-1", name: "João Silva", phone: null, status: "ACTIVE" }]);
  listProfessionalsMock.mockResolvedValue([{ id: "p-1", name: "Ana Costa", status: "ACTIVE" }]);
  listServicesForProfessionalMock.mockResolvedValue([
    { id: "s-1", name: "Personal Training", durationMinutes: 60, price: "10000.00", status: "ACTIVE", associatedAt: "" },
    { id: "s-old", name: "Arquivado", durationMinutes: 30, price: null, status: "ARCHIVED", associatedAt: "" },
  ]);
  getBookableSlotsMock.mockResolvedValue(slots(["09:00", "10:00"]));
});

async function fillUpToSlots() {
  render(<NewAppointmentPage />);
  await screen.findByRole("option", { name: "João Silva" });
  await userEvent.selectOptions(screen.getByLabelText("1. Cliente"), "c-1");
  await userEvent.selectOptions(screen.getByLabelText("2. Profissional"), "p-1");
  await screen.findByRole("option", { name: /Personal Training/ });
  await userEvent.selectOptions(screen.getByLabelText("3. Serviço"), "s-1");
  fireEvent.change(screen.getByLabelText("4. Data"), { target: { value: "2026-10-05" } });
  await userEvent.click(screen.getByRole("button", { name: "Ver horários disponíveis" }));
}

describe("New appointment flow", () => {
  it("only ACTIVE associated services are offered", async () => {
    render(<NewAppointmentPage />);
    await screen.findByRole("option", { name: "Ana Costa" });
    await userEvent.selectOptions(screen.getByLabelText("2. Profissional"), "p-1");
    await screen.findByRole("option", { name: /Personal Training/ });
    expect(screen.queryByRole("option", { name: /Arquivado/ })).not.toBeInTheDocument();
  });

  it("slots come from the bookable-slots API; selecting one shows a review; confirming sends that exact slot instant", async () => {
    createAppointmentMock.mockResolvedValue({ id: "a-new" });
    await fillUpToSlots();
    expect(getBookableSlotsMock).toHaveBeenCalledWith("org-a", "p-1", { date: "2026-10-05", serviceId: "s-1" });
    await userEvent.click(await screen.findByRole("radio", { name: "10:00" }));
    expect(screen.getByLabelText("Revisão")).toHaveTextContent("João Silva");
    expect(screen.getByLabelText("Revisão")).toHaveTextContent("2026-10-05 às 10:00 (Africa/Luanda)");
    await userEvent.type(screen.getByLabelText("Notas (opcional)"), "Primeira sessão");
    await userEvent.click(screen.getByRole("button", { name: "7. Confirmar marcação" }));
    await waitFor(() =>
      expect(createAppointmentMock).toHaveBeenCalledWith("org-a", {
        customerId: "c-1",
        professionalId: "p-1",
        serviceId: "s-1",
        startAt: "2026-10-05T09:00:00.000Z",
        notes: "Primeira sessão",
      }),
    );
    expect(pushMock).toHaveBeenCalledWith("/o/org-a/appointments/a-new");
  });

  it("confirm is disabled until a slot is selected", async () => {
    await fillUpToSlots();
    await screen.findByRole("radio", { name: "09:00" });
    expect(screen.getByRole("button", { name: "7. Confirmar marcação" })).toBeDisabled();
  });

  it("no bookable slots: explicit empty state", async () => {
    getBookableSlotsMock.mockResolvedValue(slots([]));
    await fillUpToSlots();
    expect(await screen.findByText("Sem horários disponíveis nesta data para este serviço.")).toBeInTheDocument();
  });

  it("CONFLICT: another user booked first -> clear conflict message, slots reloaded, NO automatic retry", async () => {
    createAppointmentMock.mockRejectedValue(new ApiError(409, "APPOINTMENT_CONFLICT", "raw", "req-9"));
    await fillUpToSlots();
    await userEvent.click(await screen.findByRole("radio", { name: "09:00" }));
    getBookableSlotsMock.mockResolvedValue(slots(["10:00"]));
    await userEvent.click(screen.getByRole("button", { name: "7. Confirmar marcação" }));

    expect(await screen.findByText(/outra marcação ocupou este horário primeiro/)).toBeInTheDocument();
    await waitFor(() => expect(getBookableSlotsMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("radio", { name: "10:00" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "09:00" })).not.toBeInTheDocument();
    expect(createAppointmentMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "7. Confirmar marcação" })).toBeDisabled();
  });

  it("outside availability / archived errors are explained in pt-PT", async () => {
    createAppointmentMock.mockRejectedValue(new ApiError(409, "PROFESSIONAL_ARCHIVED", "raw", null));
    await fillUpToSlots();
    await userEvent.click(await screen.findByRole("radio", { name: "09:00" }));
    await userEvent.click(screen.getByRole("button", { name: "7. Confirmar marcação" }));
    expect(await screen.findByText(/profissional está arquivado/)).toBeInTheDocument();
  });

  it("changing the date after loading slots discards them (never books a stale selection)", async () => {
    await fillUpToSlots();
    await screen.findByRole("radio", { name: "09:00" });
    fireEvent.change(screen.getByLabelText("4. Data"), { target: { value: "2026-10-06" } });
    await waitFor(() => expect(screen.queryByRole("radio", { name: "09:00" })).not.toBeInTheDocument());
  });

  it("prefill from the Professional/Customer pages (?professionalId=&customerId=)", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams({ professionalId: "p-1", customerId: "c-1" }));
    render(<NewAppointmentPage />);
    await screen.findByRole("option", { name: /Personal Training/ });
    expect(screen.getByLabelText("2. Profissional")).toHaveValue("p-1");
    expect(screen.getByLabelText("1. Cliente")).toHaveValue("c-1");
  });

  it("STAFF (read-only) cannot use the flow", async () => {
    asRole("STAFF");
    render(<NewAppointmentPage />);
    expect(await screen.findByText("Não tens permissão para criar marcações.")).toBeInTheDocument();
  });

  it("timezone not configured blocks the flow with a link to Definições", async () => {
    getOrganizationSettingsMock.mockResolvedValue(null);
    render(<NewAppointmentPage />);
    expect(await screen.findByText(/ainda não configurou um fuso horário/)).toBeInTheDocument();
  });

  it("TIMEZONE_NOT_CONFIGURED from the slots API is explained, not shown raw", async () => {
    getBookableSlotsMock.mockRejectedValue(new ApiError(409, "TIMEZONE_NOT_CONFIGURED", "raw text", null));
    await fillUpToSlots();
    expect(await screen.findByText(/configura-o em Definições antes de gerir marcações/)).toBeInTheDocument();
  });
});
