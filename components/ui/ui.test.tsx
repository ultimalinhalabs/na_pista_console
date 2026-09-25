import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../lib/api/errors";
import { Button } from "./Button";
import { CopyButton, DataTable } from "./Data";
import { ErrorNotice, ModuleUnavailable, ResultLimitNotice } from "./Feedback";
import { Field } from "./Form";
import { Dropdown } from "./Menu";
import { ConfirmDialog, Modal } from "./Overlay";
import { Tabs } from "./Tabs";
import { ToastProvider, useToast } from "./Toast";

describe("Button", () => {
  it("loading disables the button, sets aria-busy and blocks double submit", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Guardar
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Guardar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Field", () => {
  it("wires label, hint and error to the control (aria-describedby / aria-invalid)", () => {
    render(
      <Field label="Nome" hint="Como aparece nas listas" error="O nome é obrigatório">
        <input className="input" />
      </Field>,
    );
    const input = screen.getByLabelText("Nome");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toMatch(/hint/);
    expect(input.getAttribute("aria-describedby")).toMatch(/error/);
    expect(screen.getByRole("alert")).toHaveTextContent("O nome é obrigatório");
  });
});

describe("ErrorNotice", () => {
  it("shows the contextual message, the server's safe detail and the request reference", () => {
    render(<ErrorNotice error={new ApiError(409, "CONFLICT", "Cannot remove the organization's last active owner", "req-42")} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/conflito com o estado actual/);
    expect(screen.getByText("Cannot remove the organization's last active owner")).toBeInTheDocument();
    expect(screen.getByText("Referência: req-42")).toBeInTheDocument();
  });

  it("session expired offers a way back to login", () => {
    render(<ErrorNotice error={new ApiError(401, "UNAUTHORIZED", "Authentication required", null)} />);
    expect(screen.getByRole("link", { name: "Entrar novamente" })).toHaveAttribute("href", "/login");
    expect(screen.queryByText("Authentication required")).not.toBeInTheDocument();
  });
});

describe("ModuleUnavailable / ResultLimitNotice", () => {
  it("entitlement denial is a clear non-functional state", () => {
    render(<ModuleUnavailable moduleName="Pedidos" />);
    expect(screen.getByText("Módulo indisponível")).toBeInTheDocument();
    expect(screen.getByText(/módulo de Pedidos activo/)).toBeInTheDocument();
  });
  it("only says the list may be incomplete when a page is full", () => {
    const { rerender } = render(<ResultLimitNotice count={99} limit={100} />);
    expect(screen.queryByText(/primeiros 100/)).not.toBeInTheDocument();
    rerender(<ResultLimitNotice count={100} limit={100} />);
    expect(screen.getByText(/primeiros 100 resultados/)).toBeInTheDocument();
  });
});

describe("DataTable", () => {
  const columns = [{ key: "name", header: "Nome", cell: (r: { id: string; name: string }) => r.name }];
  it("loading skeleton announces loading", () => {
    render(<DataTable columns={columns} rows={null} rowKey={(r) => r.id} />);
    expect(screen.getByText("A carregar…")).toBeInTheDocument();
  });
  it("empty state", () => {
    render(<DataTable columns={columns} rows={[]} rowKey={(r) => r.id} empty={{ title: "Nada aqui." }} />);
    expect(screen.getByText("Nada aqui.")).toBeInTheDocument();
  });
  it("rows with scoped headers inside a scroll container", () => {
    const { container } = render(<DataTable columns={columns} rows={[{ id: "1", name: "Ana" }]} rowKey={(r) => r.id} />);
    expect(screen.getByRole("columnheader", { name: "Nome" })).toHaveAttribute("scope", "col");
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(container.querySelector(".table-wrap")).not.toBeNull();
  });
});

describe("Modal & ConfirmDialog", () => {
  it("Modal is a labelled dialog, focuses its first control and closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Novo cliente">
        <input aria-label="Nome" />
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Novo cliente" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("ConfirmDialog runs the action, closes on success", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ConfirmDialog open onClose={onClose} title="Arquivar?" description="d" confirmLabel="Arquivar" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Arquivar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("ConfirmDialog keeps the dialog open and explains a failure", async () => {
    const onClose = vi.fn();
    render(<ConfirmDialog open onClose={onClose} title="Revogar?" description="d" confirmLabel="Revogar" onConfirm={() => Promise.reject(new ApiError(409, "CONFLICT", "API key is already revoked", null))} />);
    await userEvent.click(screen.getByRole("button", { name: "Revogar" }));
    expect(await screen.findByText("API key is already revoked")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Dropdown / Tabs / Toast / CopyButton", () => {
  it("Dropdown opens as a menu, focuses the first item and closes with Escape", async () => {
    render(
      <Dropdown label="Conta" trigger="Conta">
        <button role="menuitem" className="dropdown-item">
          Terminar sessão
        </button>
      </Dropdown>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Conta" }));
    expect(screen.getByRole("menuitem", { name: "Terminar sessão" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("Tabs switch with arrow keys", async () => {
    function Harness() {
      const [value, setValue] = useState<"a" | "b">("a");
      return <Tabs label="Secções" value={value} onChange={setValue} tabs={[{ id: "a", label: "A" }, { id: "b", label: "B" }]} />;
    }
    render(<Harness />);
    screen.getByRole("tab", { name: "A" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "B" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "B" })).toHaveFocus();
  });

  it("Toast shows transient feedback in a live region", async () => {
    function Trigger() {
      const toast = useToast();
      return <button onClick={() => toast.success("Produto criado.")}>go</button>;
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "go" }));
    expect(screen.getByRole("status")).toHaveTextContent("Produto criado.");
  });

  it("CopyButton copies and confirms", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CopyButton value="ulk_abc.secret" />);
    await act(async () => {
      screen.getByRole("button", { name: "Copiar" }).click();
    });
    expect(writeText).toHaveBeenCalledWith("ulk_abc.secret");
    expect(await screen.findByRole("button", { name: "Copiado" })).toBeInTheDocument();
  });
});
