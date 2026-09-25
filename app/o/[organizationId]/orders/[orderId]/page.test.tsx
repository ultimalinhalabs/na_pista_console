import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrderDetailPage from "./page";
import { ApiError } from "../../../../../lib/api/errors";

/** F29 Phase 5: order lifecycle actions are confirmed, explained, and re-rendered from the server's answer. */
vi.mock("next/navigation", () => ({ useParams: () => ({ organizationId: "org-a", orderId: "0rder-1111" }) }));

const api = vi.hoisted(() => ({
  getOrder: vi.fn(),
  confirmOrder: vi.fn(),
  cancelOrder: vi.fn(),
  completeOrder: vi.fn(),
  addOrderItem: vi.fn(),
  removeOrderItem: vi.fn(),
  updateOrderCustomer: vi.fn(),
  updateOrderItemQuantity: vi.fn(),
}));
vi.mock("../../../../../lib/api/orders", () => api);
vi.mock("../../../../../lib/api/customers", () => ({ listCustomers: vi.fn().mockResolvedValue([]), getCustomer: vi.fn() }));
vi.mock("../../../../../lib/api/products", () => ({ listProducts: vi.fn().mockResolvedValue([]) }));
vi.mock("../../../../../lib/api/organizationSettings", () => ({ getOrganizationSettings: vi.fn().mockResolvedValue({ timezone: "Africa/Luanda" }) }));

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
vi.mock("../../../../../lib/session/SessionContext", () => ({ useSession: useSessionMock }));
const asRole = (roleKey: string) => useSessionMock.mockReturnValue({ identity: { userId: "u-1", memberships: [{ organizationId: "org-a", roleKey, status: "active" }] } });

const item = { id: "it-1", organizationId: "org-a", orderId: "0rder-1111", productId: "p-1", productName: "Gel fixador", quantity: "2.000", unitPrice: "1250.00", subtotal: "2500.00", createdAt: "", updatedAt: "" };
const draft = { id: "0rder-1111", organizationId: "org-a", customerId: null, status: "DRAFT", currency: "AOA", subtotal: "2500.00", total: "2500.00", items: [item], createdAt: "2026-09-25T09:00:00.000Z", updatedAt: "2026-09-25T09:00:00.000Z" };

beforeEach(() => {
  vi.clearAllMocks();
  asRole("OWNER");
  api.getOrder.mockResolvedValue(draft);
});

describe("Order detail", () => {
  it("confirming asks first (explains stock consumption) and shows the server's new state", async () => {
    api.confirmOrder.mockResolvedValue({ ...draft, status: "CONFIRMED" });
    render(<OrderDetailPage />);
    expect(await screen.findByText(/^Total 2\s500,00\sKz$/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar pedido" }));
    const dialog = screen.getByRole("dialog", { name: "Confirmar pedido?" });
    expect(dialog).toHaveTextContent(/stock de cada artigo é descontado/);
    expect(api.confirmOrder).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar pedido" }));
    await waitFor(() => expect(api.confirmOrder).toHaveBeenCalledWith("org-a", "0rder-1111"));
    expect(await screen.findByRole("button", { name: "Cancelar (repõe stock)" })).toBeInTheDocument();
  });

  it("insufficient stock is explained inside the dialog; the order stays a draft", async () => {
    api.confirmOrder.mockRejectedValue(new ApiError(409, "INSUFFICIENT_STOCK", "Insufficient stock for product p-1", "req-3"));
    render(<OrderDetailPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Confirmar pedido" }));
    const dialog = screen.getByRole("dialog", { name: "Confirmar pedido?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar pedido" }));
    expect(await within(dialog).findByText("Stock insuficiente para esta operação.")).toBeInTheDocument();
    expect(within(dialog).getByText("Referência: req-3")).toBeInTheDocument();
  });

  it("STAFF sees the order and its snapshot items but no lifecycle actions or item editing", async () => {
    asRole("STAFF");
    render(<OrderDetailPage />);
    expect(await screen.findByText("Gel fixador")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar pedido" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Quantidade de Gel fixador")).not.toBeInTheDocument();
  });

  it("an order that does not exist (or belongs to another organization) is a clear not-found state", async () => {
    api.getOrder.mockRejectedValue(new ApiError(404, "NOT_FOUND", "Order not found", null));
    render(<OrderDetailPage />);
    expect(await screen.findByText(/Pedido não encontrado/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pedidos/ })).toHaveAttribute("href", "/o/org-a/orders");
  });
});
