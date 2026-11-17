#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

export const TABLE_ORDER = [
  "ranks", "awards", "pilots", "aircraft", "awards_granted", "multipliers", "notifications", "options",
  "permissions", "pireps", "pireps_comments", "routes", "route_aircraft", "news", "applications", "tokens", "otps",
  "api_cache", "live_aircraft", "live_flights", "live_flight_members", "live_schedule_events", "if_live_connections", "if_live_outbox",
];
const BOOLEAN_COLUMNS = new Set(["live_aircraft.active", "tokens.isRevoked"]);
const INTEGER_TARGETS = new Map([
  ["smallint", [BigInt(-32768), BigInt(32767)]],
  ["integer", [BigInt(-2147483648), BigInt(2147483647)]],
  ["bigint", [BigInt("-9223372036854775808"), BigInt("9223372036854775807")]],
]);
const TEXT_TARGETS = new Set(["text", "character varying", "character"]);
const BATCH_SIZE = 500;

export class ImportFailure extends Error {
  constructor(message, context = {}) { super(message); this.context = context; }
}

export function parseArguments(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };
  const input = [...argv];
  const command = input[0] && !input[0].startsWith("-") ? input.shift() : "import";
  if (!["import", "verify"].includes(command)) throw new ImportFailure("Choose import or verify.");
  const values = new Map();
  const booleans = new Set(["--commit", "--omit-expired-cache"]);
  const flags = new Set(["--snapshot", "--target", "--datetime-zone", ...booleans]);
  for (let index = 0; index < input.length; index += 1) {
    const flag = input[index];
    if (!flags.has(flag) || values.has(flag)) throw new ImportFailure("Unknown or repeated command option.");
    if (booleans.has(flag)) values.set(flag, true);
    else {
      const value = input[++index];
      if (!value || value.startsWith("--")) throw new ImportFailure("Each command option needs a value.");
      values.set(flag, value);
    }
  }
  if (!values.has("--snapshot") || !values.has("--target") || values.get("--datetime-zone") !== "UTC") {
    throw new ImportFailure("Provide --snapshot, --target and the explicitly confirmed --datetime-zone UTC.");
  }
  if (command === "verify" && values.has("--commit")) throw new ImportFailure("--commit applies only to import.");
  return {
    command, snapshot: path.resolve(values.get("--snapshot")), target: path.resolve(values.get("--target")), datetimeZone: "UTC",
    commit: values.has("--commit"), omitExpiredCache: values.has("--omit-expired-cache"),
  };
}

export function quotePgIdentifier(value) {
  if (typeof value !== "string" || !value || value.includes("\0")) throw new ImportFailure("Invalid SQL identifier in migration metadata.");
  return `"${value.replaceAll('"', '""')}"`;
}

export function canonicalInteger(value) {
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new ImportFailure("Unsafe integer in snapshot.");
  if (!["number", "string"].includes(typeof value) || !/^[+-]?\d+$/.test(String(value))) throw new ImportFailure("Invalid integer in snapshot.");
  return BigInt(String(value)).toString();
}

export function canonicalDecimal(value) {
  const match = String(value).match(/^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/);
  if (!match || !["string", "number"].includes(typeof value)) throw new ImportFailure("Invalid decimal in snapshot.");
  let digits = `${match[2]}${match[3] || ""}`.replace(/^0+/, "");
  if (!digits) return "0";
  let exponent = BigInt(match[4] || "0") - BigInt((match[3] || "").length);
  const trimmed = digits.replace(/0+$/, "");
  exponent += BigInt(digits.length - trimmed.length);
  digits = trimmed;
  return `${match[1] === "-" ? "-" : ""}${digits}e${exponent}`;
}

function calendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) throw new ImportFailure("Invalid or zero date in snapshot.");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new ImportFailure("Invalid calendar date in snapshot.");
  return value;
}

export function canonicalDatetime(value) {
  if (typeof value !== "string") throw new ImportFailure("Datetime must be a source string.");
  const match = value.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?Z?$/);
  if (!match || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) throw new ImportFailure("Invalid or zero datetime in snapshot.");
  calendarDate(match[1]);
  const fraction = (match[5] || "").replace(/0+$/, "");
  return `${match[1]}T${match[2]}:${match[3]}:${match[4]}${fraction ? `.${fraction}` : ""}Z`;
}

