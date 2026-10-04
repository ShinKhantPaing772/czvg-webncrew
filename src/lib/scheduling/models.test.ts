import { readFileSync } from "node:fs";
import type { Model, ModelStatic } from "sequelize";
import { afterAll, describe, expect, it, vi } from "vitest";

const networkAttempts = vi.hoisted(() => ({ query: vi.fn(), authenticate: vi.fn() }));

vi.mock("@/lib/database", async () => {
  const { Sequelize } = await import("sequelize");
  const database = new Sequelize("offline_model_regression", "unused", "unused", {
    dialect: "mysql", host: "127.0.0.1", logging: false,
  });
  vi.spyOn(database, "query").mockImplementation(async () => {
    networkAttempts.query();
    throw new Error("Model schema regression tests must never execute a database query");
  });
  vi.spyOn(database, "authenticate").mockImplementation(async () => {
    networkAttempts.authenticate();
    throw new Error("Model schema regression tests must never connect to a database");
  });
  return { default: database };
});

// Initialize the real models and associations. Mocking these models would hide
// Sequelize's mutation of reused attribute descriptors, which this test prevents.
import { IfLiveConnection, IfLiveOutbox, LiveAircraft, LiveFlight, LiveFlightMember, LiveScheduleEvent } from "./models";
import { DEFAULT_FLIGHT_TYPE, FLIGHT_TYPES } from "./flight-types";

const models: ModelStatic<Model>[] = [LiveAircraft, LiveFlight, LiveFlightMember, LiveScheduleEvent, IfLiveConnection, IfLiveOutbox];
const schemas = [
  { name: "live scheduling migrations", sql: ["20261002_live_scheduling.sql", "20261004_optional_live_flight_times.sql", "20261004_live_flight_types.sql"].map(name => readFileSync(new URL(`../../../migrations/${name}`, import.meta.url), "utf8")).join("\n") },
  { name: "fresh database schema", sql: readFileSync(new URL("../../../crewcenterdb.sql", import.meta.url), "utf8") },
];

function tableColumns(sql: string, table: string) {
  const create = sql.match(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? \`${table}\` \\(([\\s\\S]*?)\\) ENGINE=InnoDB;`));
  if (!create) throw new Error(`Expected ${table} in the supplied SQL schema`);
  const columns = [...create[1].matchAll(/^\s*`([^`]+)`\s+/gm)].map(match => match[1]);
  for (const alter of sql.matchAll(new RegExp(`ALTER TABLE \`${table}\`([\\s\\S]*?);`, "g"))) {
    columns.push(...[...alter[1].matchAll(/ADD COLUMN `([^`]+)`/g)].map(match => match[1]));
  }
  return columns.sort();
}

afterAll(async () => { await LiveAircraft.sequelize?.close(); });

describe("real Sequelize scheduling model field mappings", () => {
  for (const schema of schemas) {
    it(`keeps the allowed flight types aligned with the ${schema.name}`, () => {
      const check = schema.sql.match(/CONSTRAINT `live_flights_flight_type` CHECK \(CAST\(`flight_type` AS BINARY\) IN \(([^)]+)\)\)/)?.[1];
      expect(check).toBeDefined();
      expect([...check!.matchAll(/'([^']+)'/g)].map(match => match[1]).sort()).toEqual(FLIGHT_TYPES.map(type => type.value).sort());
    });
    for (const model of models) {
      const table = model.getTableName();
      const tableName = typeof table === "string" ? table : table.tableName;
      it(`matches ${tableName} physical columns in the ${schema.name}`, () => {
        const attributes = model.getAttributes();
        const physicalFields = Object.entries(attributes).map(([attributeName, attribute]) => attribute.field || attributeName);
        expect(physicalFields.sort()).toEqual(tableColumns(schema.sql, tableName));
        // All scheduling attributes use their SQL names. A shared DATE descriptor
        // must not redirect reviewed_at/expires_at/lease_until to another column.
        for (const [attributeName, attribute] of Object.entries(attributes)) {
          expect(attribute.field || attributeName, `${tableName}.${attributeName}`).toBe(attributeName);
        }
      });
    }
  }

  it("keeps each nullable timestamp mapped to its own physical column", () => {
    const nullableTimestampModels: Array<[ModelStatic<Model>, string[]]> = [
      [LiveFlight, ["scheduled_departure", "scheduled_arrival", "reviewed_at", "actual_departure_at", "actual_arrival_at"]],
      [LiveFlightMember, ["reviewed_at"]],
      [IfLiveConnection, ["expires_at"]],
      [IfLiveOutbox, ["lease_until"]],
    ];
    for (const [model, columns] of nullableTimestampModels) {
      for (const column of columns) {
        const attribute = model.getAttributes()[column];
        expect(attribute.field).toBe(column);
        expect(attribute.field).not.toBe("location_updated_at");
      }
    }
    expect(LiveAircraft.getAttributes().location_updated_at.field).toBe("location_updated_at");
  });

  it("initializes all models and associations without database access", () => {
    expect(networkAttempts.query).not.toHaveBeenCalled();
    expect(networkAttempts.authenticate).not.toHaveBeenCalled();
  });

  it("defaults flight types to Commercial and validates the shared supported options", async () => {
    expect(LiveFlight.build().flight_type).toBe(DEFAULT_FLIGHT_TYPE);
    for (const { value } of FLIGHT_TYPES) await expect(LiveFlight.build({ flight_type: value }).validate({ fields: ["flight_type"] })).resolves.toBeDefined();
    for (const value of ["passenger", "Commercial", "other ", null]) {
      await expect(LiveFlight.build({ flight_type: value }).validate({ fields: ["flight_type"] })).rejects.toMatchObject({ name: "SequelizeValidationError" });
    }
  });
});
