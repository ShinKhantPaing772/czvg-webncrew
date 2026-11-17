import { databaseSslOptions } from "./database-ssl.mjs";

/** @param {Record<string, string | undefined>} [environment] */
export function databasePoolMax(environment = process.env) {
  const maximum = Number(environment.DB_POOL_MAX || 3);
  if (!Number.isSafeInteger(maximum) || maximum < 2) {
    throw new Error("DB_POOL_MAX must be an integer of at least 2");
  }
  return maximum;
}

/** @param {Record<string, string | undefined>} [environment] */
export function postgresDatabaseConfiguration(environment = process.env) {
  const port = Number(environment.DB_PORT || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT must be a valid TCP port");
  }
  return {
    host: environment.DB_HOST,
    username: environment.DB_USER,
    password: environment.DB_PASSWORD,
    database: environment.DB_NAME,
    port,
    dialect: "postgres",
    timezone: "+00:00",
    dialectOptions: {
      ssl: environment.DB_SSL === "false" ? false : databaseSslOptions(environment),
      application_name: "webncrew",
      statement_timeout: 15000,
    },
    pool: { max: databasePoolMax(environment), min: 0, acquire: 10000, idle: 1000, evict: 1000 },
    logging: false,
  };
}
