import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findAll: vi.fn(),
  bulkCreate: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  query: vi.fn(),
  getSafeAwards: vi.fn(),
  getAwardExistingColumnNames: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  default: {
    query: mocks.query,
  },
}));

vi.mock("@/lib/models", () => ({
  models: {
    Award: {
      count: mocks.count,
      findAll: mocks.findAll,
      bulkCreate: mocks.bulkCreate,
      create: mocks.create,
      update: mocks.update,
    },
    Pilot: {
      findAll: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("./columns", () => ({
  ensureAwardColumnsExist: vi.fn().mockResolvedValue(undefined),
  getAwardExistingColumnNames: mocks.getAwardExistingColumnNames,
  getSafeAwards: mocks.getSafeAwards,
}));

vi.mock("./evaluator", () => ({
  evaluateAndGrantAwards: vi.fn().mockResolvedValue({ grantedAwards: [] }),
}));

import { ensureAwardCatalogSeeded, syncAwardsCatalogToDatabase } from "./sync";
import { MASTER_BADGES } from "./catalog";

describe("awards catalog sync and auto-seed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAwardExistingColumnNames.mockResolvedValue(
      new Set([
        "id",
        "name",
        "name_zh",
        "description",
        "description_zh",
        "imageurl",
        "category",
        "criteria",
        "featured",
      ]),
    );
  });

  it("syncAwardsCatalogToDatabase creates missing badges in batch", async () => {
    // Database only has 1 existing award
    mocks.getSafeAwards.mockResolvedValue([
      {
        id: 1,
        name: "First Light",
        name_zh: "初光",
        description: "Complete your first verified flight with CZVG.",
        description_zh: "执飞首个经审核批准的航班，向蔚蓝长空启航。",
        imageurl: "https://example.com/badge.svg",
        category: "milestone",
        criteria: { type: "flights", threshold: 1 },
        featured: null,
      },
    ]);
    mocks.bulkCreate.mockResolvedValue([]);

    const result = await syncAwardsCatalogToDatabase();
    expect(result.totalCatalog).toBe(MASTER_BADGES.length);
    expect(result.createdCount).toBe(MASTER_BADGES.length - 1);
    expect(mocks.bulkCreate).toHaveBeenCalledTimes(1);
    const createdPayloads = mocks.bulkCreate.mock.calls[0][0];
    expect(createdPayloads.length).toBe(MASTER_BADGES.length - 1);
  });

  it("ensureAwardCatalogSeeded triggers sync when count < master catalog size", async () => {
    mocks.count.mockResolvedValue(3); // only 3 awards exist in DB
    mocks.getSafeAwards.mockResolvedValue([]);
    mocks.bulkCreate.mockResolvedValue([]);

    await ensureAwardCatalogSeeded();

    expect(mocks.count).toHaveBeenCalled();
    expect(mocks.bulkCreate).toHaveBeenCalled();
  });
});