function booleanValue(value, target = false) {
  if (value === 0 || value === "0" || (target && value === "false")) return false;
  if (value === 1 || value === "1" || (target && value === "true")) return true;
  throw new ImportFailure("Boolean source value must be exactly zero or one.");
}

export function canonicalCell(table, column, value, targetColumn, fromTarget = false) {
  if (value === null) return null;
  const name = `${table}.${column.name}`;
  if (BOOLEAN_COLUMNS.has(name)) return String(booleanValue(value, fromTarget));
  if (value && typeof value === "object") throw new ImportFailure("Unsupported binary or native object cell in snapshot.");
  if (INTEGER_TARGETS.has(targetColumn.dataType)) return canonicalInteger(value);
  if (targetColumn.dataType === "numeric") return canonicalDecimal(value);
  if (["double precision", "real"].includes(targetColumn.dataType)) {
    if (!["string", "number"].includes(typeof value) || !Number.isFinite(Number(value))) throw new ImportFailure("Invalid floating-point value in snapshot.");
    return String(Number(value));
  }
  if (targetColumn.dataType === "date") return calendarDate(value);
  if (targetColumn.dataType === "timestamp with time zone") return canonicalDatetime(value);
  if (typeof value !== "string") throw new ImportFailure("Source text and JSON values must remain strings.");
  if (value.includes("\0")) throw new ImportFailure("Target text cannot represent a NUL byte.");
  if (targetColumn.dataType === "json") {
    try { JSON.parse(value); } catch { throw new ImportFailure("Invalid JSON text in snapshot."); }
    return value; // Do not parse/stringify: that could round large JSON numbers.
  }
  if (TEXT_TARGETS.has(targetColumn.dataType)) return value;
  throw new ImportFailure("Unsupported source-to-target column mapping.");
}

export function parameterCell(table, column, value, targetColumn) {
  const canonical = canonicalCell(table, column, value, targetColumn);
  if (value === null) return null;
  if (BOOLEAN_COLUMNS.has(`${table}.${column.name}`)) return booleanValue(value);
  if (INTEGER_TARGETS.has(targetColumn.dataType)) {
    const [minimum, maximum] = INTEGER_TARGETS.get(targetColumn.dataType);
    const integer = BigInt(canonical);
    if (integer < minimum || integer > maximum) throw new ImportFailure("Source integer does not fit its target type.");
    return canonical;
  }
  if (targetColumn.dataType === "timestamp with time zone") return canonical;
  return value;
}

function validateTargetConfiguration(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).some(key => !["host", "port", "user", "password", "database", "ssl"].includes(key))) throw new ImportFailure("Invalid target connection configuration.");
  if (["host", "user", "database"].some(key => typeof value[key] !== "string" || !value[key].trim()) || typeof value.password !== "string") throw new ImportFailure("Target connection fields are missing.");
  const port = Number(value.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ImportFailure("Invalid target port.");
  if (!value.ssl || value.ssl.rejectUnauthorized !== true || Object.keys(value.ssl).some(key => !["ca", "rejectUnauthorized"].includes(key))
    || (value.ssl.ca !== undefined && typeof value.ssl.ca !== "string")) throw new ImportFailure("Target TLS must explicitly verify its certificate.");
  return { host: value.host, port, user: value.user, password: value.password, database: value.database,
    ssl: { rejectUnauthorized: true, ...(value.ssl.ca ? { ca: value.ssl.ca } : {}) }, application_name: "webncrew_migration", connectionTimeoutMillis: 15000 };
}

async function readJson(filename, label) {
  try { return JSON.parse(await readFile(filename, "utf8")); }
  catch { throw new ImportFailure(`${label} could not be read as JSON.`); }
}

async function checkedSnapshotFile(snapshot, entry, table) {
  if (!entry || typeof entry.path !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0) throw new ImportFailure("Invalid snapshot file metadata.", { table });
  let filename;
  let data;
  try {
    filename = await realpath(path.resolve(snapshot, entry.path));
    const relative = path.relative(snapshot, filename);
    if (!relative || relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) throw new ImportFailure("Snapshot file escapes its directory.", { table });
    data = await readFile(filename);
  } catch (error) {
    if (error instanceof ImportFailure) throw error;
    throw new ImportFailure("Snapshot file could not be read.", { table });
  }
  if (data.length !== entry.bytes || createHash("sha256").update(data).digest("hex") !== entry.sha256) throw new ImportFailure("Snapshot file hash or byte count differs.", { table });
  return data;
}

