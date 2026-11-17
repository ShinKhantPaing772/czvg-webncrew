import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPrivateDirectory,
  dataSelectSql,
  main,
  normalizeSchemaMetadata,
  parseArguments,
  quoteMySqlIdentifier,
  runMigration,
  serializeCell,
  serializeRow,
  validateSourceConfiguration,
  writePrivateFile,
} from "../../scripts/migrate-mysql-to-postgres.mjs";

const scratch: string[] = [];
const originalExitCode = process.exitCode;
const source = {
  host: "source.invalid", port: 3306, user: "backup-user", password: "PRIVATE_PASSWORD_SENTINEL", database: "crew_center",
  ssl: { rejectUnauthorized: true, ca: "test-ca" },
};

afterEach(async () => {
  vi.restoreAllMocks();
  process.exitCode = originalExitCode;
  await Promise.all(scratch.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "crew-migration-export-test-"));
  scratch.push(directory);
  return directory;
}

function schema(engine = "InnoDB") {
  const tables = [{ name: "extra-table", tableType: "BASE TABLE", engine, collation: "utf8mb4_unicode_ci" }];
  const columns = [
    ["id", "bigint"], ["pilotId", "int"], ["payload", "json"], ["date", "date"], ["amount", "decimal"], ["blob", "blob"],
  ].map(([name, dataType], index) => ({ tableName: "extra-table", name, dataType, ordinalPosition: index + 1, columnType: dataType, isNullable: "YES", defaultValue: null }));
  const keys = [{ tableName: "extra-table", columnName: "id", sequence: 1 }];
  return { tables, columns, keys };
}

function fakeConnection(rows: unknown[][], engine = "InnoDB") {
  const metadata = schema(engine);
  return {
    query: vi.fn(async (query: string | { sql: string; rowsAsArray: boolean }, values?: unknown[]) => {
      const sql = typeof query === "string" ? query : query.sql;
      if (sql.includes("SELECT VERSION()")) return [[{ version: "8.0-test", versionComment: "Test", originalSessionTimeZone: "SYSTEM", systemTimeZone: "UTC", globalTimeZone: "SYSTEM", sqlMode: "STRICT_TRANS_TABLES" }]];
      if (sql.includes("FROM information_schema.TABLES")) return [metadata.tables];
      if (sql.includes("FROM information_schema.COLUMNS")) return [metadata.columns];
      if (sql.includes("FROM information_schema.STATISTICS")) return [metadata.keys];
      if (sql.startsWith("SELECT UTC_TIMESTAMP")) return [[{ snapshotUtc: "2026-11-17 16:00:00.123456" }]];
      if (sql.startsWith("SHOW CREATE TABLE")) return [[{ "Create Table": "CREATE TABLE `extra-table` (`id` BIGINT PRIMARY KEY) ENGINE=InnoDB" }]];
      if (sql.startsWith("SELECT COUNT(*)")) return [[{ rowCount: String(rows.length), min_0: rows[0]?.[0] ?? null, max_0: rows.at(-1)?.[0] ?? null }]];
      if (typeof query === "object") {
        expect(query.rowsAsArray).toBe(true);
        const [limit, offset] = values as number[];
        return [rows.slice(offset, offset + limit)];
      }
      return [[]];
    }),
    end: vi.fn().mockResolvedValue(undefined),
  };
}

