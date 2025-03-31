import sequelize, { testConnection } from "./database";
import { models } from "./models";

// Re-export the database connection and models
export { testConnection, models };
export default sequelize;
