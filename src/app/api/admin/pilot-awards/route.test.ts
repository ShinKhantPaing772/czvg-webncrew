import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  transaction: vi.fn(),
  findPilot: vi.fn(),
  findPilots: vi.fn(),
  findAwards: vi.fn(),
  findGrants: vi.fn(),
  deleteGrants: vi.fn(),
  createGrants: vi.fn(),
}));

vi.mock("@/lib/database", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("@/lib/server-auth", () => ({ requirePermission: mocks.authorize }));
vi.mock("@/lib/models", () => ({
  models: {
    Pilot: { findByPk: mocks.findPilot, findAll: mocks.findPilots },
    Award: { findAll: mocks.findAwards },
    AwardGranted: {
      findAll: mocks.findGrants,
      destroy: mocks.deleteGrants,
      bulkCreate: mocks.createGrants,
    },
  },
}));

import { DELETE, POST, PUT } from "./route";

const transaction = { LOCK: { UPDATE: "UPDATE" } };

beforeEach(() => {
  mocks.authorize.mockReset().mockResolvedValue({ ok: true });
  mocks.transaction.mockReset().mockImplementation(async (callback) => callback(transaction));
  mocks.findPilot.mockReset().mockResolvedValue({ id: 42 });
  mocks.findPilots.mockReset().mockResolvedValue([{ id: 42 }]);
  mocks.findAwards.mockReset().mockResolvedValue([]);
  mocks.findGrants.mockReset().mockResolvedValue([{ awardid: 7 }]);
  mocks.deleteGrants.mockReset().mockResolvedValue(1);
  mocks.createGrants.mockReset().mockResolvedValue([]);
});

describe("PUT /api/admin/pilot-awards", () => {
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
});

describe("POST /api/admin/pilot-awards", () => {
  it("allows granting awards to multiple pilots simultaneously", async () => {
    mocks.findPilots.mockResolvedValue([{ id: 10 }, { id: 20 }]);
    mocks.findAwards.mockResolvedValue([{ id: 101 }]);
    mocks.findGrants.mockResolvedValue([
      { pilotid: 10, awardid: 101 }, // Pilot 10 already has it
    ]);

    const response = await POST(new Request("http://localhost/api/admin/pilot-awards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pilotIds: [10, 20], awardIds: [101] }),
    }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.createdCount).toBe(1); // Only pilot 20 needed the grant

    // Pilots locked in order
    expect(mocks.findPilot).toHaveBeenCalledWith(10, expect.anything());
    expect(mocks.findPilot).toHaveBeenCalledWith(20, expect.anything());

    // bulkCreate only created for pilot 20
    expect(mocks.createGrants).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          pilotid: 20,
          awardid: 101,
        }),
      ],
      { transaction },
    );
  });

  it("returns 400 when pilots or awards are missing in request", async () => {
    const response = await POST(new Request("http://localhost/api/admin/pilot-awards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pilotIds: [] }),
    }));
    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/admin/pilot-awards", () => {
  it("revokes an award from a pilot via query params", async () => {
    mocks.deleteGrants.mockResolvedValue(1);

    const response = await DELETE(new Request("http://localhost/api/admin/pilot-awards?awardId=101&pilotId=20", {
      method: "DELETE",
    }));

    expect(response.status).toBe(200);
    expect(mocks.deleteGrants).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.anything(),
        transaction,
      }),
    );
  });
});
