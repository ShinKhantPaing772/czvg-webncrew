import { DataTypes, Model } from "sequelize";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";

// Sequelize annotates attribute definitions during init. Give every field its
// own object so one timestamp cannot inherit another field's column mapping.
const id = () => ({ type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true });
const date = () => ({ type: DataTypes.DATE(3), allowNull: true });
const timestamps = () => ({
  created_at: { type: DataTypes.DATE(3), allowNull: false, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE(3), allowNull: false, defaultValue: DataTypes.NOW },
});
const options = (tableName: string) => ({ sequelize, tableName, timestamps: true, createdAt: "created_at", updatedAt: "updated_at" });

export class LiveAircraft extends Model {
  declare id: number; declare registration: string; declare aircraft_id: number;
  declare current_airport: string | null; declare active: boolean;
  declare location_updated_by: number | null; declare location_updated_at: Date | null;
  declare if_aircraft_id: string | null;
}
LiveAircraft.init({
  id: id(), registration: { type: DataTypes.STRING(24), allowNull: false, unique: true },
  aircraft_id: { type: DataTypes.INTEGER, allowNull: false },
  current_airport: { type: DataTypes.CHAR(4), allowNull: true },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  location_updated_by: { type: DataTypes.INTEGER, allowNull: true }, location_updated_at: date(),
  if_aircraft_id: { type: DataTypes.CHAR(36), allowNull: true, unique: true }, ...timestamps(),
}, options("live_aircraft"));

export class LiveFlight extends Model {
  declare id: number; declare public_id: string; declare live_aircraft_id: number; declare captain_id: number;
  declare callsign: string | null; declare departure: string; declare arrival: string;
  declare queue_order: number | null; declare scheduled_departure: Date | null; declare scheduled_arrival: Date | null; declare status: string;
  declare notes: string | null; declare reviewed_by: number | null; declare reviewed_at: Date | null;
  declare review_reason: string | null; declare actual_departure_at: Date | null;
  declare actual_arrival_at: Date | null; declare actual_arrival: string | null;
  declare revision: number; declare published_revision: number; declare publishing_state: string;
  declare if_schedule_id: string | null; declare error: string | null;
  declare last_published_payload: Record<string, unknown> | null;
}
LiveFlight.init({
  id: id(), public_id: { type: DataTypes.CHAR(36), allowNull: false, unique: true },
  live_aircraft_id: { type: DataTypes.INTEGER, allowNull: false }, captain_id: { type: DataTypes.INTEGER, allowNull: false },
  callsign: { type: DataTypes.STRING(32), allowNull: true },
  departure: { type: DataTypes.CHAR(4), allowNull: false }, arrival: { type: DataTypes.CHAR(4), allowNull: false },
  queue_order: { type: DataTypes.INTEGER, allowNull: true },
  scheduled_departure: date(), scheduled_arrival: date(),
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: "pending" },
  notes: { type: DataTypes.TEXT, allowNull: true }, reviewed_by: { type: DataTypes.INTEGER, allowNull: true }, reviewed_at: date(),
  review_reason: { type: DataTypes.STRING(500), allowNull: true }, actual_departure_at: date(), actual_arrival_at: date(),
  actual_arrival: { type: DataTypes.CHAR(4), allowNull: true },
  revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  published_revision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  publishing_state: { type: DataTypes.STRING(24), allowNull: false, defaultValue: "local" },
  if_schedule_id: { type: DataTypes.CHAR(36), allowNull: true },
  error: { type: DataTypes.STRING(500), allowNull: true }, last_published_payload: { type: DataTypes.JSON, allowNull: true }, ...timestamps(),
}, { ...options("live_flights"), indexes: [{ unique: true, fields: ["live_aircraft_id", "queue_order"] }, { fields: ["live_aircraft_id", "status", "queue_order"] }] });

export class LiveFlightMember extends Model {
  declare id: number; declare flight_id: number; declare pilot_id: number; declare status: string;
  declare reviewed_by: number | null; declare reviewed_at: Date | null; declare review_reason: string | null;
}
LiveFlightMember.init({
  id: id(), flight_id: { type: DataTypes.INTEGER, allowNull: false }, pilot_id: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "pending" },
  reviewed_by: { type: DataTypes.INTEGER, allowNull: true }, reviewed_at: date(),
  review_reason: { type: DataTypes.STRING(500), allowNull: true }, ...timestamps(),
}, { ...options("live_flight_members"), indexes: [{ unique: true, fields: ["flight_id", "pilot_id"] }] });

export class LiveScheduleEvent extends Model {}
LiveScheduleEvent.init({
  id: id(), live_aircraft_id: { type: DataTypes.INTEGER, allowNull: false },
  flight_id: { type: DataTypes.INTEGER, allowNull: true }, actor_id: { type: DataTypes.INTEGER, allowNull: true },
  action: { type: DataTypes.STRING(40), allowNull: false }, details: { type: DataTypes.JSON, allowNull: true },
  created_at: { type: DataTypes.DATE(3), allowNull: false, defaultValue: DataTypes.NOW },
}, { sequelize, tableName: "live_schedule_events", timestamps: false });

export class IfLiveConnection extends Model {
  declare id: number; declare connected_by: number; declare organization_id: string | null;
  declare access_token_encrypted: string | null; declare refresh_token_encrypted: string | null;
  declare expires_at: Date | null; declare state: string;
}
IfLiveConnection.init({
  id: { type: DataTypes.INTEGER, primaryKey: true }, connected_by: { type: DataTypes.INTEGER, allowNull: false },
  organization_id: { type: DataTypes.CHAR(36), allowNull: true },
  access_token_encrypted: { type: DataTypes.TEXT, allowNull: true }, refresh_token_encrypted: { type: DataTypes.TEXT, allowNull: true },
  expires_at: date(), state: { type: DataTypes.STRING(24), allowNull: false }, ...timestamps(),
}, options("if_live_connections"));

export class IfLiveOutbox extends Model {
  declare id: number; declare flight_id: number; declare revision: number; declare state: string;
  declare action: string;
  declare attempts: number; declare next_attempt_at: Date; declare lease_until: Date | null; declare error: string | null;
}
IfLiveOutbox.init({
  id: id(), flight_id: { type: DataTypes.INTEGER, allowNull: false }, revision: { type: DataTypes.INTEGER, allowNull: false },
  state: { type: DataTypes.STRING(24), allowNull: false, defaultValue: "queued" },
  action: { type: DataTypes.STRING(16), allowNull: false, defaultValue: "sync" },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  next_attempt_at: { type: DataTypes.DATE(3), allowNull: false, defaultValue: DataTypes.NOW }, lease_until: date(),
  error: { type: DataTypes.STRING(500), allowNull: true }, ...timestamps(),
}, { ...options("if_live_outbox"), indexes: [{ unique: true, fields: ["flight_id", "revision"] }] });

LiveAircraft.belongsTo(models.Aircraft, { foreignKey: "aircraft_id", as: "catalog" });
LiveFlight.belongsTo(LiveAircraft, { foreignKey: "live_aircraft_id", as: "aircraft" });
LiveFlight.belongsTo(models.Pilot, { foreignKey: "captain_id", as: "captain" });
LiveFlight.hasMany(LiveFlightMember, { foreignKey: "flight_id", as: "members" });
LiveFlightMember.belongsTo(models.Pilot, { foreignKey: "pilot_id", as: "pilot" });
LiveFlightMember.belongsTo(LiveFlight, { foreignKey: "flight_id", as: "flight" });
IfLiveOutbox.belongsTo(LiveFlight, { foreignKey: "flight_id", as: "flight" });
