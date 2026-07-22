import { Sequelize } from "sequelize";
import { databaseSslOptions } from "./database-ssl.mjs";

// Database connection configuration
const sequelize = new Sequelize({
  host: process.env.DB_HOST,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  dialect: "mysql",
  dialectModule: require("mysql2"),
  dialectOptions: {
    ssl: {
      require: true,
      ...databaseSslOptions(),
    },
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  logging: false,
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
