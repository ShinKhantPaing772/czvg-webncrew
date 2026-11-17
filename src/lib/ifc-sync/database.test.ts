import { afterEach, describe, expect, it, vi } from "vitest";
import { applyPlans, databaseConfiguration, loadPilots } from "./database.mjs";

afterEach(() => vi.unstubAllEnvs());

function plan(id: number, originalIfc: string | null = null) {
  return {
    changed: true,
    conflict: false,
    targetIfc: `pilot${id}`,
    targetIfUserId: `user-${id}`,
    pilot: { id, originalIfc, originalIfUserId: null },
  };
}

describe("PostgreSQL identity sync", () => {
  it("uses PostgreSQL's port and permits an explicit local non-TLS connection", () => {
    for (const name of ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]) vi.stubEnv(name, "test-only");
    vi.stubEnv("DB_PORT", "");
    vi.stubEnv("DB_SSL", "false");
    expect(databaseConfiguration()).toMatchObject({ port: 5432, ssl: false });
  });
  it("loads pg rows and normalizes numeric identifiers without losing null originals", async () => {
    const connection = { query: vi.fn().mockResolvedValue({ rows: [{ id: "12", callsign: "CZ12", ifc: null, ifuserid: null }] }) };
    expect(await loadPilots(connection)).toEqual([{
      id: 12, callsign: "CZ12", ifc: "", ifuserid: "", originalIfc: null, originalIfUserId: null,
    }]);
  });

  it("rolls back earlier changes when a pilot changes after the audit", async () => {
    const connection = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] }) };
    await expect(applyPlans(connection, [plan(1), plan(2, "original")])).rejects.toThrow("Pilot #2 changed after the audit");
    expect(connection.query.mock.calls[0]).toEqual(["BEGIN"]);
    expect(connection.query.mock.calls[1][1]).toEqual(["pilot1", "user-1", 1, null, null]);
    expect(connection.query.mock.calls.at(-1)).toEqual(["ROLLBACK"]);
    expect(connection.query).not.toHaveBeenCalledWith("COMMIT");
  });

  it("commits only verified changes and does not start a transaction for an empty apply", async () => {
    const connection = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };
    expect(await applyPlans(connection, [{ ...plan(1), conflict: true }, { ...plan(2), changed: false }])).toBe(0);
    expect(connection.query).not.toHaveBeenCalled();
    expect(await applyPlans(connection, [plan(3)])).toBe(1);
    expect(connection.query.mock.calls.at(-1)).toEqual(["COMMIT"]);
  });
});
