import { describe, expect, it } from "vitest";
import { databasePoolMax, postgresDatabaseConfiguration } from "./database-config.mjs";

describe("PostgreSQL connection configuration", () => {
  it("uses verified TLS and a small, on-demand pool by default", () => {
    const configuration = postgresDatabaseConfiguration({});
    expect(configuration).toMatchObject({
      dialect: "postgres", port: 5432, timezone: "+00:00",
      dialectOptions: { ssl: { rejectUnauthorized: true }, statement_timeout: 15000 },
      pool: { max: 3, min: 0 },
    });
  });

  it("accepts Aiven's custom port and PEM certificate", () => {
    const configuration = postgresDatabaseConfiguration({ DB_PORT: "25432", DB_SSL_CA: "line-one\\nline-two", DB_POOL_MAX: "4" });
    expect(configuration.port).toBe(25432);
    expect(configuration.dialectOptions.ssl).toEqual({ rejectUnauthorized: true, ca: "line-one\nline-two" });
    expect(configuration.pool.max).toBe(4);
  });

  it("requires an explicit choice to disable TLS for a local database", () => {
    expect(postgresDatabaseConfiguration({ DB_SSL: "false" }).dialectOptions.ssl).toBe(false);
  });

  it.each(["0", "1", "-1", "2.5", "invalid"])("rejects pool size %s which cannot support the scheduling connection budget", value => {
    expect(() => databasePoolMax({ DB_POOL_MAX: value })).toThrow("DB_POOL_MAX");
  });
});
