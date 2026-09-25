import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./page";

const { replaceMock, pushMock, signIn } = vi.hoisted(() => ({ replaceMock: vi.fn(), pushMock: vi.fn(), signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: replaceMock, push: pushMock }) }));
vi.mock("../../lib/supabase/client", () => ({ getSupabaseClient: () => ({ auth: { signInWithPassword: signIn } }) }));
vi.mock("../../lib/session/SessionContext", () => ({ useSession: () => ({ loading: false, authenticated: false, refreshIdentity: vi.fn() }) }));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/login");
});

describe("Login (F29 Phase 9)", () => {
  it("explains an expired session when redirected with ?expired=1", async () => {
    window.history.replaceState(null, "", "/login?expired=1");
    render(<LoginPage />);
    expect(await screen.findByText("Sessão expirada")).toBeInTheDocument();
  });

  it("maps provider errors to safe pt-PT messages and never echoes provider internals", async () => {
    signIn.mockResolvedValue({ error: { message: "Database error granting user: pq: relation auth.x" } });
    render(<LoginPage />);
    expect(screen.queryByText("Sessão expirada")).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Email"), "a@b.ao");
    await userEvent.type(screen.getByLabelText("Palavra-passe"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível entrar. Tenta de novo.");
    expect(document.body.textContent).not.toContain("relation");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("wrong credentials", async () => {
    signIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Email"), "a@b.ao");
    await userEvent.type(screen.getByLabelText("Palavra-passe"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email ou palavra-passe incorrectos.");
  });
});