describe("MySQL migration export arguments and value preservation", () => {
  it("requires explicit source/output paths, accepts only supported commands and rejects duplicate/unknown options", () => {
    expect(parseArguments(["export", "--source", "source.json", "--out", "backup", "--mysql-module", "driver.js"])).toMatchObject({
      command: "export", source: path.resolve("source.json"), out: path.resolve("backup"), mysqlModule: path.resolve("driver.js"),
    });
    for (const argv of [[], ["import"], ["inspect", "--source", "source.json"], ["export", "--source", "--out", "output"], ["export", "--source", "a", "--source", "b", "--out", "c"], ["export", "--password", "SECRET", "--out", "c"]]) {
      expect(() => parseArguments(argv)).toThrow();
    }
    expect(parseArguments(["--help"])).toEqual({ help: true });
  });

  it("requires verified TLS and fixes the driver's lossless parsing settings", () => {
    expect(validateSourceConfiguration(source)).toMatchObject({ dateStrings: true, jsonStrings: true, supportBigNumbers: true, bigNumberStrings: true, decimalNumbers: false, multipleStatements: false, timezone: "Z" });
    expect(() => validateSourceConfiguration({ ...source, ssl: { rejectUnauthorized: false } })).toThrow(/TLS/);
    expect(() => validateSourceConfiguration({ ...source, port: "invalid" })).toThrow(/port/);
    expect(() => validateSourceConfiguration({ ...source, unexpected: "PRIVATE_PASSWORD_SENTINEL" })).toThrow("Unexpected source connection configuration fields.");
  });

  it("preserves SQL NULL, JSON literal null, precision, Unicode and binary cells distinctly", () => {
    const cells = [null, "null", '{"id":18446744073709551615}', "18446744073709551615", "85.00", "2026-11-17", "2026-11-17 15:02:03.123456", "中文\n\\text", Buffer.from([0, 255]), BigInt("9007199254740993")];
    expect(JSON.parse(serializeRow(cells, cells.length))).toEqual([
      null, "null", '{"id":18446744073709551615}', "18446744073709551615", "85.00", "2026-11-17", "2026-11-17 15:02:03.123456", "中文\n\\text", { $crewMigrationBinary: "base64", data: "AP8=" }, "9007199254740993",
    ]);
    for (const cell of [undefined, Infinity, NaN, new Date(), { json: "already parsed" }]) expect(() => serializeCell(cell)).toThrow(/cell type/);
    expect(() => serializeRow([null], 2)).toThrow(/column list/);
  });

  it("keeps exact column spelling, quotes identifiers and orders primary keys deterministically", () => {
    const data = schema();
    const [table] = normalizeSchemaMetadata(data.tables, [...data.columns].reverse(), data.keys);
    expect(table.columns[1].name).toBe("pilotId");
    const sql = dataSelectSql("crew`db", table);
    expect(sql).toContain("`crew``db`.`extra-table`");
    expect(sql).toContain("`pilotId`");
    expect(sql).toContain("CAST(`payload` AS CHAR CHARACTER SET utf8mb4) AS `payload`");
    expect(sql).toContain("ORDER BY `id` ASC LIMIT ? OFFSET ?");
    expect(quoteMySqlIdentifier("name`with`quotes")).toBe("`name``with``quotes`");
    expect(() => quoteMySqlIdentifier("bad\0name")).toThrow();
    expect(dataSelectSql("crew_center", { ...table, primaryKey: ["pilotId", "date"] })).toContain("ORDER BY `pilotId` ASC, BINARY `date` ASC");
    expect(dataSelectSql("crew_center", { ...table, primaryKey: [] })).toContain("ORDER BY BINARY `id` ASC");
  });
});

