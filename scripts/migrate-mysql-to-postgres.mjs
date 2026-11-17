#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const BATCH_SIZE = 1000;
const BINARY_MARKER = "$crewMigrationBinary";

class OperatorError extends Error {}

export function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };
  const [command, ...rest] = argv;
  if (!["inspect", "export"].includes(command)) throw new OperatorError("Choose inspect or export.");
  const values = new Map();
  const flags = new Set(["--source", "--out", "--mysql-module"]);
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i];
    if (!flags.has(flag) || values.has(flag)) throw new OperatorError("Unknown or repeated command option.");
    const value = rest[i + 1];
    if (!value || value.startsWith("--")) throw new OperatorError("Each command option needs a value.");
    values.set(flag, value);
  }
  if (!values.has("--source") || !values.has("--out")) throw new OperatorError("Both --source and --out are required.");
  return {
    command,
    source: path.resolve(values.get("--source")),
    out: path.resolve(values.get("--out")),
    mysqlModule: values.has("--mysql-module") ? path.resolve(values.get("--mysql-module")) : undefined,
  };
}

export function validateSourceConfiguration(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new OperatorError("Source configuration must be a JSON object.");
  const allowed = new Set(["host", "port", "user", "password", "database", "ssl"]);
  if (Object.keys(value).some(key => !allowed.has(key))) throw new OperatorError("Unexpected source connection configuration fields.");
  for (const key of ["host", "user", "database"]) {
    if (typeof value[key] !== "string" || !value[key].trim()) throw new OperatorError("Source host, user and database must be nonempty strings.");
  }
  if (typeof value.password !== "string") throw new OperatorError("Source password must be a string.");
  const port = Number(value.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new OperatorError("Source port must be between 1 and 65535.");
  if (!value.ssl || typeof value.ssl !== "object" || value.ssl.rejectUnauthorized !== true) {
    throw new OperatorError("Source TLS must explicitly set rejectUnauthorized to true.");
  }
  if (Object.keys(value.ssl).some(key => !["ca", "rejectUnauthorized"].includes(key))
    || (value.ssl.ca !== undefined && (typeof value.ssl.ca !== "string" || !value.ssl.ca.trim()))) {
    throw new OperatorError("Source TLS accepts only a CA certificate and rejectUnauthorized: true.");
  }
  return {
    host: value.host, port, user: value.user, password: value.password, database: value.database,
    ssl: { rejectUnauthorized: true, ...(value.ssl.ca ? { ca: value.ssl.ca } : {}) },
    charset: "utf8mb4", timezone: "Z", dateStrings: true, jsonStrings: true,
    supportBigNumbers: true, bigNumberStrings: true, decimalNumbers: false,
    multipleStatements: false,
  };
}

export function quoteMySqlIdentifier(value) {
  if (typeof value !== "string" || !value || value.includes("\0")) throw new OperatorError("Invalid SQL identifier in source metadata.");
  return `\`${value.replaceAll("`", "``")}\``;
}

export function serializeCell(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return { [BINARY_MARKER]: "base64", data: value.toString("base64") };
  // JSON columns are selected as text; accepting native objects/null parsers
  // here could conflate SQL NULL with a JSON literal null or shift dates.
  throw new OperatorError("Unexpected source cell type; dates and JSON must be read as strings.");
}

export function serializeRow(row, columnCount) {
  if (!Array.isArray(row) || row.length !== columnCount) throw new OperatorError("Source row does not match its explicit column list.");
  return `${JSON.stringify(row.map(serializeCell))}\n`;
}

export function normalizeSchemaMetadata(tableRows, columnRows, primaryRows) {
  const metadata = tableRows.map(row => ({
    name: row.name, tableType: row.tableType, engine: row.engine, collation: row.collation,
    columns: columnRows.filter(column => column.tableName === row.name)
      .sort((left, right) => Number(left.ordinalPosition) - Number(right.ordinalPosition))
      .map(({ tableName: _tableName, ...column }) => column),
    primaryKey: primaryRows.filter(key => key.tableName === row.name)
      .sort((left, right) => Number(left.sequence) - Number(right.sequence)).map(key => key.columnName),
  }));
  for (const table of metadata) {
    quoteMySqlIdentifier(table.name);
    for (const column of table.columns) quoteMySqlIdentifier(column.name);
    if (!table.columns.length) throw new OperatorError("Source metadata has an object without columns.");
    if (table.primaryKey.some(key => !table.columns.some(column => column.name === key))) throw new OperatorError("Source primary key metadata does not match the columns.");
  }
  return metadata;
}

export function dataSelectSql(database, table) {
  const columns = table.columns.map(column => {
    const quoted = quoteMySqlIdentifier(column.name);
    // CAST guarantees SQL NULL remains null and JSON null remains the string
    // "null", even if a driver's JSON parser behavior changes.
    return column.dataType.toLowerCase() === "json"
      ? `CAST(${quoted} AS CHAR CHARACTER SET utf8mb4) AS ${quoted}` : quoted;
  }).join(", ");
  const byName = new Map(table.columns.map(column => [column.name, column]));
  const primary = table.primaryKey.length > 0;
  const orderColumns = primary ? table.primaryKey : table.columns.map(column => column.name);
  const order = orderColumns.map(name => {
    const numeric = /^(?:tinyint|smallint|mediumint|int|integer|bigint|decimal|numeric|float|double|real|bit)$/i.test(byName.get(name).dataType);
    // Bytewise text ordering avoids a source collation's case/accent folding.
    // Tables without a PK use every column; identical duplicate rows serialize
    // identically regardless of their hidden InnoDB row order.
    return `${primary && numeric ? "" : "BINARY "}${quoteMySqlIdentifier(name)} ASC`;
  }).join(", ");
  return `SELECT ${columns} FROM ${quoteMySqlIdentifier(database)}.${quoteMySqlIdentifier(table.name)} ORDER BY ${order} LIMIT ? OFFSET ?`;
}

export async function createPrivateDirectory(directory) {
  try { await mkdir(directory, { mode: 0o700 }); }
  catch (error) {
    if (error.code === "EEXIST") throw new OperatorError("Output already exists; choose a new output directory.");
    throw error;
  }
}

export async function writePrivateFile(filename, content) {
  const file = await open(filename, "wx", 0o600);
  try {
    await file.writeFile(content);
    await file.sync();
  } finally { await file.close(); }
  return { sha256: createHash("sha256").update(content).digest("hex"), bytes: Buffer.byteLength(content) };
}

async function readSourceConfiguration(filename) {
  let parsed;
  try { parsed = JSON.parse(await readFile(filename, "utf8")); }
  catch (error) {
    if (error instanceof SyntaxError) throw new OperatorError("Source configuration is not valid JSON.");
    throw error;
  }
  return validateSourceConfiguration(parsed);
}

function loadMySql(mysqlModule) {
  try { return require(mysqlModule || "mysql2/promise"); }
  catch { throw new OperatorError("MySQL driver unavailable; provide its local promise.js path with --mysql-module."); }
}

async function sourceMetadata(connection, database) {
  const [serverRows] = await connection.query(`SELECT VERSION() AS version,
    @@version_comment AS versionComment, @@system_time_zone AS systemTimeZone,
    @@global.time_zone AS globalTimeZone, @@session.time_zone AS originalSessionTimeZone,
    @@sql_mode AS sqlMode, @@character_set_database AS characterSetDatabase,
    @@collation_database AS collationDatabase`);
  const [tables] = await connection.query(`SELECT TABLE_NAME AS name, TABLE_TYPE AS tableType,
    ENGINE AS engine, TABLE_COLLATION AS collation
    FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY BINARY TABLE_NAME`, [database]);
  const [columns] = await connection.query(`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS name,
    ORDINAL_POSITION AS ordinalPosition, DATA_TYPE AS dataType, COLUMN_TYPE AS columnType,
    IS_NULLABLE AS isNullable, COLUMN_DEFAULT AS defaultValue, EXTRA AS extra,
    CHARACTER_SET_NAME AS characterSet, COLLATION_NAME AS collation,
    NUMERIC_PRECISION AS numericPrecision, NUMERIC_SCALE AS numericScale,
    DATETIME_PRECISION AS datetimePrecision, GENERATION_EXPRESSION AS generationExpression
    FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? ORDER BY BINARY TABLE_NAME, ORDINAL_POSITION`, [database]);
  const [keys] = await connection.query(`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName,
    SEQ_IN_INDEX AS sequence FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = ? AND INDEX_NAME = 'PRIMARY' ORDER BY BINARY TABLE_NAME, SEQ_IN_INDEX`, [database]);
  if (!serverRows[0]) throw new OperatorError("Source server metadata is unavailable.");
  const objects = normalizeSchemaMetadata(tables, columns, keys);
  if (objects.some(object => !["BASE TABLE", "VIEW"].includes(object.tableType))) throw new OperatorError("Source contains an unsupported schema object type.");
  return { server: serverRows[0], tables: objects.filter(object => object.tableType === "BASE TABLE"), views: objects.filter(object => object.tableType === "VIEW") };
}

function checkedCount(value) {
  const count = String(value);
  if (!/^\d+$/.test(count) || BigInt(count) > BigInt(Number.MAX_SAFE_INTEGER)) throw new OperatorError("Source row count cannot be represented safely for batch export.");
  return count;
}

async function exportRows(connection, database, table, filename) {
  const file = await open(filename, "wx", 0o600);
  const digest = createHash("sha256");
  let count = 0;
  let bytes = 0;
  try {
    while (true) {
      const [rows] = await connection.query({ sql: dataSelectSql(database, table), rowsAsArray: true }, [BATCH_SIZE, count]);
      if (!Array.isArray(rows)) throw new OperatorError("Source data query did not return rows.");
      const chunk = rows.map(row => serializeRow(row, table.columns.length)).join("");
      await file.writeFile(chunk);
      digest.update(chunk);
      bytes += Buffer.byteLength(chunk);
      count += rows.length;
      if (rows.length < BATCH_SIZE) break;
    }
    await file.sync();
  } finally { await file.close(); }
  if (String(count) !== table.rowCount) throw new OperatorError("Snapshot row count differs from the rows exported.");
  return { rowCount: String(count), sha256: digest.digest("hex"), bytes };
}

/** No application config is read. createConnection can be injected by offline tests. */
export async function runMigration(options, dependencies = {}) {
  if (!["inspect", "export"].includes(options.command)) throw new OperatorError("Choose inspect or export.");
  const config = await readSourceConfiguration(options.source);
  const createConnection = dependencies.createConnection || loadMySql(options.mysqlModule).createConnection;
  if (typeof createConnection !== "function") throw new OperatorError("The MySQL driver must provide createConnection.");
  const connection = await createConnection(config);
  let snapshotOpen = false;
  try {
    const metadata = await sourceMetadata(connection, config.database);
    const allInnoDb = metadata.tables.every(table => String(table.engine).toLowerCase() === "innodb");
    if (options.command === "export" && !allInnoDb) throw new OperatorError("Export requires every base table to use InnoDB; inspect the source engines first.");
    await createPrivateDirectory(options.out);
    await createPrivateDirectory(path.join(options.out, "schema"));
    if (options.command === "export") await createPrivateDirectory(path.join(options.out, "data"));

    await connection.query("SET SESSION time_zone = '+00:00'");
    await connection.query("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
    snapshotOpen = true;
    const startedAtUtc = new Date().toISOString();
    const [snapshotRows] = await connection.query("SELECT UTC_TIMESTAMP(6) AS snapshotUtc");
    if (typeof snapshotRows[0]?.snapshotUtc !== "string") throw new OperatorError("Source snapshot time was not returned as a date string.");

    let totalRows = 0n;
    const objects = [...metadata.tables, ...metadata.views];
    for (let index = 0; index < objects.length; index += 1) {
      const table = objects[index];
      // Names stay in the manifest; hashed filenames cannot escape the private
      // directory or exceed filesystem limits for Unicode table identifiers.
      const stem = `${String(index + 1).padStart(3, "0")}_${createHash("sha256").update(table.name).digest("hex").slice(0, 16)}`;
      const qualified = `${quoteMySqlIdentifier(config.database)}.${quoteMySqlIdentifier(table.name)}`;
      const [ddlRows] = await connection.query(`SHOW CREATE TABLE ${qualified}`);
      const ddl = ddlRows[0]?.["Create Table"] ?? ddlRows[0]?.["Create View"];
      if (typeof ddl !== "string") throw new OperatorError("Source CREATE definition is unavailable.");
      const ddlPath = `schema/${stem}.sql`;
      table.ddl = { path: ddlPath, ...await writePrivateFile(path.join(options.out, ddlPath), `${ddl};\n`) };
      if (table.tableType === "VIEW") continue;

      const ranges = table.primaryKey.map((name, keyIndex) => `MIN(${quoteMySqlIdentifier(name)}) AS min_${keyIndex}, MAX(${quoteMySqlIdentifier(name)}) AS max_${keyIndex}`);
      const [countRows] = await connection.query(`SELECT COUNT(*) AS rowCount${ranges.length ? `, ${ranges.join(", ")}` : ""} FROM ${qualified}`);
      table.rowCount = checkedCount(countRows[0]?.rowCount);
      table.primaryKeyRanges = table.primaryKey.map((column, keyIndex) => ({ column, min: serializeCell(countRows[0][`min_${keyIndex}`]), max: serializeCell(countRows[0][`max_${keyIndex}`]) }));
      table.ordering = { kind: table.primaryKey.length ? "primary-key" : "all-columns-binary", columns: table.primaryKey.length ? table.primaryKey : table.columns.map(column => column.name) };
      totalRows += BigInt(table.rowCount);
      if (options.command === "export") {
        const dataPath = `data/${stem}.jsonl`;
        table.data = { path: dataPath, ...await exportRows(connection, config.database, table, path.join(options.out, dataPath)) };
      }
    }
    await connection.query("COMMIT");
    snapshotOpen = false;
    const manifest = {
      format: "crew-center-mysql-jsonl", version: 1, command: options.command, complete: true,
      rowEncoding: { kind: "column-ordered-json-array", sqlNull: null, binaryMarker: BINARY_MARKER, binaryEncoding: "base64", jsonColumns: "raw-json-strings" },
      source: { database: config.database, ...metadata.server, exportSessionTimeZone: "+00:00", datetimeValuesHaveNoTimeZone: true },
      snapshot: { startedAtUtc, serverTimeUtc: snapshotRows[0].snapshotUtc, isolation: "REPEATABLE READ", readOnly: true, allBaseTablesInnoDb: allInnoDb, schemaChangesMustBePaused: true },
      counts: { tables: metadata.tables.length, views: metadata.views.length, rows: totalRows.toString() },
      tables: metadata.tables, views: metadata.views, completedAtUtc: new Date().toISOString(),
    };
    await writePrivateFile(path.join(options.out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest.counts;
  } finally {
    if (snapshotOpen) await connection.query("ROLLBACK").catch(() => undefined);
    await connection.end().catch(() => undefined);
  }
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArguments(argv);
    if (options.help) {
      console.log("Usage: node scripts/migrate-mysql-to-postgres.mjs <inspect|export> --source <connection.json> --out <NEW-private-directory> [--mysql-module <local-promise.js>]");
      return;
    }
    const counts = await runMigration(options);
    console.log(`${options.command === "export" ? "Export" : "Inspection"} complete: ${counts.tables} tables, ${counts.views} views, ${counts.rows} rows. Private output written.`);
  } catch (error) {
    // Driver errors can include SQL, row contents and connection details. Never
    // print their messages, stacks, arguments or configuration objects.
    const code = typeof error?.code === "string" && /^(?:ER_[A-Z0-9_]+|E[A-Z0-9_]{1,30})$/.test(error.code) ? ` (${error.code})` : "";
    console.error(error instanceof OperatorError ? error.message : `Migration inspection/export failed${code}; private output may be incomplete.`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
