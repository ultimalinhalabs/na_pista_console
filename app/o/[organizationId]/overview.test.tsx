import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OverviewPage from "./page";
import TeamPage from "./settings/team/page";
import PermissionsPage from "./settings/permissions/page";
import { ApiError } from "../../../lib/api/errors";

/** F29 Overview (Phase 4) and Settings › Team / Permissions (Phase 11). */
vi.mock("next/navigation", () => ({ useParams: () => ({ organizationId: "org-a" }) }));

const api = vi.hoisted(() => ({
  listAppointments: vi.fn(),
  countCustomers: vi.fn(),
  getCustomer: vi.fn(),
  listInventoryPage: vi.fn(),
  listOrders: vi.fn(),
  countOrders: vi.fn(),
  listProfessionals: vi.fn(),
  getOrganizationSettings: vi.fn(),
  listMembers: vi.fn(),
  updateMember: vi.fn(),
  removeMember: vi.fn(),
}));
vi.mock("../../../lib/api/appointments", () => ({ listAppointments: api.listAppointments }));
vi.mock("../../../lib/api/customers", () => ({ countCustomers: api.countCustomers, getCustomer: api.getCustomer }));
vi.mock("../../../lib/api/inventory", () => ({ listInventoryPage: api.listInventoryPage }));
vi.mock("../../../lib/api/orders", () => ({ listOrders: api.listOrders, countOrders: api.countOrders }));
vi.mock("../../../lib/api/professionals", () => ({ listProfessionals: api.listProfessionals }));
vi.mock("../../../lib/api/organizationSettings", () => ({ getOrganizationSettings: api.getOrganizationSettings }));
vi.mock("../../../lib/api/platform", () => ({ listMembers: api.listMembers, updateMember: api.updateMember, removeMember: api.removeMember }));

const { useSessionMock, refreshIdentity } = vi.hoisted(() => ({ useSessionMock: vi.fn(), refreshIdentity: vi.fn() }));
vi.mock("../../../lib/session/SessionContext", () => ({ useSession: useSessionMock }));

function asRole(roleKey: string) {
  useSessionMock.mockReturnValue({
    identity: { userId: "u-1", email: "ana@exemplo.ao", memberships: [{ membershipId: "m-1", organizationId: "org-a", organizationName: "Barbearia Central", roleKey, status: "active" }] },
    refreshIdentity,
  });
}

const order = (i: number, status = "DRAFT") => ({ id: `o-${i}`, organizationId: "org-a", customerId: null, status, currency: "AOA", subtotal: "2500.00", total: "2500.00", createdAt: "2026-09-25T09:00:00.000Z", updatedAt: "2026-09-25T09:00:00.000Z" });
const customer = (i: number) => ({ id: `c-${i}`, organizationId: "org-a", name: `Cliente ${i}`, email: null, phone: null, notes: null, status: "ACTIVE", createdAt: "", updatedAt: "" });

beforeEach(() => {
  vi.clearAllMocks();
  asRole("OWNER");
  api.getOrganizationSettings.mockResolvedValue({ organizationId: "org-a", timezone: "Africa/Luanda", createdAt: "", updatedAt: "" });
  api.listProfessionals.mockResolvedValue([{ id: "p-1", name: "Rui" }]);
  api.getCustomer.mockResolvedValue(customer(1));
  api.listAppointments.mockResolvedValue([
    { id: "a-1", organizationId: "org-a", customerId: "c-1", professionalId: "p-1", serviceId: "s-1", startAt: "2026-09-25T09:00:00.000Z", endAt: "2026-09-25T09:30:00.000Z", durationMinutes: 30, status: "SCHEDULED", serviceName: "Corte", servicePrice: "3000.00", currency: "AOA", notes: null, cancellationReason: null, canceledAt: null, completedAt: null, noShowAt: null, createdAt: "", updatedAt: "" },
    { id: "a-2", organizationId: "org-a", customerId: "c-1", professionalId: "p-1", serviceId: "s-1", startAt: "2026-09-25T10:00:00.000Z", endAt: "2026-09-25T10:30:00.000Z", durationMinutes: 30, status: "CANCELED", serviceName: "Corte", servicePrice: "3000.00", currency: "AOA", notes: null, cancellationReason: null, canceledAt: "", completedAt: null, noShowAt: null, createdAt: "", updatedAt: "" },
  ]);
  api.listOrders.mockResolvedValue([order(9, "COMPLETED")]);
  api.countOrders.mockImplementation(async (_org: string, filter: { status?: string }) => (filter.status === "DRAFT" ? 2 : filter.status === "CONFIRMED" ? 1 : 0));
  api.listInventoryPage.mockResolvedValue({
    data: [{ id: "i-1", organizationId: "org-a", productId: "pr-1", quantity: "0.000", productName: "Gel fixador", productUnit: "UNIT", productStatus: "ACTIVE", createdAt: "", updatedAt: "" }],
    pagination: { page: 1, pageSize: 5, total: 1, totalPages: 1 },
  });
  // More than the old 100-row cap: the Console now shows the exact server total (ADR-051) instead of "100+".
  api.countCustomers.mockResolvedValue(137);
});

