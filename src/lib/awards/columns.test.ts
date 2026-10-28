import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  findAll: vi.fn(),
}));

vi.mock("@/lib/database", () => ({
  default: {
    query: mocks.query,
  },
}));

vi.mock("@/lib/models", () => ({
  models: {
    Award: {
      findAll: mocks.findAll,
    },
  },
}));

import { getSafeAwards } from "./columns";

beforeEach(() => {
  mocks.query.mockReset();
  mocks.findAll.mockReset();
});

describe("getSafeAwards", () => {
  it("returns full attributes when database columns are present", async () => {
    mocks.query.mockResolvedValue([
      [
        { Field: "id" },
        { Field: "name" },
        { Field: "name_zh" },
        { Field: "description" },
        { Field: "description_zh" },
        { Field: "imageurl" },
        { Field: "category" },
        { Field: "criteria" },
        { Field: "featured" },
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
    mocks.query.mockRejectedValue(new Error("Permission denied or disabled"));

    const badFieldError: any = new Error("Unknown column 'name_zh' in 'field list'");
    badFieldError.name = "SequelizeDatabaseError";
    badFieldError.original = { code: "ER_BAD_FIELD_ERROR" };

    // First call with extended attributes throws ER_BAD_FIELD_ERROR
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
});
