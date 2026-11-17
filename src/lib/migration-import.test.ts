import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TABLE_ORDER, ImportFailure, canonicalCell, canonicalDatetime, canonicalDecimal, canonicalInteger,
  identityResetSql, parameterCell, parseArguments, readSnapshot, runSnapshotImport, safeFailureContext, targetSelectSql,
} from "../../scripts/import-mysql-snapshot.mjs";

type SourceColumn = { name: string; dataType: string };
type TableFixture = { name: string; columns: SourceColumn[]; primaryKey: string[]; rows: unknown[][] };
type TargetColumn = { tableName: string; name: string; dataType: string; isNullable: string; defaultValue: null; isIdentity: string };
const temporary: string[] = [];
const cutoff = Date.parse("2026-11-17T16:00:00.123Z");

const target = { host: "target.invalid", port: 5432, user: "operator", password: "DO_NOT_LOG_PASSWORD", database: "fixture_db", ssl: { rejectUnauthorized: true, ca: "test-ca" } };

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporary.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

function fixtures(): TableFixture[] {
  const tables = TABLE_ORDER.map((name: string) => ({ name, columns: [{ name: "id", dataType: "int" }], primaryKey: ["id"], rows: [] as unknown[][] }));
  const replace = (name: string, columns: Array<[string, string]>, primaryKey: string[], rows: unknown[][]) => {
    Object.assign(tables.find(table => table.name === name)!, { columns: columns.map(([name, dataType]) => ({ name, dataType })), primaryKey, rows });
  };
  replace("pilots", [["id", "int"], ["email", "text"], ["joined", "datetime"], ["status", "int"]], ["id"], [[7, "PRIVATE_EMAIL", "2026-11-17 12:13:14", 2]]);
  replace("awards", [["id", "int"], ["criteria", "json"]], ["id"], [[1, null], [2, "null"], [3, '{"large":900719925474099312345,"message":"a\u2028b"}']]);
  replace("options", [["name", "varchar"], ["value", "text"]], ["name"], [["live_scheduling_mutex", "1"], ["policy", "a\u2028b"]]);
  replace("tokens", [["pilotId", "int"], ["token", "varchar"], ["expiresAt", "datetime"], ["createdAt", "datetime"], ["updatedAt", "datetime"], ["isRevoked", "tinyint"]], ["token"], [[7, "PRIVATE_TOKEN", "2026-11-24 12:13:14", "2026-11-17 12:13:14", "2026-11-17 12:13:14", 0]]);
  replace("live_aircraft", [["id", "int"], ["active", "tinyint"], ["updated_at", "datetime"]], ["id"], [[9, 1, "2026-11-17 12:13:14.123"]]);
  replace("api_cache", [["cache_key", "varchar"], ["value", "longtext"], ["expires_at", "bigint"]], ["cache_key"], [["expired", "PRIVATE_CACHE", String(cutoff)], ["unexpired", "PRIVATE_CACHE", String(cutoff + 1)]]);
  return tables;
}

async function snapshot(tables = fixtures()) {
  const root = await mkdtemp(path.join(os.tmpdir(), "crew-snapshot-import-test-"));
  temporary.push(root);
  await mkdir(path.join(root, "schema"), { mode: 0o700 });
  await mkdir(path.join(root, "data"), { mode: 0o700 });
  const metadata = [];
  for (const table of tables) {
    const ddl = `CREATE TABLE ${table.name};\n`;
    const data = table.rows.map(row => `${JSON.stringify(row)}\n`).join("");
    const entry = (filename: string, content: string) => ({ path: filename, bytes: Buffer.byteLength(content), sha256: createHash("sha256").update(content).digest("hex") });
    const ddlFile = `schema/${table.name}.sql`;
    const dataFile = `data/${table.name}.jsonl`;
    await writeFile(path.join(root, ddlFile), ddl, { mode: 0o600 });
    await writeFile(path.join(root, dataFile), data, { mode: 0o600 });
    metadata.push({ name: table.name, columns: table.columns, primaryKey: table.primaryKey, rowCount: String(table.rows.length), ddl: entry(ddlFile, ddl), data: { ...entry(dataFile, data), rowCount: String(table.rows.length) } });
  }
  const manifest = { format: "crew-center-mysql-jsonl", version: 1, command: "export", complete: true, rowEncoding: { kind: "column-ordered-json-array", jsonColumns: "raw-json-strings" }, source: { exportSessionTimeZone: "+00:00" }, snapshot: { allBaseTablesInnoDb: true, serverTimeUtc: "2026-11-17 16:00:00.123456" }, counts: { tables: tables.length, rows: String(tables.reduce((sum, table) => sum + table.rows.length, 0)) }, tables: metadata, views: [] };
  await writeFile(path.join(root, "manifest.json"), JSON.stringify(manifest), { mode: 0o600 });
  const targetFile = path.join(root, "target.json");
  await writeFile(targetFile, JSON.stringify(target), { mode: 0o600 });
  return { root, targetFile, tables, manifest };
}

