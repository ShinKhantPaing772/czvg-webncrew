import { Sequelize, type Options } from "sequelize";
import { postgresDatabaseConfiguration } from "./database-config.mjs";

// Database connection configuration
const sequelize = new Sequelize({
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
