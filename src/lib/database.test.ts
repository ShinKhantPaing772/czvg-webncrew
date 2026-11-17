import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDatabase: vi.fn(function () {
    return { authenticate: vi.fn() };
  }),
}));

vi.mock("sequelize", () => ({ Sequelize: mocks.createDatabase }));

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("webncrewDatabase", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shared application database pool", () => {
  it("reuses the existing pool when another route bundle loads the database module", async () => {
    const first = await import("./database");
    vi.resetModules();
    const second = await import("./database");

    expect(second.default).toBe(first.default);
    expect(mocks.createDatabase).toHaveBeenCalledOnce();
  });
});