function fakeClient(tables: TableFixture[]) {
  const targetType = (table: string, column: SourceColumn) => {
    if (`${table}.${column.name}` === "tokens.isRevoked" || `${table}.${column.name}` === "live_aircraft.active") return "boolean";
    return ({ int: "integer", bigint: "bigint", tinyint: "smallint", json: "json", datetime: "timestamp with time zone", date: "date", decimal: "numeric", double: "double precision", text: "text", varchar: "character varying", longtext: "text" } as Record<string, string>)[column.dataType];
  };
  const columns: TargetColumn[] = tables.flatMap(table => table.columns.map(column => ({ tableName: table.name, name: column.name, dataType: targetType(table.name, column), isNullable: "YES", defaultValue: null, isIdentity: "NO" })));
  columns.push({ tableName: "tokens", name: "id", dataType: "integer", isNullable: "NO", defaultValue: null, isIdentity: "YES" }, ...["grade", "violand"].map(name => ({ tableName: "pilots", name, dataType: name === "grade" ? "integer" : "double precision", isNullable: "YES", defaultValue: null, isIdentity: "NO" })));
  let rows = new Map<string, Record<string, unknown>[]>(tables.map(table => [table.name, table.name === "options" ? [{ name: "live_scheduling_mutex", value: "1" }] : []]));
  let original = rows;
  let sequence = 0;
  const query = vi.fn(async (input: string | { text: string; values: number[]; rowMode: string }, values?: unknown[]) => {
    const sql = typeof input === "string" ? input : input.text;
    if (sql.startsWith("BEGIN")) {
      original = new Map([...rows].map(([name, records]) => [name, records.map(record => ({ ...record }))]));
      return { rows: [] };
    }
    if (sql === "ROLLBACK") { rows = original; return { rows: [] }; }
    if (sql.includes("current_schema() AS")) return { rows: [{ schema: "public", database: "fixture_db" }] };
    if (sql.includes("FROM information_schema.tables")) return { rows: tables.map(table => ({ name: table.name })) };
    if (sql.includes("FROM information_schema.columns")) return { rows: columns };
    if (sql.startsWith("SELECT name, value")) return { rows: rows.get("options")! };
    if (sql.startsWith("DELETE FROM")) {
      expect(sql).toBe('DELETE FROM "public".options WHERE name = $1 AND value = $2');
      expect(values).toEqual(["live_scheduling_mutex", "1"]);
      rows.set("options", []);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("SELECT COUNT(*)")) {
      const name = sql.match(/FROM "public"\."([^"]+)"/)![1];
      return { rows: [{ count: String(rows.get(name)!.length) }] };
    }
    if (sql.startsWith("INSERT INTO")) {
      const [, name, list] = sql.match(/INSERT INTO "public"\."([^"]+)" \(([^)]+)\)/)!;
      const names = [...list.matchAll(/"([^"]+)"/g)].map(match => match[1]);
      for (let offset = 0; offset < values!.length; offset += names.length) {
        const record = Object.fromEntries(names.map((name, index) => [name, values![offset + index]]));
        if (name === "tokens") record.id = ++sequence;
        rows.get(name)!.push(record);
      }
      return { rows: [], rowCount: values!.length / names.length };
    }
    if (typeof input === "object") {
      expect(input.rowMode).toBe("array");
      const name = sql.match(/FROM "public"\."([^"]+)"/)![1];
      const table = tables.find(table => table.name === name)!;
      const ordered = [...rows.get(name)!].sort((left, right) => {
        for (const key of table.primaryKey) {
          const metadata = columns.find(column => column.tableName === name && column.name === key)!;
          const difference = metadata.dataType === "integer" ? Number(BigInt(String(left[key])) - BigInt(String(right[key]))) : Buffer.compare(Buffer.from(String(left[key])), Buffer.from(String(right[key])));
          if (difference) return difference;
        }
        return 0;
      });
      const [limit, offset] = input.values;
      return { rows: ordered.slice(offset, offset + limit).map(record => table.columns.map(column => {
        const value = record[column.name];
        if (value === null) return null;
        const type = targetType(name, column);
        if (type === "timestamp with time zone") return canonicalDatetime(value).slice(0, -1);
        return String(value);
      })) };
    }
    return { rows: [] };
  });
  return { query, columns, connect: vi.fn().mockResolvedValue(undefined), end: vi.fn().mockResolvedValue(undefined), records: (name: string) => rows.get(name)!, sequence: () => sequence };
}

