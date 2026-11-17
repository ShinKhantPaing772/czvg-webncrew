import { Sequelize, type Options } from "sequelize";
import { postgresDatabaseConfiguration } from "./database-config.mjs";

// Route bundles and development reloads in one process must share one pool.
const databaseGlobal = globalThis as typeof globalThis & {
  webncrewDatabase?: Sequelize;
};
const sequelize = databaseGlobal.webncrewDatabase ??= new Sequelize({
  ...postgresDatabaseConfiguration() as Options,
  dialectModule: require("pg"),
});

// Test the database connection
export async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log("Database connection successful");
    return true;
  } catch (error) {
    console.error("Error connecting to the database:", error);
    return false;
  }
}

// Export the sequelize instance for use in models
export default sequelize;