/** Reads only the completed private export; never opens a MySQL connection. */
export async function readSnapshot(directory, omitExpiredCache = false) {
  const snapshot = await realpath(directory);
  const manifest = await readJson(path.join(snapshot, "manifest.json"), "Snapshot manifest");
  if (manifest.format !== "crew-center-mysql-jsonl" || manifest.version !== 1 || manifest.command !== "export" || manifest.complete !== true
    || manifest.rowEncoding?.kind !== "column-ordered-json-array" || manifest.rowEncoding?.jsonColumns !== "raw-json-strings"
    || manifest.source?.exportSessionTimeZone !== "+00:00" || manifest.snapshot?.allBaseTablesInnoDb !== true || !Array.isArray(manifest.tables)
    || !Array.isArray(manifest.views) || manifest.views.length) throw new ImportFailure("A complete, reviewed InnoDB JSONL export without views is required.");
  const names = manifest.tables.map(table => table.name);
  if (names.length !== TABLE_ORDER.length || new Set(names).size !== names.length || TABLE_ORDER.some(name => !names.includes(name))) throw new ImportFailure("Snapshot table set differs from the reviewed baseline.");
  const cutoff = canonicalDatetime(manifest.snapshot.serverTimeUtc);
  const cutoffMilliseconds = Date.parse(cutoff);
  if (!Number.isSafeInteger(cutoffMilliseconds)) throw new ImportFailure("Snapshot UTC cutoff is invalid.");
  const tables = [];
  let backupRows = 0;
  let omittedRows = 0;
  for (const name of TABLE_ORDER) {
    const table = manifest.tables.find(item => item.name === name);
    if (!Array.isArray(table.columns) || !table.columns.length || !Array.isArray(table.primaryKey) || !table.primaryKey.length
      || new Set(table.columns.map(column => column.name)).size !== table.columns.length
      || table.primaryKey.some(key => !table.columns.some(column => column.name === key))) throw new ImportFailure("Invalid source column or primary-key metadata.", { table: name });
    for (const column of table.columns) { quotePgIdentifier(column.name); if (typeof column.dataType !== "string") throw new ImportFailure("Missing source column type.", { table: name }); }
    await checkedSnapshotFile(snapshot, table.ddl, name);
    const data = await checkedSnapshotFile(snapshot, table.data, name);
    // Only ASCII LF delimits records. U+2028/U+2029 inside text cells are data.
    const text = data.toString("utf8");
    const lines = text === "" ? [] : (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n");
    const expectedCount = String(table.rowCount);
    if (!/^\d+$/.test(expectedCount) || BigInt(expectedCount) !== BigInt(lines.length) || String(table.data.rowCount) !== expectedCount) throw new ImportFailure("Snapshot row count differs from its manifest.", { table: name });
    const rows = lines.map(line => {
      let row;
      try { row = JSON.parse(line); } catch { throw new ImportFailure("Snapshot contains an invalid JSONL row.", { table: name }); }
      if (!Array.isArray(row) || row.length !== table.columns.length) throw new ImportFailure("Snapshot row differs from its column list.", { table: name });
      return row;
    });
    backupRows += rows.length;
    const expiryIndex = table.columns.findIndex(column => column.name === "expires_at");
    const included = omitExpiredCache && name === "api_cache" ? rows.filter(row => {
      if (expiryIndex < 0) throw new ImportFailure("Cache expiry column is missing.", { table: name });
      return BigInt(canonicalInteger(row[expiryIndex])) > BigInt(cutoffMilliseconds);
    }) : rows;
    omittedRows += rows.length - included.length;
    tables.push({ ...table, rows: included, backupRowCount: rows.length });
  }
  if (String(backupRows) !== String(manifest.counts?.rows) || manifest.counts?.tables !== tables.length) throw new ImportFailure("Snapshot total row count differs from its manifest.");
  return { tables, backupRows, importedRows: backupRows - omittedRows, omittedExpiredCacheRows: omittedRows, cutoffUtc: cutoff };
}

async function targetMetadata(client) {
  const { rows: selection } = await client.query('SELECT current_schema() AS "schema", current_database() AS "database"');
  if (!selection[0]?.schema) throw new ImportFailure("Target schema is unavailable.");
  const { rows: tables } = await client.query("SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY table_name");
  const { rows: columns } = await client.query(`SELECT table_name AS "tableName", column_name AS name, data_type AS "dataType",
    is_nullable AS "isNullable", column_default AS "defaultValue", is_identity AS "isIdentity"
    FROM information_schema.columns WHERE table_schema = current_schema() ORDER BY table_name, ordinal_position`);
  return { schema: selection[0].schema, database: selection[0].database, tables: tables.map(table => table.name), columns };
}

export function validateMappings(plan, target) {
  if (target.tables.length !== TABLE_ORDER.length || TABLE_ORDER.some(name => !target.tables.includes(name))) throw new ImportFailure("Target table set differs from the reviewed baseline.");
  for (const table of plan.tables) {
    const columns = target.columns.filter(column => column.tableName === table.name);
    for (const source of table.columns) {
      const column = columns.find(candidate => candidate.name === source.name);
      if (!column) throw new ImportFailure("A source column has no target mapping.", { table: table.name, column: source.name });
      const type = source.dataType.toLowerCase();
      const boolean = BOOLEAN_COLUMNS.has(`${table.name}.${source.name}`);
      const compatible = boolean ? column.dataType === "boolean"
        : /^(?:tinyint|smallint|mediumint|int|integer|bigint)$/.test(type) ? INTEGER_TARGETS.has(column.dataType)
        : ["decimal", "numeric"].includes(type) ? column.dataType === "numeric"
        : ["float", "double", "real"].includes(type) ? ["double precision", "real"].includes(column.dataType)
        : type === "date" ? column.dataType === "date"
        : ["datetime", "timestamp"].includes(type) ? column.dataType === "timestamp with time zone"
        : type === "json" ? column.dataType === "json"
        : ["char", "varchar", "tinytext", "text", "mediumtext", "longtext", "enum", "set"].includes(type) && TEXT_TARGETS.has(column.dataType);
      if (!compatible) throw new ImportFailure("Unsupported source-to-target column type mapping.", { table: table.name, column: source.name });
    }
    for (const column of columns.filter(column => !table.columns.some(source => source.name === column.name))) {
      const newNullablePilotField = table.name === "pilots" && ["violand", "grade"].includes(column.name) && column.isNullable === "YES" && column.defaultValue === null;
      const generatedTokenId = table.name === "tokens" && column.name === "id" && column.isIdentity === "YES" && column.dataType === "integer";
      if (!newNullablePilotField && !generatedTokenId) throw new ImportFailure("An unexpected target-only column requires review.", { table: table.name, column: column.name });
    }
    table.targetColumns = table.columns.map(source => columns.find(column => column.name === source.name));
    // Check all typed values/ranges before the first INSERT, not just per batch.
    for (const row of table.rows) for (let index = 0; index < table.columns.length; index += 1) {
      try { parameterCell(table.name, table.columns[index], row[index], table.targetColumns[index]); }
      catch (error) {
        if (error instanceof ImportFailure) throw new ImportFailure(error.message, { table: table.name, column: table.columns[index].name });
        throw error;
      }
    }
  }
}

async function requireEmptyTarget(client, plan, schema) {
  for (const table of plan.tables) {
    const qualified = `${quotePgIdentifier(schema)}.${quotePgIdentifier(table.name)}`;
    if (table.name === "options") {
      const { rows } = await client.query(`SELECT name, value FROM ${qualified}`);
      if (rows.length && (rows.length !== 1 || rows[0].name !== "live_scheduling_mutex" || rows[0].value !== "1")) throw new ImportFailure("Target contains existing rows; nothing will be replaced.", { table: table.name, rowCount: rows.length });
    } else {
      const { rows } = await client.query(`SELECT COUNT(*)::text AS count FROM ${qualified}`);
      if (rows[0]?.count !== "0") throw new ImportFailure("Target contains existing rows; nothing will be replaced.", { table: table.name, rowCount: rows[0]?.count });
    }
  }
  // This is the only DELETE in this utility; it is inside the import transaction.
  await client.query(`DELETE FROM ${quotePgIdentifier(schema)}.options WHERE name = $1 AND value = $2`, ["live_scheduling_mutex", "1"]);
}

export function targetSelectSql(table, schema) {
  const select = table.columns.map((source, index) => {
    const column = quotePgIdentifier(source.name);
    return table.targetColumns[index].dataType === "timestamp with time zone"
      ? `TO_CHAR(source.${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US') AS ${column}`
      : `source.${column}::text AS ${column}`;
  }).join(", ");
  const order = table.primaryKey.map(name => {
    const target = table.targetColumns[table.columns.findIndex(column => column.name === name)];
    // Qualify the base column: an unqualified alias here would order IDs as text.
    return `source.${quotePgIdentifier(name)}${TEXT_TARGETS.has(target.dataType) ? ' COLLATE "C"' : ""} ASC`;
  }).join(", ");
  return `SELECT ${select} FROM ${quotePgIdentifier(schema)}.${quotePgIdentifier(table.name)} AS source ORDER BY ${order} LIMIT $1 OFFSET $2`;
}

async function verifyRows(client, plan, schema) {
  for (const table of plan.tables) {
    const qualified = `${quotePgIdentifier(schema)}.${quotePgIdentifier(table.name)}`;
    const { rows: counts } = await client.query(`SELECT COUNT(*)::text AS count FROM ${qualified}`);
    if (counts[0]?.count !== String(table.rows.length)) throw new ImportFailure("Target row count differs from the snapshot import plan.", { table: table.name, expectedCount: table.rows.length, actualCount: counts[0]?.count });
    for (let offset = 0; offset < table.rows.length; offset += BATCH_SIZE) {
      const { rows } = await client.query({ text: targetSelectSql(table, schema), values: [BATCH_SIZE, offset], rowMode: "array" });
      const expected = table.rows.slice(offset, offset + BATCH_SIZE);
      if (rows.length !== expected.length) throw new ImportFailure("Target row batch count differs.", { table: table.name, offset });
      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        if (rows[rowIndex].length !== table.columns.length) throw new ImportFailure("Target result shape differs from the source column list.", { table: table.name });
        for (let index = 0; index < table.columns.length; index += 1) {
          const source = canonicalCell(table.name, table.columns[index], expected[rowIndex][index], table.targetColumns[index]);
          const target = canonicalCell(table.name, table.columns[index], rows[rowIndex][index], table.targetColumns[index], true);
          if (source !== target) throw new ImportFailure("Imported cell differs from the snapshot.", { table: table.name, column: table.columns[index].name, rowOffset: offset + rowIndex });
        }
      }
    }
  }
}

