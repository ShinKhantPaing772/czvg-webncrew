import { DataTypes, Model } from "sequelize";
import sequelize from "../database";

class Aircraft extends Model {
  declare id: number;
  declare name: string;
  declare ifaircraftid: string;
  declare liveryname: string;
  declare ifliveryid: string;
  declare notes: string;
  declare rankreq: number;
  declare awardreq: number;
  declare status: number;
}
Aircraft.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    ifaircraftid: { type: DataTypes.TEXT, allowNull: false },
    liveryname: { type: DataTypes.TEXT },
    ifliveryid: { type: DataTypes.TEXT },
    notes: { type: DataTypes.STRING(12) },
    rankreq: { type: DataTypes.INTEGER },
    awardreq: { type: DataTypes.INTEGER },
    status: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  },
  { sequelize, modelName: "Aircraft", tableName: "aircraft", timestamps: false }
);

class Rank extends Model {
  declare id: number;
  declare name: string;
  declare timereq: number;
}
Rank.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    timereq: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, modelName: "Rank", tableName: "ranks", timestamps: false }
);

class Award extends Model {
  declare id: number;
  declare name: string;
  declare description: string;
  declare imageurl: string;
}
Award.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    description: { type: DataTypes.TEXT },
    imageurl: { type: DataTypes.TEXT, allowNull: false },
  },
  { sequelize, modelName: "Award", tableName: "awards", timestamps: false }
);

class Pilot extends Model {
  declare id: number;
  declare callsign: string;
  declare name: string;
  declare ifc: string;
  declare ifuserid: string;
  declare email: string;
  declare password: string;
  declare transhours: number;
  declare transflights: number;
  declare notes: string;
  declare status: number;
  declare joined: Date;
}
Pilot.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    callsign: { type: DataTypes.STRING(120), allowNull: false },
    name: { type: DataTypes.TEXT, allowNull: false },
    ifc: { type: DataTypes.TEXT, allowNull: false },
    ifuserid: { type: DataTypes.STRING(36) },
    email: { type: DataTypes.TEXT, allowNull: false },
    password: { type: DataTypes.TEXT, allowNull: false },
    transhours: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    transflights: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    notes: { type: DataTypes.STRING(1200), allowNull: false, defaultValue: "" },
    status: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    joined: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  { sequelize, modelName: "Pilot", tableName: "pilots", timestamps: false }
);

class AwardGranted extends Model {
  declare id: number;
  declare awardid: number;
  declare pilotid: number;
  declare dateawarded: Date;
}
AwardGranted.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    awardid: { type: DataTypes.INTEGER, allowNull: false },
    pilotid: { type: DataTypes.INTEGER, allowNull: false },
    dateawarded: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    modelName: "AwardGranted",
    tableName: "awards_granted",
    timestamps: false,
  }
);

class Pirep extends Model {
  declare id: number;
  declare flightnum: string;
  declare departure: string;
  declare arrival: string;
  declare flighttime: number;
  declare pilotid: number;
  declare date: Date;
  declare aircraftid: number;
  declare fuelused: number;
  declare multi: string;
  declare status: number;
}
Pirep.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    flightnum: { type: DataTypes.TEXT },
    departure: { type: DataTypes.STRING(4), allowNull: false },
    arrival: { type: DataTypes.STRING(4), allowNull: false },
    flighttime: { type: DataTypes.INTEGER, allowNull: false },
    pilotid: { type: DataTypes.INTEGER, allowNull: false },
    date: { type: DataTypes.DATE, allowNull: false },
    aircraftid: { type: DataTypes.INTEGER, allowNull: false },
    fuelused: { type: DataTypes.INTEGER, allowNull: false },
    multi: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  { sequelize, modelName: "Pirep", tableName: "pireps", timestamps: false }
);