function stat(label: string) {
  return screen.getByText(label, { selector: ".stat-label" }).closest(".stat") as HTMLElement;
}

describe("Overview", () => {
  it("shows exact counts from the APIs (pagination.total): scheduled today, open orders (draft+confirmed), zero stock, active customers", async () => {
    render(<OverviewPage />);
    await waitFor(() => expect(within(stat("Marcações hoje")).getByText("1")).toBeInTheDocument());
    expect(within(stat("Pedidos em aberto")).getByText("3")).toBeInTheDocument();
    expect(within(stat("Produtos sem stock")).getByText("1")).toBeInTheDocument();
    expect(within(stat("Clientes activos")).getByText("137")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Gel fixador" })).toHaveAttribute("href", "/o/org-a/inventory/pr-1");
    expect(screen.getByText("Concluído")).toBeInTheDocument();
    expect(api.listInventoryPage).toHaveBeenCalledWith("org-a", { zeroStock: true, pageSize: 5 });
    expect(api.countCustomers).toHaveBeenCalledWith("org-a", { status: "ACTIVE" });
    expect(api.listAppointments).toHaveBeenCalledWith("org-a", expect.objectContaining({ from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
  });

  it("a module the plan does not include degrades to 'Módulo indisponível' without breaking the other blocks", async () => {
    api.listInventoryPage.mockRejectedValue(new ApiError(403, "ENTITLEMENT_REQUIRED", "x", null));
    render(<OverviewPage />);
    expect(await screen.findByText(/módulo de Inventário activo/)).toBeInTheDocument();
    expect(within(stat("Produtos sem stock")).getByText("—")).toBeInTheDocument();
    await waitFor(() => expect(within(stat("Pedidos em aberto")).getByText("3")).toBeInTheDocument());
  });

  it("without a timezone: warning with a link to settings, no appointment request, no 'Nova marcação'", async () => {
    api.getOrganizationSettings.mockResolvedValue(null);
    render(<OverviewPage />);
    expect(await screen.findByText("Fuso horário por configurar", { selector: ".alert *" })).toBeInTheDocument();
    expect(api.listAppointments).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Nova marcação" })).not.toBeInTheDocument();
  });

  it("STAFF gets read-only blocks and no create actions", async () => {
    asRole("STAFF");
    render(<OverviewPage />);
    await waitFor(() => expect(api.countOrders).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: "Nova marcação" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Novo pedido" })).not.toBeInTheDocument();
  });
});

const members = [
  { membershipId: "m-1", userId: "u-1", userEmail: "ana@exemplo.ao", roleKey: "OWNER", status: "active", createdAt: "" },
  { membershipId: "m-2", userId: "u-2", userEmail: "rui@exemplo.ao", roleKey: "STAFF", status: "active", createdAt: "" },
];

describe("Team", () => {
  beforeEach(() => api.listMembers.mockResolvedValue(members));

  it("changing a role asks for confirmation, then applies the Platform's answer", async () => {
    api.updateMember.mockResolvedValue({ ...members[1], roleKey: "MANAGER" });
    render(<TeamPage />);
    await userEvent.selectOptions(await screen.findByLabelText("Papel de rui@exemplo.ao"), "MANAGER");
    const dialog = screen.getByRole("dialog", { name: "Alterar papel?" });
    expect(dialog).toHaveTextContent("rui@exemplo.ao passa a Gestor");
    await userEvent.click(within(dialog).getByRole("button", { name: "Alterar papel" }));
    await waitFor(() => expect(api.updateMember).toHaveBeenCalledWith("org-a", "m-2", { roleKey: "MANAGER" }));
    expect(refreshIdentity).not.toHaveBeenCalled();
  });

  it("the Platform's last-owner protection is shown inside the dialog", async () => {
    api.removeMember.mockRejectedValue(new ApiError(409, "CONFLICT", "Cannot remove the organization's last active owner", "req-7"));
    render(<TeamPage />);
    await screen.findByText("ana@exemplo.ao");
    await userEvent.click(screen.getAllByRole("button", { name: "Remover" })[0]!);
    const dialog = screen.getByRole("dialog", { name: "Remover membro?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Remover" }));
    expect(await within(dialog).findByText("Cannot remove the organization's last active owner")).toBeInTheDocument();
    expect(screen.getByText("ana@exemplo.ao")).toBeInTheDocument();
  });

  it("MANAGER reads the team but gets no controls; there is no fake 'add member' form", async () => {
    asRole("MANAGER");
    render(<TeamPage />);
    expect(await screen.findByText("rui@exemplo.ao")).toBeInTheDocument();
    expect(screen.getByText("Só leitura")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
    expect(screen.getByText(/ainda não disponibiliza convites/)).toBeInTheDocument();
  });
});

describe("Permissions", () => {
  it("shows the caller's role and both read-only matrices", () => {
    asRole("MANAGER");
    render(<PermissionsPage />);
    expect(screen.getByText("O teu papel: Gestor")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Na Pista" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "UL Platform (organização)" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("permitido").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("não permitido").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
