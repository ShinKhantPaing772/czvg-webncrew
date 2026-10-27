import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  syncAndBackfillAwards: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({
  requirePermission: mocks.authorize,
}));

vi.mock("@/lib/awards/sync", () => ({
  syncAndBackfillAwards: mocks.syncAndBackfillAwards,
}));

import { POST } from "./route";

beforeEach(() => {
  mocks.authorize.mockReset();
  mocks.syncAndBackfillAwards.mockReset();
});

describe("POST /api/admin/pilot-awards/backfill", () => {
  it("rejects unauthorized users", async () => {
    mocks.authorize.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
      }),
    });

    const res = await POST(
      new Request("http://localhost/api/admin/pilot-awards/backfill", {
        method: "POST",
      }),
    );

    expect(res.status).toBe(403);
    expect(mocks.syncAndBackfillAwards).not.toHaveBeenCalled();
  });

  it("successfully triggers sync and backfill when authorized", async () => {
    mocks.authorize.mockResolvedValue({
      ok: true,
      user: { id: 1, role: "admin" },
    });
    mocks.syncAndBackfillAwards.mockResolvedValue({
      sync: { createdCount: 2, updatedCount: 100, totalCatalog: 102 },
      backfill: { pilotsChecked: 10, affectedPilots: 4, totalNewGrants: 12 },
    });

    const res = await POST(
      new Request("http://localhost/api/admin/pilot-awards/backfill", {
        method: "POST",
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain("102");
    expect(data.sync.totalCatalog).toBe(102);
    expect(data.backfill.totalNewGrants).toBe(12);
  });
});