class Multiplier extends Model {
  declare id: number;
  declare code: number;
  declare multiplier: number;
  declare name: string;
  declare minrankid: number;
}
Multiplier.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    code: { type: DataTypes.INTEGER, allowNull: false },
    multiplier: { type: DataTypes.DOUBLE, allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    minrankid: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    modelName: "Multiplier",
    tableName: "multipliers",
    timestamps: false,
  }
);

class Permission extends Model {
  declare id: number;
  declare name: string;
  declare userid: number;
}
Permission.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(120), allowNull: false },
    userid: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "Permission",
    tableName: "permissions",
    timestamps: false,
  }
);

class Route extends Model {
  declare id: number;
  declare fltnum: string;
  declare dep: string;
  declare arr: string;
  declare duration: number;
  declare notes: string;
  Aircraft: any;
}
Route.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    fltnum: { type: DataTypes.TEXT },
    dep: { type: DataTypes.STRING(4), allowNull: false },
    arr: { type: DataTypes.STRING(4), allowNull: false },
    duration: { type: DataTypes.INTEGER, allowNull: false },
    notes: { type: DataTypes.TEXT },
  },
  { sequelize, modelName: "Route", tableName: "routes", timestamps: false }
);

class RouteAircraft extends Model {
  declare id: number;
  declare routeid: number;
  declare aircraftid: number;
}
RouteAircraft.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    routeid: { type: DataTypes.INTEGER, allowNull: false },
    aircraftid: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "RouteAircraft",
    tableName: "route_aircraft",
    timestamps: false,
  }
);

class News extends Model {
  declare id: number;
  declare subject: string;
  declare content: string;
  declare author: string;
  declare dateposted: Date;
  declare status: number;
}
News.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    subject: { type: DataTypes.TEXT, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
    author: { type: DataTypes.TEXT },
    dateposted: { type: DataTypes.DATE },
    status: { type: DataTypes.INTEGER },
  },
  { sequelize, modelName: "News", tableName: "news", timestamps: false }
);

class Notification extends Model {
  declare id: number;
  declare pilotid: number;
  declare icon: string;
  declare subject: string;
  declare content: string;
  declare datetime: Date;
}
Notification.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    pilotid: { type: DataTypes.INTEGER, allowNull: false },
    icon: { type: DataTypes.STRING(20), allowNull: false },
    subject: { type: DataTypes.STRING(20), allowNull: false },
    content: { type: DataTypes.STRING(60), allowNull: false },
    datetime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "Notification",
    tableName: "notifications",
    timestamps: false,
  }
);

class PirepComment extends Model {
  declare id: number;
  declare pirepid: number;
  declare userid: number;
  declare comment: string;
  declare date: Date;
}
PirepComment.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    pirepid: { type: DataTypes.INTEGER, allowNull: false },
    userid: { type: DataTypes.INTEGER, allowNull: false },
    comment: { type: DataTypes.TEXT, allowNull: false },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "PirepComment",
    tableName: "pirep_comments",
    timestamps: false,
  }
);

// Associations
Aircraft.belongsTo(Rank, { foreignKey: "rankreq" });
Aircraft.belongsTo(Award, { foreignKey: "awardreq" });
Pilot.hasMany(Award, { foreignKey: "pilotid" });
Award.belongsToMany(Pilot, { through: AwardGranted, foreignKey: "awardid" });
Pirep.belongsTo(Pilot, { foreignKey: "pilotid" });
Pirep.belongsTo(Aircraft, { foreignKey: "aircraftid" });
Route.belongsToMany(Aircraft, {
  through: RouteAircraft,
  foreignKey: "routeid",
});
Pilot.hasMany(Permission, { foreignKey: "userId" });
Permission.belongsTo(Pilot, { foreignKey: "userId" });

import Token from "./token";
import OTP from "./otp";

export const models = {
  Aircraft,
  Rank,
  Award,
  Pilot,
  AwardGranted,
  Pirep,
  Multiplier,
  Permission,
  Route,
  RouteAircraft,
  News,
  Notification,
  PirepComment,
  Token,
  OTP,
};
