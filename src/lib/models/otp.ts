import { DataTypes, Model } from "sequelize";
import sequelize from "../database"; // adjust the path to your sequelize instance

class OTP extends Model {
  public id!: number;
  public email!: string;
  public otp!: string;
  public expires!: Date;
  public createdAt!: Date;
  public updatedAt!: Date;
}

OTP.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    otp: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    expires: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "OTP",
    tableName: "otps",
    timestamps: true,
  }
);

export default OTP;
