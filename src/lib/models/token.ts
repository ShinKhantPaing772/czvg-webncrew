import { DataTypes, Model } from "sequelize";
import sequelize from "../database";

class Token extends Model {
  declare pilotId: number;
  declare token: string;
  declare expiresAt: Date;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare isRevoked: boolean;
}

Token.init(
  {
    pilotId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "pilots",
        key: "id",
      },
    },
    token: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: false,
      unique: true,
    },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    isRevoked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: "Token",
    tableName: "tokens",
    timestamps: true,
  }
);

export default Token;
