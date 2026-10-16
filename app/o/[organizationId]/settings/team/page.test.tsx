import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TeamPage from "./page";
import { ApiError } from "../../../../../lib/api/errors";
import type { OrganizationInvitation, OrganizationMember } from "../../../../../lib/api/platform";

/** ul-platform migration 0025: OWNER/ADMIN invite by email, see pending invitations and revoke them; others don't see the form. */
vi.mock("next/navigation", () => ({
  useParams: () => ({ organizationId: "org-a" }),
}));

const { listMembersMock, listInvitationsMock, createInvitationMock, revokeInvitationMock } = vi.hoisted(() => ({
  listMembersMock: vi.fn(),
  listInvitationsMock: vi.fn(),
  createInvitationMock: vi.fn(),
  revokeInvitationMock: vi.fn(),
}));
vi.mock("../../../../../lib/api/platform", () => ({
  listMembers: listMembersMock,
  updateMember: vi.fn(),
  removeMember: vi.fn(),
  listInvitations: listInvitationsMock,
  createInvitation: createInvitationMock,
  revokeInvitation: revokeInvitationMock,
}));

const { useSessionMock } = vi.hoisted(() => ({ useSessionMock: vi.fn() }));
vi.mock("../../../../../lib/session/SessionContext", () => ({
  useSession: useSessionMock,
}));

const owner: OrganizationMember = { membershipId: "m-1", userId: "u-1", userEmail: "dona@loja.ao", roleKey: "OWNER", status: "active", createdAt: "2026-01-01T00:00:00Z" };

function invitation(overrides: Partial<OrganizationInvitation> = {}): OrganizationInvitation {
  return {
    id: "inv-1",
    organizationId: "org-a",
    email: "ana@loja.ao",
    roleKey: "STAFF",
    status: "pending",
    invitedByUserId: "u-1",
    expiresAt: "2026-10-23T10:00:00Z",
    respondedAt: null,
    revokedAt: null,
    createdAt: "2026-10-16T10:00:00Z",
    ...overrides,
  };
}

function mockSession(roleKey: string) {
  useSessionMock.mockReturnValue({ identity: { userId: "u-1", memberships: [{ organizationId: "org-a", roleKey }] }, refreshIdentity: vi.fn() });
}

beforeEach(() => {
  vi.clearAllMocks();
  listMembersMock.mockResolvedValue([owner]);
  listInvitationsMock.mockResolvedValue([]);
});

describe("TeamPage — invitations", () => {
  it("no longer sends people to support to add members", async () => {
    mockSession("OWNER");
    render(<TeamPage />);
    await waitFor(() => expect(screen.getByText("dona@loja.ao")).toBeInTheDocument());
    expect(screen.queryByText(/pede ao suporte/)).not.toBeInTheDocument();
  });

  it("an OWNER invites an email with a role and the invitation appears as pending", async () => {
    mockSession("OWNER");
    createInvitationMock.mockResolvedValue(invitation({ roleKey: "MANAGER" }));
    render(<TeamPage />);
    await userEvent.type(await screen.findByLabelText("Email"), " ana@loja.ao ");
    await userEvent.selectOptions(screen.getByLabelText("Papel"), "MANAGER");
    await userEvent.click(screen.getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => expect(createInvitationMock).toHaveBeenCalledWith("org-a", { email: "ana@loja.ao", roleKey: "MANAGER" }));
    expect(await screen.findByText("ana@loja.ao")).toBeInTheDocument();
    expect(screen.getByText("Pendente")).toBeInTheDocument();
  });

  it("only an OWNER is offered the OWNER role", async () => {
    mockSession("ADMIN");
    render(<TeamPage />);
    const select = await screen.findByLabelText("Papel");
    expect(within(select).queryByRole("option", { name: "Proprietário" })).not.toBeInTheDocument();
  });

  it("explains the plan's member limit in Portuguese", async () => {
    mockSession("OWNER");
    createInvitationMock.mockRejectedValue(new ApiError(409, "LIMIT_EXCEEDED", "limit", null));
    render(<TeamPage />);
    await userEvent.type(await screen.findByLabelText("Email"), "ana@loja.ao");
    await userEvent.click(screen.getByRole("button", { name: "Enviar convite" }));
    expect(await screen.findByText("Foi atingido um limite do plano desta organização.")).toBeInTheDocument();
  });

  it("revokes a pending invitation after confirmation", async () => {
    mockSession("OWNER");
    listInvitationsMock.mockResolvedValue([invitation(), invitation({ id: "inv-2", email: "old@loja.ao", status: "expired" })]);
    revokeInvitationMock.mockResolvedValue(invitation({ status: "revoked" }));
    render(<TeamPage />);
    expect(await screen.findByText("ana@loja.ao")).toBeInTheDocument();
    expect(screen.queryByText("old@loja.ao")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Revogar o convite de ana@loja.ao" }));
    await userEvent.click(screen.getByRole("button", { name: "Revogar" }));
    await waitFor(() => expect(revokeInvitationMock).toHaveBeenCalledWith("org-a", "inv-1"));
    await waitFor(() => expect(screen.queryByText("ana@loja.ao")).not.toBeInTheDocument());
  });

  it("a MANAGER sees the team but no invitation form", async () => {
    mockSession("MANAGER");
    render(<TeamPage />);
    await waitFor(() => expect(screen.getByText("dona@loja.ao")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Enviar convite" })).not.toBeInTheDocument();
    expect(listInvitationsMock).not.toHaveBeenCalled();
  });
});
