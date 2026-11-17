import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  findAll: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  default: {
    query: mocks.query,
    transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/models", () => ({
  models: {
    Award: {
      findAll: mocks.findAll,
    },
  },
}));

vi.mock("./sync", () => ({ ensureAwardCatalogSeeded: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  mocks.query.mockReset();
  mocks.findAll.mockReset();
  mocks.transaction.mockReset();
});

describe("getSafeAwards", () => {
  it("returns full attributes when database columns are present", async () => {
    const { getSafeAwards } = await import("./columns");
    mocks.query.mockResolvedValue([
      [
        { column_name: "id" },
        { column_name: "name" },
        { column_name: "name_zh" },
        { column_name: "description" },
        { column_name: "description_zh" },
        { column_name: "imageurl" },
        { column_name: "category" },
        { column_name: "criteria" },
        { column_name: "featured" },
      ],
    ]);

    mocks.findAll.mockResolvedValue([
      {
        id: 1,
        name: "First Light",
        name_zh: "初光",
        description: "First flight",
        description_zh: "首飞",
        imageurl: "/badges/first.svg",
        category: "milestone",
        criteria: { type: "flights", threshold: 1 },
        featured: null,
      },
    ]);

    const result = await getSafeAwards();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("First Light");
    expect(result[0].name_zh).toBe("初光");
    expect(result[0].category).toBe("milestone");
  });

  it("gracefully falls back to base columns and enriches missing metadata from catalog", async () => {
    const { getSafeAwards } = await import("./columns");
    mocks.query.mockRejectedValue(new Error("Permission denied or disabled"));

    const badFieldError: any = new Error('column "name_zh" does not exist');
    badFieldError.name = "SequelizeDatabaseError";
    badFieldError.original = { code: "42703" };

    // First call with extended attributes reports PostgreSQL undefined_column.
    // Second call with base attributes succeeds
    mocks.findAll
      .mockRejectedValueOnce(badFieldError)
      .mockResolvedValueOnce([
        {
          id: 1,
          name: "First Light",
          description: "First flight",
          imageurl: "/badges/first.svg",
          featured: null,
        },
      ]);

    const result = await getSafeAwards();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("First Light");
    // Enriched from MASTER_BADGES even though DB column was missing
    expect(result[0].name_zh).toBe("初光");
    expect(result[0].category).toBe("milestone");
    expect(result[0].criteria).toEqual({ type: "flights", threshold: 1 });
  });

  it("uses a savepoint so missing-column fallback does not abort an enclosing transaction", async () => {
    const { getSafeAwards } = await import("./columns");
    const outer = { id: "outer" };
    const savepoint = { id: "savepoint" };
    mocks.query.mockResolvedValue([[{ column_name: "id" }]]);
    mocks.transaction.mockImplementation(async (_options, work) => work(savepoint));
    const undefinedColumn = Object.assign(new Error('column "criteria" does not exist'), {
      name: "SequelizeDatabaseError", parent: { code: "42703" },
    });
    mocks.findAll.mockRejectedValueOnce(undefinedColumn).mockResolvedValueOnce([]);
    expect(await getSafeAwards({ transaction: outer })).toEqual([]);
    expect(mocks.transaction).toHaveBeenCalledWith({ transaction: outer }, expect.any(Function));
    expect(mocks.findAll.mock.calls[0][0].transaction).toBe(savepoint);
    expect(mocks.findAll.mock.calls[1][0].transaction).toBe(outer);
  });
});
