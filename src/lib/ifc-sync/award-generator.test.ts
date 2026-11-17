import { describe, expect, it, vi } from "vitest";

vi.mock("fs", () => ({ default: {
  mkdirSync: () => { throw new Error("unexpected asset directory creation"); },
  writeFileSync: () => { throw new Error("unexpected file generation"); },
  readFileSync: () => { throw new Error("unexpected preview edit"); },
} }));

describe("award catalog import", () => {
  it("lets sync commands load the catalog without generating files or editing previews", async () => {
    const { MASTER_BADGES, buildAwardsSeedSql } = await import("../../../scripts/build-all-badges.mjs");
    expect(MASTER_BADGES.length).toBeGreaterThan(0);
    const sql = buildAwardsSeedSql();
    expect(sql).toContain("Preserves existing award IDs");
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
  });
});
