import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrganizationSettingsPage from "./page";
import { ApiError } from "../../../../lib/api/errors";
import type { OrganizationSettings } from "../../../../lib/api/types";

/** F26 brief §32: timezone form, timezone validation (server-side, surfaced as an error), loading/empty/error, permission-aware controls, organization context. */
vi.mock("next/navigation", () => ({
  useParams: () => ({ organizationId: "org-a" }),
}));

const { getOrganizationSettingsMock, updateOrganizationSettingsMock } = vi.hoisted(() => ({
  getOrganizationSettingsMock: vi.fn(),
  updateOrganizationSettingsMock: vi.fn(),
}));
vi.mock("../../../../lib/api/organizationSettings", () => ({
  getOrganizationSettings: getOrganizationSettingsMock,
  updateOrganizationSettings: updateOrganizationSettingsMock,
}));

// F29: the page now also shows the UL Platform organization profile (its own data source).
vi.mock("../../../../lib/api/platform", () => ({
  getOrganization: vi.fn().mockResolvedValue({ id: "org-a", name: "Barbearia Central", slug: "barbearia-central", createdAt: "", updatedAt: "" }),
  updateOrganization: vi.fn(),
}));

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
vi.mock("../../../../lib/session/SessionContext", () => ({
  useSession: useSessionMock,
}));

function settings(overrides: Partial<OrganizationSettings> = {}): OrganizationSettings {
  return {
    organizationId: "org-a",
    timezone: "Africa/Luanda",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
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
});

describe("OrganizationSettingsPage — loading/organization context", () => {
  it("shows a loading state before settings resolve", async () => {
    mockSession("OWNER");
    let resolve!: (v: OrganizationSettings | null) => void;
    getOrganizationSettingsMock.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<OrganizationSettingsPage />);
    expect(screen.getByText("A carregar…")).toBeInTheDocument();
    resolve(settings());
    await waitFor(() => expect(screen.queryByText("A carregar…")).not.toBeInTheDocument());
  });

  it("requests settings scoped to the organizationId from the route params", async () => {
    mockSession("OWNER");
    getOrganizationSettingsMock.mockResolvedValue(settings());
    render(<OrganizationSettingsPage />);
    await waitFor(() => expect(getOrganizationSettingsMock).toHaveBeenCalledWith("org-a"));
  });
});

describe("OrganizationSettingsPage — unconfigured/empty state", () => {
  it("shows a hint and an empty timezone field when the organization has never configured one (null, not an error)", async () => {
    mockSession("OWNER");
    getOrganizationSettingsMock.mockResolvedValue(null);
    render(<OrganizationSettingsPage />);
    await waitFor(() => expect(screen.getByText(/Ainda não configurado/)).toBeInTheDocument());
    expect(screen.getByLabelText("Fuso horário")).toHaveValue("");
  });

  it("prefills the field when a timezone is already configured", async () => {
    mockSession("OWNER");
    getOrganizationSettingsMock.mockResolvedValue(settings({ timezone: "Europe/Lisbon" }));
    render(<OrganizationSettingsPage />);
    await waitFor(() => expect(screen.getByLabelText("Fuso horário")).toHaveValue("Europe/Lisbon"));
    expect(screen.queryByText(/Ainda não configurado/)).not.toBeInTheDocument();
  });
});

describe("OrganizationSettingsPage — save / validation / permissions", () => {
  it("OWNER can save a new timezone", async () => {
    mockSession("OWNER");
    getOrganizationSettingsMock.mockResolvedValue(null);
    updateOrganizationSettingsMock.mockResolvedValue(settings({ timezone: "Africa/Luanda" }));
    const user = userEvent.setup();
    render(<OrganizationSettingsPage />);
    await waitFor(() => expect(screen.getByLabelText("Fuso horário")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Fuso horário"), "Africa/Luanda");
    await user.click(screen.getByText("Guardar"));

    await waitFor(() => expect(updateOrganizationSettingsMock).toHaveBeenCalledWith("org-a", "Africa/Luanda"));
    await waitFor(() => expect(screen.getByText("Guardado.")).toBeInTheDocument());
  });

  it("shows the server validation error for an invalid timezone (e.g. a raw UTC offset)", async () => {
    mockSession("OWNER");
    getOrganizationSettingsMock.mockResolvedValue(null);
    updateOrganizationSettingsMock.mockRejectedValue(new ApiError(400, "VALIDATION_ERROR", "timezone must be a valid IANA timezone identifier", "req-1"));
    const user = userEvent.setup();
    render(<OrganizationSettingsPage />);
    await waitFor(() => expect(screen.getByLabelText("Fuso horário")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Fuso horário"), "+01:00");
    await user.click(screen.getByText("Guardar"));

    await waitFor(() => expect(screen.getByText(/valid IANA timezone identifier/)).toBeInTheDocument());
  });

  it("STAFF (read-only) sees the current timezone but the field is disabled and there is no Guardar button", async () => {
    mockSession("STAFF");
    getOrganizationSettingsMock.mockResolvedValue(settings({ timezone: "Africa/Luanda" }));
    render(<OrganizationSettingsPage />);
    await waitFor(() => expect(screen.getByLabelText("Fuso horário")).toHaveValue("Africa/Luanda"));
    expect(screen.getByLabelText("Fuso horário")).toBeDisabled();
    expect(screen.queryByText("Guardar")).not.toBeInTheDocument();
  });
});