function options(fixture: Awaited<ReturnType<typeof snapshot>>, overrides = {}) {
  return { command: "import", datetimeZone: "UTC", snapshot: fixture.root, target: fixture.targetFile, commit: false, omitExpiredCache: true, ...overrides };
}

describe("snapshot import conversion and explicit modes", () => {
  it("defaults to rehearsal and requires explicit UTC mapping and commit intent", () => {
    expect(parseArguments(["--snapshot", "backup", "--target", "target.json", "--datetime-zone", "UTC"])).toMatchObject({ command: "import", commit: false, omitExpiredCache: false });
    expect(parseArguments(["import", "--snapshot", "backup", "--target", "target.json", "--datetime-zone", "UTC", "--commit", "--omit-expired-cache"])).toMatchObject({ commit: true, omitExpiredCache: true });
    for (const args of [["--snapshot", "backup", "--target", "target"], ["--snapshot", "backup", "--target", "target", "--datetime-zone", "EST"], ["verify", "--snapshot", "backup", "--target", "target", "--datetime-zone", "UTC", "--commit"]]) expect(() => parseArguments(args)).toThrow();
  });

  it("preserves arbitrary decimal precision and timestamps down to microseconds", () => {
    expect(canonicalInteger("18446744073709551615")).toBe("18446744073709551615");
    expect(canonicalDecimal("9007199254740993.123456789")).toBe("9007199254740993123456789e-9");
    expect(canonicalDecimal("00085.0000")).toBe(canonicalDecimal("85"));
    expect(canonicalDecimal("1.2500e3")).toBe(canonicalDecimal("1250"));
    expect(canonicalDatetime("2026-11-17 12:13:14.123400")).toBe("2026-11-17T12:13:14.1234Z");
    expect(canonicalDatetime("2026-11-17T12:13:14.123400Z")).toBe("2026-11-17T12:13:14.1234Z");
    expect(() => canonicalDatetime("0000-00-00 00:00:00")).toThrow();
    expect(() => canonicalDatetime("2026-02-30 00:00:00")).toThrow();
  });

  it("maps only the two real booleans and keeps SQL NULL distinct from JSON null text", () => {
    const boolean = { dataType: "boolean" };
    expect(parameterCell("tokens", { name: "isRevoked" }, 0, boolean)).toBe(false);
    expect(parameterCell("live_aircraft", { name: "active" }, "1", boolean)).toBe(true);
    expect(() => parameterCell("tokens", { name: "isRevoked" }, 2, boolean)).toThrow();
    expect(parameterCell("pilots", { name: "status" }, 2, { dataType: "integer" })).toBe("2");
    expect(canonicalCell("awards", { name: "criteria" }, null, { dataType: "json" })).toBeNull();
    expect(canonicalCell("awards", { name: "criteria" }, "null", { dataType: "json" })).toBe("null");
    expect(() => parameterCell("pilots", { name: "id" }, "2147483648", { dataType: "integer" })).toThrow(/fit/);
  });

  it("allows only the reviewed identity-reset DO block", async () => {
    const sql = await identityResetSql();
    expect(sql).toContain("pg_get_serial_sequence");
    expect(sql).toContain("setval");
  });

  it("orders by typed base primary keys rather than the text projection aliases", () => {
    const integer = targetSelectSql({ name: "pilots", columns: [{ name: "id" }], primaryKey: ["id"], targetColumns: [{ dataType: "integer" }] }, "public");
    expect(integer).toContain('source."id"::text AS "id"');
    expect(integer).toContain('ORDER BY source."id" ASC');
    const text = targetSelectSql({ name: "tokens", columns: [{ name: "token" }], primaryKey: ["token"], targetColumns: [{ dataType: "character varying" }] }, "public");
    expect(text).toContain('ORDER BY source."token" COLLATE "C" ASC');
  });
});

