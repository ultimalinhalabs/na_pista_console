import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell, environmentLabel } from "./AppShell";
import { buildCommands } from "./CommandMenu";
import { notifySessionExpired } from "../../lib/api/errors";
import type { PlatformIdentity } from "../../lib/api/platformClient";

const { pushMock, replaceMock, pathnameMock } = vi.hoisted(() => ({ pushMock: vi.fn(), replaceMock: vi.fn(), pathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => pathnameMock(),
}));

function identity(roleKey: "OWNER" | "ADMIN" | "MANAGER" | "STAFF" = "OWNER"): PlatformIdentity {
  return {
    userId: "u-1",
    email: "ana@barbearia.ao",
    memberships: [
      { membershipId: "m-1", organizationId: "org-a", organizationName: "Barbearia Central", roleKey, status: "active" },
      { membershipId: "m-2", organizationId: "org-b", organizationName: "Loja do Bairro", roleKey: "STAFF", status: "active" },
    ],
  };
}

function renderShell(roleKey: "OWNER" | "ADMIN" | "MANAGER" | "STAFF" = "OWNER", onSignOut = vi.fn().mockResolvedValue(undefined)) {
  const id = identity(roleKey);
  render(
    <AppShell organizationId="org-a" identity={id} membership={id.memberships[0]!} onSignOut={onSignOut}>
      <p>conteúdo</p>
    </AppShell>,
  );
  return { onSignOut };
}

beforeEach(() => {
  vi.clearAllMocks();
  pathnameMock.mockReturnValue("/o/org-a/products/123");
});

describe("AppShell", () => {
  it("renders the grouped sidebar with the current section marked (aria-current)", () => {
    renderShell();
    const nav = screen.getAllByRole("navigation", { name: "Navegação principal" })[0]!;
    expect(within(nav).getByText("Operação")).toBeInTheDocument();
    expect(within(nav).getByText("Integrações")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Produtos" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Visão geral" })).toHaveAttribute("href", "/o/org-a");
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("STAFF does not see Credentials/Webhooks links (UX only — the Platform still enforces it)", () => {
    renderShell("STAFF");
    const nav = screen.getAllByRole("navigation", { name: "Navegação principal" })[0]!;
    expect(within(nav).queryByRole("link", { name: "Credenciais" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Webhooks" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Marcações" })).toBeInTheDocument();
  });

  it("organization switcher lists the user's other organizations and navigates to that organization's overview", async () => {
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: "Mudar de organização" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Loja do Bairro/ }));
    expect(pushMock).toHaveBeenCalledWith("/o/org-b");
  });

  it("user menu shows who is signed in and signs out", async () => {
    const { onSignOut } = renderShell();
    await userEvent.click(screen.getByRole("button", { name: "Menu do utilizador" }));
    expect(screen.getByText("Sessão iniciada como ana@barbearia.ao")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Terminar sessão" }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it("mobile: the menu button opens the navigation drawer", async () => {
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: "Abrir navegação" }));
    expect(screen.getByRole("dialog", { name: "Navegação" })).toBeInTheDocument();
  });

  it("session expiry from any API call signs out and redirects to /login?expired=1", async () => {
    const { onSignOut } = renderShell();
    act(() => notifySessionExpired());
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/login?expired=1"));
    expect(onSignOut).toHaveBeenCalled();
  });
});

describe("Command menu", () => {
  it("Ctrl+K opens it; typing filters (accent-insensitive); Enter navigates", async () => {
    renderShell();
    await userEvent.keyboard("{Control>}k{/Control}");
    const input = screen.getByRole("combobox", { name: "Procurar páginas e acções" });
    await userEvent.type(input, "marcacoes");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Marcações");
    await userEvent.keyboard("{Enter}");
    expect(pushMock).toHaveBeenCalledWith("/o/org-a/appointments");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("Escape closes; empty result is explained", async () => {
    renderShell();
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu de comandos" }));
    await userEvent.type(screen.getByRole("combobox"), "zzzz");
    expect(screen.getByText(/Nenhum resultado/)).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Menu de comandos" })).not.toBeInTheDocument();
  });

  it("create shortcuts follow permissions: STAFF gets no 'Nova marcação' / 'Novo produto'", () => {
    const staff = buildCommands("org-a", "STAFF").map((c) => c.label);
    const owner = buildCommands("org-a", "OWNER").map((c) => c.label);
    expect(owner).toEqual(expect.arrayContaining(["Nova marcação", "Novo produto", "Novo pedido", "Novo cliente"]));
    expect(staff).not.toContain("Nova marcação");
    expect(staff).not.toContain("Novo produto");
    expect(staff).toContain("Catálogo › Produtos");
  });
});

describe("environment indicator", () => {
  it("is derived from the API URL, never assumed", () => {
    expect(environmentLabel("http://127.0.0.1:4200/v1")).toBe("Local");
    expect(environmentLabel("https://staging.na-pista.example/v1")).toBe("Staging");
    expect(environmentLabel("https://api.na-pista.ao/v1")).toBeNull();
    expect(environmentLabel("not a url")).toBeNull();
  });
});
