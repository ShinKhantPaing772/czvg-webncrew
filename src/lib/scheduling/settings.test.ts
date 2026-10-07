import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryTypes, Transaction } from "sequelize";

const mocks = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), pilot: vi.fn(), permissions: vi.fn() }));
vi.mock("@/lib/database", () => ({ default: { query: mocks.query, transaction: mocks.transaction } }));
vi.mock("@/lib/models", () => ({ models: { Pilot: { findByPk: mocks.pilot }, Permission: { findAll: mocks.permissions } } }));
import { changeSchedulingSettings, getSchedulingSettings } from "./settings";

const transaction = { LOCK: { UPDATE: "UPDATE" } };
let value: string | null;
beforeEach(() => {
  value = null;
  mocks.query.mockReset().mockImplementation(async (sql: string, options: { replacements?: { value?: string } }) => {
    if (sql.startsWith("SELECT value")) return value == null ? [] : [{ value }];
    if (sql.startsWith("INSERT INTO options")) { value = options.replacements!.value!; return []; }
    return [{ name: "live_scheduling_mutex" }];
  });
  mocks.transaction.mockReset().mockImplementation(async (_options, work) => work(transaction));
  mocks.pilot.mockReset().mockResolvedValue({ status: 1 });
  mocks.permissions.mockReset().mockResolvedValue([{ name: "scheduling" }]);
});

describe("persistent scheduling start policy", () => {
  it("defaults to required publication when no administrator has enabled bypass", async () => {
    expect(await getSchedulingSettings()).toEqual({ allowUnpublishedIfStarts: false });
  });

  it.each(["invalid-json", '"true"', "true", "1", "null", '{"allowUnpublishedIfStarts":"true"}', '{"allowUnpublishedIfStarts":1}'])("fails closed for malformed policy %s", async policy => {
    value = policy; expect(await getSchedulingSettings()).toEqual({ allowUnpublishedIfStarts: false });
  });

  it("persists enable/disable across uncached reads and records the authenticated administrator", async () => {
    expect(await changeSchedulingSettings(9, { allowUnpublishedIfStarts: true })).toEqual({ allowUnpublishedIfStarts: true });
    expect(await getSchedulingSettings()).toEqual({ allowUnpublishedIfStarts: true });
    expect(JSON.parse(value!)).toMatchObject({ allowUnpublishedIfStarts: true, updatedBy: 9, updatedAt: expect.any(String), previousAllowUnpublishedIfStarts: false });
    expect(await changeSchedulingSettings(9, { allowUnpublishedIfStarts: false })).toEqual({ allowUnpublishedIfStarts: false });
    expect(await getSchedulingSettings()).toEqual({ allowUnpublishedIfStarts: false });
    expect(JSON.parse(value!)).toMatchObject({ previousAllowUnpublishedIfStarts: true });
    expect(mocks.transaction).toHaveBeenCalledWith({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, expect.any(Function));
    expect(mocks.query.mock.calls[0]).toEqual([expect.stringContaining("FOR UPDATE"), { type: QueryTypes.SELECT, transaction }]);
    expect(mocks.query).toHaveBeenCalledWith(expect.stringContaining("ON DUPLICATE KEY UPDATE"), { replacements: { name: "live_scheduling_allow_unpublished_if_starts", value: expect.any(String) }, transaction });
  });

  it.each([null, [], {}, { allowUnpublishedIfStarts: "true" }, { allowUnpublishedIfStarts: true, actorId: 1 }])("rejects invalid or extra mutation fields %j", async body => {
    await expect(changeSchedulingSettings(9, body)).rejects.toMatchObject({ status: 400 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each(["inactive", "missing", "revoked_permission"])("rechecks administrator %s under the transaction mutex", async kind => {
    if (kind === "inactive") mocks.pilot.mockResolvedValue({ status: 0 });
    if (kind === "missing") mocks.pilot.mockResolvedValue(null);
    if (kind === "revoked_permission") mocks.permissions.mockResolvedValue([]);
    await expect(changeSchedulingSettings(9, { allowUnpublishedIfStarts: true })).rejects.toMatchObject({ status: 403 });
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
    expect(mocks.pilot).toHaveBeenCalledWith(9, { attributes: ["status"], transaction, lock: "UPDATE" });
    expect(mocks.permissions.mock.calls[0][0]).toMatchObject({ transaction, lock: "UPDATE" });
  });

  it("requires the shared mutex migration before updating any policy", async () => {
    mocks.query.mockResolvedValue([]);
    await expect(changeSchedulingSettings(9, { allowUnpublishedIfStarts: true })).rejects.toMatchObject({ status: 503 });
    expect(mocks.pilot).not.toHaveBeenCalled();
  });
});