export async function identityResetSql() {
  const sql = await readFile(new URL("../migrations/postgresql/002_reset_identity_sequences.sql", import.meta.url), "utf8");
  const uncommented = sql.replace(/--[^\n]*/g, "").trim();
  if (!/^DO \$\$[\s\S]*END \$\$;$/i.test(uncommented) || (uncommented.match(/\$\$/g) || []).length !== 2
    || /\b(?:DROP|TRUNCATE|DELETE|INSERT|UPDATE|ALTER|CREATE|GRANT|REVOKE|COMMIT|ROLLBACK)\b/i.test(uncommented)
    || !uncommented.includes("pg_get_serial_sequence") || !uncommented.includes("setval") || !uncommented.includes("current_schema()")) throw new ImportFailure("Identity reset SQL is not the reviewed standalone DO block.");
  return sql;
}

/** Only PostgreSQL is opened here; the source is the immutable private snapshot. */
export async function runSnapshotImport(options, dependencies = {}) {
  if (options.datetimeZone !== "UTC" || !["import", "verify"].includes(options.command) || (options.command === "verify" && options.commit)) throw new ImportFailure("Import requires an explicit UTC mapping and a valid mode.");
  const plan = await readSnapshot(options.snapshot, options.omitExpiredCache === true);
  const config = validateTargetConfiguration(await readJson(options.target, "Target configuration"));
  const client = dependencies.createClient ? dependencies.createClient(config) : new Client(config);
  let transactionOpen = false;
  let phase = "connecting";
  let currentTable;
  let commitAttempted = false;
  try {
    await client.connect();
    await client.query(options.command === "verify" ? "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY" : "BEGIN ISOLATION LEVEL REPEATABLE READ");
    transactionOpen = true;
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    phase = "checking target schema";
    const metadata = await targetMetadata(client);
    if (metadata.database !== config.database) throw new ImportFailure("Connected target database differs from the explicit configuration.");
    validateMappings(plan, metadata);
    if (options.command === "import") {
      phase = "checking empty target";
      await client.query(`LOCK TABLE ${TABLE_ORDER.map(table => `${quotePgIdentifier(metadata.schema)}.${quotePgIdentifier(table)}`).join(", ")} IN EXCLUSIVE MODE`);
      await requireEmptyTarget(client, plan, metadata.schema);
      phase = "importing";
      for (const table of plan.tables) {
        currentTable = table.name;
        for (let offset = 0; offset < table.rows.length; offset += BATCH_SIZE) {
          const batch = table.rows.slice(offset, offset + BATCH_SIZE);
          const parameters = batch.flatMap(row => row.map((cell, index) => parameterCell(table.name, table.columns[index], cell, table.targetColumns[index])));
          const values = batch.map((_row, rowIndex) => `(${table.columns.map((_column, columnIndex) => `$${rowIndex * table.columns.length + columnIndex + 1}`).join(", ")})`).join(", ");
          await client.query(`INSERT INTO ${quotePgIdentifier(metadata.schema)}.${quotePgIdentifier(table.name)} (${table.columns.map(column => quotePgIdentifier(column.name)).join(", ")}) VALUES ${values}`, parameters);
        }
      }
    }
    phase = "verifying every source column";
    currentTable = undefined;
    await verifyRows(client, plan, metadata.schema);
    if (options.command === "import" && options.commit === true) {
      phase = "resetting identities";
      await client.query(await identityResetSql());
      phase = "committing";
      commitAttempted = true;
      await client.query("COMMIT");
    } else await client.query("ROLLBACK");
    transactionOpen = false;
    return {
      mode: options.command === "verify" ? "verified" : options.commit ? "committed" : "rehearsed-and-rolled-back",
      backupRows: plan.backupRows, verifiedRows: plan.importedRows, omittedExpiredCacheRows: plan.omittedExpiredCacheRows,
      cacheCutoffUtc: options.omitExpiredCache ? plan.cutoffUtc : undefined,
      tables: plan.tables.map(table => ({ name: table.name, backupRows: table.backupRowCount, verifiedRows: table.rows.length })),
    };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    if (error instanceof ImportFailure) throw error;
    // Never include PostgreSQL messages/detail: constraint errors can contain PII.
    throw new ImportFailure("Target rejected the import or verification operation.", {
      phase, table: currentTable ?? error?.table, column: error?.column, constraint: error?.constraint,
      sqlstate: error?.code, commitAttempted,
    });
  } finally { await client.end().catch(() => undefined); }
}

