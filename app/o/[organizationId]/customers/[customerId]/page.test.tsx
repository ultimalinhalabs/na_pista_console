import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerDetailPage from "./page";

/** F27 brief §52/§58: the Customer page shows that customer's appointments (bounded window) and an entry into the shared create flow — only for ACTIVE customers and roles with appointments.create. */
vi.mock("next/navigation", () => ({
  useParams: () => ({ organizationId: "org-a", customerId: "c-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

const { getCustomerMock } = vi.hoisted(() => ({ getCustomerMock: vi.fn() }));
vi.mock("../../../../../lib/api/customers", () => ({ getCustomer: getCustomerMock, updateCustomer: vi.fn(), archiveCustomer: vi.fn() }));

const { listAppointmentsMock } = vi.hoisted(() => ({ listAppointmentsMock: vi.fn() }));
vi.mock("../../../../../lib/api/appointments", () => ({ listAppointments: listAppointmentsMock }));

const { getOrganizationSettingsMock } = vi.hoisted(() => ({ getOrganizationSettingsMock: vi.fn() }));
vi.mock("../../../../../lib/api/organizationSettings", () => ({ getOrganizationSettings: getOrganizationSettingsMock }));

vi.mock("../../../../../lib/api/professionals", () => ({ listProfessionals: vi.fn().mockResolvedValue([{ id: "p-1", name: "Ana Costa" }]) }));
// F29: the page also lists the customer's recent orders (its own data source).
vi.mock("../../../../../lib/api/orders", () => ({ listOrders: vi.fn().mockResolvedValue([]) }));

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
vi.mock("../../../../../lib/session/SessionContext", () => ({ useSession: useSessionMock }));

function asRole(roleKey: string) {
  useSessionMock.mockReturnValue({ identity: { memberships: [{ organizationId: "org-a", roleKey, status: "active" }] } });
}

function customer(status: "ACTIVE" | "ARCHIVED" = "ACTIVE") {
  return { id: "c-1", organizationId: "org-a", name: "João Silva", email: null, phone: null, notes: null, status, createdAt: "", updatedAt: "" };
}

beforeEach(() => {
  vi.clearAllMocks();
  asRole("MANAGER");
  getCustomerMock.mockResolvedValue(customer());
  getOrganizationSettingsMock.mockResolvedValue({ organizationId: "org-a", timezone: "Africa/Luanda", createdAt: "", updatedAt: "" });
  listAppointmentsMock.mockResolvedValue([
    {
      id: "a-1",
      customerId: "c-1",
      professionalId: "p-1",
      serviceId: "s-1",
      startAt: "2026-10-05T08:00:00.000Z",
      endAt: "2026-10-05T09:00:00.000Z",
      durationMinutes: 60,
      status: "COMPLETED",
      serviceName: "Personal Training",
    },
  ]);
});

describe("Customer detail — Marcações", () => {
  it("lists this customer's appointments (customerId filter) with date, time, professional and status", async () => {
    render(<CustomerDetailPage />);
    expect(await screen.findByRole("region", { name: "Marcações" })).toBeInTheDocument();
    await waitFor(() => expect(listAppointmentsMock).toHaveBeenCalledWith("org-a", expect.objectContaining({ customerId: "c-1" })));
    expect(await screen.findByText("2026-10-05")).toBeInTheDocument();
    expect(screen.getByText("09:00–10:00")).toBeInTheDocument();
    expect(await screen.findByText("Ana Costa")).toBeInTheDocument();
    expect(screen.getByText("Concluída")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nova marcação" })).toHaveAttribute("href", "/o/org-a/appointments/new?customerId=c-1");
  });

  it("an ARCHIVED customer keeps its history visible but offers no 'Nova marcação'", async () => {
    getCustomerMock.mockResolvedValue(customer("ARCHIVED"));
    render(<CustomerDetailPage />);
    expect(await screen.findByText("Personal Training", { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nova marcação" })).not.toBeInTheDocument();
  });

  it("STAFF sees the history, not the create entry", async () => {
    asRole("STAFF");
    render(<CustomerDetailPage />);
    expect(await screen.findByText("Personal Training", { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nova marcação" })).not.toBeInTheDocument();
  });
});