describe("offline snapshot import and full-row verification", () => {
  it.each(["localhost", "127.0.0.1", "::1"])("allows explicitly disabled TLS for local target %s", async host => {
    const fixture = await snapshot();
    await writeFile(fixture.targetFile, JSON.stringify({ ...target, host, ssl: false }));
    const client = fakeClient(fixture.tables);
    const createClient = vi.fn(() => client);

    const result = await runSnapshotImport(options(fixture), { createClient });

    expect(result.mode).toBe("rehearsed-and-rolled-back");
    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({ host, ssl: false }));
  });

  it.each(["target.invalid", "localhost.example.com", "192.168.1.10"])("rejects disabled TLS for non-loopback target %s", async host => {
    const fixture = await snapshot();
    await writeFile(fixture.targetFile, JSON.stringify({ ...target, host, ssl: false }));
    const createClient = vi.fn();

    await expect(runSnapshotImport(options(fixture), { createClient })).rejects.toThrow(/TLS/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("checks full backup hashes and retains literal Unicode line separators while filtering only expired cache", async () => {
    const fixture = await snapshot();
    const plan = await readSnapshot(fixture.root, true);
    expect(plan.omittedExpiredCacheRows).toBe(1);
    expect(plan.tables.find((table: TableFixture) => table.name === "options").rows[1][1]).toBe("a\u2028b");
    expect(plan.tables.find((table: TableFixture) => table.name === "api_cache").rows).toEqual([["unexpired", "PRIVATE_CACHE", String(cutoff + 1)]]);
    expect((await readSnapshot(fixture.root, false)).omittedExpiredCacheRows).toBe(0);
    await writeFile(path.join(fixture.root, "data", "api_cache.jsonl"), "tampered\n");
    const createClient = vi.fn();
    await expect(runSnapshotImport(options(fixture), { createClient })).rejects.toThrow(/hash/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("imports and verifies every source field then rolls back by default, without resetting sequences", async () => {
    const fixture = await snapshot();
    const client = fakeClient(fixture.tables);
    const result = await runSnapshotImport(options(fixture), { createClient: () => client });
    expect(result.mode).toBe("rehearsed-and-rolled-back");
    expect(result.backupRows - result.verifiedRows).toBe(1);
    expect(client.records("pilots")).toEqual([]);
    expect(client.records("options")).toEqual([{ name: "live_scheduling_mutex", value: "1" }]);
    expect(client.sequence()).toBe(1); // PostgreSQL identities are nontransactional.
    const statements = client.query.mock.calls.map(([query]) => typeof query === "string" ? query : query.text);
    expect(statements.at(-1)).toBe("ROLLBACK");
    expect(statements).not.toContain("COMMIT");
    expect(statements.some(sql => sql.includes("setval"))).toBe(false);
    expect(statements.some(sql => /\b(?:DROP|TRUNCATE)\b/.test(sql))).toBe(false);
    expect(statements.filter(sql => sql.startsWith("DELETE"))).toHaveLength(1);
    const insert = statements.find(sql => sql.startsWith('INSERT INTO "public"."tokens"'))!;
    expect(insert).toContain('"pilotId", "token", "expiresAt", "createdAt", "updatedAt", "isRevoked"');
    expect(insert).not.toContain("PRIVATE_TOKEN");
  });

  it("commits only with explicit intent, resets identities and can subsequently verify without writes", async () => {
    const fixture = await snapshot();
    const client = fakeClient(fixture.tables);
    const committed = await runSnapshotImport(options(fixture, { commit: true }), { createClient: () => client });
    expect(committed.mode).toBe("committed");
    expect(client.records("tokens")[0]).toMatchObject({ pilotId: "7", token: "PRIVATE_TOKEN", isRevoked: false, id: 1 });
    expect(client.records("pilots")[0]).toMatchObject({ joined: "2026-11-17T12:13:14Z", status: "2" });
    expect(client.records("awards").map(row => row.criteria)).toEqual([null, "null", '{"large":900719925474099312345,"message":"a\u2028b"}']);
    expect(client.query.mock.calls.some(([query]) => typeof query === "string" && query.includes("setval"))).toBe(true);
    client.query.mockClear();
    const verified = await runSnapshotImport(options(fixture, { command: "verify" }), { createClient: () => client });
    expect(verified.mode).toBe("verified");
    const statements = client.query.mock.calls.map(([query]) => typeof query === "string" ? query : query.text);
    expect(statements.some(sql => /^(?:INSERT|DELETE|LOCK|DO)/.test(sql))).toBe(false);
  });

  it("refuses populated targets and unexpected target columns before the first INSERT", async () => {
    const fixture = await snapshot();
    const client = fakeClient(fixture.tables);
    client.records("pilots").push({ id: 99, email: "EXISTING_PRIVATE_EMAIL" });
    await expect(runSnapshotImport(options(fixture), { createClient: () => client })).rejects.toMatchObject({ context: { table: "pilots", rowCount: "1" } });
    expect(client.query.mock.calls.some(([query]) => typeof query === "string" && query.startsWith("INSERT"))).toBe(false);
    const badSchema = fakeClient(fixture.tables);
    badSchema.columns.push({ tableName: "pilots", name: "unexpected", dataType: "text", isNullable: "YES", defaultValue: null, isIdentity: "NO" });
    await expect(runSnapshotImport(options(fixture), { createClient: () => badSchema })).rejects.toThrow(/target-only/);
  });

  it("detects even one changed target cell without logging either value", async () => {
    const fixture = await snapshot();
    const client = fakeClient(fixture.tables);
    await runSnapshotImport(options(fixture, { commit: true }), { createClient: () => client });
    client.records("pilots")[0].email = "CHANGED_PRIVATE_EMAIL";
    let failure: unknown;
    try { await runSnapshotImport(options(fixture, { command: "verify" }), { createClient: () => client }); }
    catch (error) { failure = error; }
    expect(failure).toMatchObject({ context: { table: "pilots", column: "email", rowOffset: 0 } });
    expect(JSON.stringify(safeFailureContext(failure))).not.toContain("PRIVATE_EMAIL");
    expect((failure as Error).message).not.toContain("PRIVATE_EMAIL");
  });

  it("reports constraint identifiers and counts without PostgreSQL row details", () => {
    const failure = new ImportFailure("Target rejected imported rows.", { table: "pireps", constraint: "pireps_pilotid_fkey", sqlstate: "23503", detail: "PRIVATE_ROW_VALUE", rowOffset: 12 });
    expect(safeFailureContext(failure)).toEqual({ table: "pireps", constraint: "pireps_pilotid_fkey", sqlstate: "23503", rowOffset: 12 });
  });
});
