import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findPilot: vi.fn(),
  updatePilot: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    ok: true,
    token: "token",
    user: { id: 1, email: "staff@example.com", permissions: ["users"] },
  }),
}));

vi.mock("@/lib/database", () => ({ default: {} }));

vi.mock("@/lib/email", () => ({
  discordInviteEmail: vi.fn(),
  examGradeEmail: vi.fn(),
  getApplicantPortalUrl: vi.fn(),
  getCrewCenterUrl: vi.fn(),
  pilotApprovedEmail: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/models", () => ({
  models: {
    Pilot: { findByPk: mocks.findPilot, findOne: vi.fn() },
    Application: { findOrCreate: vi.fn() },
  },
}));

import { PUT } from "./route";

function updateRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/users", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: 42, ...body }),
  });
}

describe("PUT /api/admin/users transfer hours", () => {
  beforeEach(() => {
    const values: Record<string, unknown> = { id: 42, status: 1 };
    mocks.findPilot.mockResolvedValue({
      get: (key: string) => values[key],
      update: mocks.updatePilot,
    });
    mocks.updatePilot.mockResolvedValue(undefined);
  });

  it("saves transfer hours and flights", async () => {
    const response = await PUT(updateRequest({ transhours: 120, transflights: 35 }));
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(mocks.updatePilot).toHaveBeenCalledWith({
      transhours: 120,
      transflights: 35,
    });
  });

  it.each([
    ["negative hours", { transhours: -1 }],
    ["fractional hours", { transhours: 2.5 }],
    ["text flights", { transflights: "lots" }],
    ["an absurd total", { transhours: 1_000_000 }],
  ])("rejects %s without saving", async (_case, fields) => {
    const response = await PUT(updateRequest(fields));

    expect(response.status).toBe(400);
    expect(mocks.findPilot).not.toHaveBeenCalled();
    expect(mocks.updatePilot).not.toHaveBeenCalled();
  });
});
