import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  findPirep: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  requireCrewAuth: mocks.authorize,
  hasPermission: vi.fn().mockReturnValue(false),
}));
vi.mock("@/lib/database", () => ({ default: {} }));
vi.mock("@/lib/models", () => ({
  models: {
    Pirep: { findOne: mocks.findPirep },
    Aircraft: {},
    PirepComment: {},
    Pilot: {},
  },
}));

import { GET } from "./route";

function get(pirepId: string, pilotId = "42") {
  return GET(
    new Request(`http://localhost/api/pilots/${pilotId}/pireps?pirepId=${pirepId}`),
    { params: Promise.resolve({ id: pilotId }) },
  );
}

beforeEach(() => {
  mocks.authorize.mockResolvedValue({
    ok: true,
    user: { id: 42, permissions: [] },
  });
  mocks.findPirep.mockResolvedValue(null);
});

describe("linked pilot PIREP details", () => {
  it("loads a report directly with aircraft, comments and formatted duration", async () => {
    const report = {
      id: 123,
      flightnum: "CZ123",
      flighttime: 6300,
      Aircraft: { id: 1, name: "A321", liveryname: "China Southern" },
      Comments: [{ id: 7, content: "Approved by staff" }],
    };
    mocks.findPirep.mockResolvedValue({ ...report, get: () => report });

    const response = await get("123");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      pirep: { ...report, flighttime: "01:45" },
    });
    expect(mocks.findPirep).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 123, pilotid: 42 },
      include: expect.arrayContaining([
        expect.objectContaining({ as: "Aircraft" }),
        expect.objectContaining({ as: "Comments" }),
      ]),
    }));
  });

  it("does not return another pilot's report", async () => {
    const response = await get("999");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "PIREP not found" });
    expect(mocks.findPirep).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 999, pilotid: 42 },
    }));
  });

  it("rejects another pilot's dashboard before looking up a report", async () => {
    expect((await get("123", "43")).status).toBe(403);
    expect(mocks.findPirep).not.toHaveBeenCalled();
  });

  it.each(["", "0", "bad", "1.5"])("rejects invalid report id %s", async id => {
    expect((await get(id)).status).toBe(400);
    expect(mocks.findPirep).not.toHaveBeenCalled();
  });
});