describe("private offline inspect/export artifacts", () => {
  it("creates private output and refuses to overwrite directories or files", async () => {
    const parent = await temporaryDirectory();
    const directory = path.join(parent, "backup");
    await createPrivateDirectory(directory);
    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    await expect(createPrivateDirectory(directory)).rejects.toThrow(/already exists/);
    const filename = path.join(directory, "private.json");
    await writePrivateFile(filename, "original");
    expect((await stat(filename)).mode & 0o777).toBe(0o600);
    await expect(writePrivateFile(filename, "replacement")).rejects.toMatchObject({ code: "EEXIST" });
    expect(await readFile(filename, "utf8")).toBe("original");
  });

  it("exports every row in batches inside a read-only snapshot and hashes the exact JSONL bytes", async () => {
    const parent = await temporaryDirectory();
    const sourcePath = path.join(parent, "source.json");
    await writePrivateFile(sourcePath, JSON.stringify(source));
    const rows = Array.from({ length: 1001 }, (_, index) => [String(index + 1), 42, index === 0 ? null : "null", "2026-11-17", "85.00", Buffer.from([index % 256])]);
    const connection = fakeConnection(rows);
    const connect = vi.fn().mockResolvedValue(connection);
    const out = path.join(parent, "export");
    expect(await runMigration({ command: "export", source: sourcePath, out }, { createConnection: connect })).toEqual({ tables: 1, views: 0, rows: "1001" });
    expect(connect).toHaveBeenCalledWith(expect.objectContaining({ dateStrings: true, jsonStrings: true, decimalNumbers: false, ssl: { rejectUnauthorized: true, ca: "test-ca" } }));
    const manifestText = await readFile(path.join(out, "manifest.json"), "utf8");
    const manifest = JSON.parse(manifestText);
    expect(manifestText).not.toContain(source.password);
    expect(manifest.complete).toBe(true);
    expect(manifest.source).toMatchObject({ originalSessionTimeZone: "SYSTEM", exportSessionTimeZone: "+00:00", datetimeValuesHaveNoTimeZone: true });
    expect(manifest.snapshot).toMatchObject({ isolation: "REPEATABLE READ", readOnly: true, allBaseTablesInnoDb: true, serverTimeUtc: "2026-11-17 16:00:00.123456" });
    const table = manifest.tables[0];
    expect(table).toMatchObject({ name: "extra-table", primaryKey: ["id"], rowCount: "1001", primaryKeyRanges: [{ column: "id", min: "1", max: "1001" }] });
    const body = await readFile(path.join(out, table.data.path));
    expect(body.toString().trimEnd().split("\n")).toHaveLength(1001);
    expect(table.data.sha256).toBe(createHash("sha256").update(body).digest("hex"));
    expect(table.data.bytes).toBe(body.length);
    expect((await stat(path.join(out, table.data.path))).mode & 0o777).toBe(0o600);
    expect(await readFile(path.join(out, table.ddl.path), "utf8")).toContain("CREATE TABLE `extra-table`");
    const statements = connection.query.mock.calls.map(([query]) => typeof query === "string" ? query : query.sql);
    const start = statements.indexOf("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
    expect(statements.indexOf("SET SESSION time_zone = '+00:00'")).toBeLessThan(start);
    expect(statements.indexOf("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ")).toBeLessThan(start);
    expect(statements.findIndex(sql => sql.startsWith("SELECT COUNT(*)"))).toBeGreaterThan(start);
    expect(statements.at(-1)).toBe("COMMIT");
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it("inspects non-InnoDB metadata without exporting row files, but refuses snapshot export", async () => {
    const parent = await temporaryDirectory();
    const sourcePath = path.join(parent, "source.json");
    await writePrivateFile(sourcePath, JSON.stringify(source));
    const connection = fakeConnection([], "MyISAM");
    const out = path.join(parent, "inspect");
    await runMigration({ command: "inspect", source: sourcePath, out }, { createConnection: vi.fn().mockResolvedValue(connection) });
    const manifest = JSON.parse(await readFile(path.join(out, "manifest.json"), "utf8"));
    expect(manifest.tables[0].engine).toBe("MyISAM");
    expect(manifest.snapshot.allBaseTablesInnoDb).toBe(false);
    expect(manifest.tables[0].data).toBeUndefined();
    expect(connection.query.mock.calls.some(([query]) => typeof query === "object")).toBe(false);
    await expect(runMigration({ command: "export", source: sourcePath, out: path.join(parent, "rejected") }, { createConnection: vi.fn().mockResolvedValue(fakeConnection([], "MyISAM")) })).rejects.toThrow(/InnoDB/);
  });

  it("rolls back a failed export and does not mark partial artifacts complete", async () => {
    const parent = await temporaryDirectory();
    const sourcePath = path.join(parent, "source.json");
    await writePrivateFile(sourcePath, JSON.stringify(source));
    const connection = fakeConnection([[1, 42, {}, "2026-11-17", "85.00", null]]);
    const out = path.join(parent, "failed");
    await expect(runMigration({ command: "export", source: sourcePath, out }, { createConnection: vi.fn().mockResolvedValue(connection) })).rejects.toThrow(/cell type/);
    expect(connection.query).toHaveBeenCalledWith("ROLLBACK");
    await expect(stat(path.join(out, "manifest.json"))).rejects.toMatchObject({ code: "ENOENT" });
    expect(connection.end).toHaveBeenCalledOnce();
  });

  it("never prints a JSON parser's credential-containing error context", async () => {
    const parent = await temporaryDirectory();
    const sourcePath = path.join(parent, "invalid.json");
    await writePrivateFile(sourcePath, '{"password":"PRIVATE_PASSWORD_SENTINEL", invalid');
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await main(["inspect", "--source", sourcePath, "--out", path.join(parent, "output")]);
    expect(error).toHaveBeenCalledWith("Source configuration is not valid JSON.");
    expect(JSON.stringify(error.mock.calls)).not.toContain(source.password);
    expect(log).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});
