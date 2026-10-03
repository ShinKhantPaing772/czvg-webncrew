import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  transaction: vi.fn(),
  findPilot: vi.fn(),
  findAwards: vi.fn(),
  findGrants: vi.fn(),
  deleteGrants: vi.fn(),
  createGrants: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/models", () => ({
  models: {
    Pilot: { findByPk: mocks.findPilot },
    Award: { findAll: mocks.findAwards },
    AwardGranted: {
      findAll: mocks.findGrants, destroy: mocks.deleteGrants, bulkCreate: mocks.createGrants,
    },
  },
}));

import { PUT } from "./route";

const transaction = { LOCK: { UPDATE: "UPDATE" } };

beforeEach(() => {
  mocks.authorize.mockReset().mockResolvedValue({ ok: true });
  mocks.transaction.mockReset().mockImplementation(async (callback) => callback(transaction));
  mocks.findPilot.mockReset().mockResolvedValue({ id: 42 });
  mocks.findAwards.mockReset().mockResolvedValue([]);
  mocks.findGrants.mockReset().mockResolvedValue([{ awardid: 7 }]);
  mocks.deleteGrants.mockReset().mockResolvedValue(1);
  mocks.createGrants.mockReset().mockResolvedValue([]);
});

it("serializes award revocation with scheduling eligibility checks using the pilot lock", async () => {
  const response = await PUT(new Request("http://localhost/api/admin/pilot-awards", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pilotId: 42, awardIds: [] }),
  }));
  expect(response.status).toBe(200);
  expect(mocks.findPilot).toHaveBeenLastCalledWith(42, {
    attributes: ["id"], transaction, lock: "UPDATE",
  });
  expect(mocks.findPilot.mock.invocationCallOrder[1]).toBeLessThan(mocks.findGrants.mock.invocationCallOrder[0]);
  expect(mocks.findGrants.mock.invocationCallOrder[0]).toBeLessThan(mocks.deleteGrants.mock.invocationCallOrder[0]);
});