export function safeFailureContext(error) {
  const context = error instanceof ImportFailure ? error.context : {};
  const safe = {};
  for (const key of ["table", "column", "constraint"]) {
    if (typeof context[key] === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(context[key])) safe[key] = context[key];
  }
  for (const key of ["rowCount", "expectedCount", "actualCount", "rowOffset", "offset"]) {
    if (typeof context[key] === "number" && Number.isSafeInteger(context[key]) && context[key] >= 0) safe[key] = context[key];
    else if (typeof context[key] === "string" && /^\d+$/.test(context[key])) safe[key] = context[key];
  }
  if (typeof context.sqlstate === "string" && /^[A-Z0-9]{5}$/.test(context.sqlstate)) safe.sqlstate = context.sqlstate;
  if (typeof context.phase === "string" && /^[a-z ]{1,60}$/.test(context.phase)) safe.phase = context.phase;
  if (context.commitAttempted === true) safe.commitAttempted = true;
  return safe;
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArguments(argv);
    if (options.help) {
      console.log("Usage: node scripts/import-mysql-snapshot.mjs [import|verify] --snapshot <private-export-directory> --target <PG-connection.json> --datetime-zone UTC [--omit-expired-cache] [--commit]");
      return;
    }
    console.log(JSON.stringify(await runSnapshotImport(options)));
  } catch (error) {
    console.error(error instanceof ImportFailure ? error.message : "Snapshot import/verification failed.", JSON.stringify(safeFailureContext(error)));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
