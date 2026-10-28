#!/usr/bin/env node

/**
 * CLI script to backfill awards for all existing pilots based on historical PIREP records.
 * Run with: node scripts/backfill-awards.mjs
 */

import process from "node:process";
import nextEnv from "@next/env";
import mysql from "mysql2/promise";
import { databaseSslOptions } from "../src/lib/database-ssl.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

function databaseConfiguration() {
  const port = Number(process.env.DB_PORT || 3306);
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "crewcenter",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "crewcenter",
    port,
    ssl: databaseSslOptions(),
  };
}

function parseCriteria(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function evaluateCriteria(criteria, stats) {
  switch (criteria.type) {
    case "hours": {
      const target = Number(criteria.threshold || 0);
      const current = Math.round(stats.totalHours * 10) / 10;
      return { meets: current >= target };
    }
    case "flights": {
      const target = Number(criteria.threshold || 0);
      return { meets: stats.totalFlights >= target };
    }
    case "airport": {
      const icao = String(criteria.icao || "").toUpperCase();
      const target = Number(criteria.count || 1);
      const current = stats.airportCounts.get(icao) || 0;
      return { meets: current >= target };
    }
    case "route": {
      const [apt1, apt2] = (criteria.airports || []).map((a) =>
        String(a).toUpperCase(),
      );
      const target = Number(criteria.count || 1);
      let current = 0;
      if (apt1 && apt2) {
        current = stats.routeCounts.get(`${apt1}-${apt2}`) || 0;
      }
      return { meets: current >= target };
    }
    case "aircraft": {
      const pattern = String(criteria.match || "").toUpperCase();
      const target = Number(criteria.count || 1);
      let current = 0;
      const regex = new RegExp(pattern, "i");
      for (const [name, count] of stats.aircraftCounts.entries()) {
        if (regex.test(name)) {
          current += count;
        }
      }
      return { meets: current >= target };
    }
    case "single_duration_hours": {
      const target = Number(criteria.threshold || 10);
      const current = Math.round(stats.maxSingleDurationHours * 10) / 10;
      return { meets: current >= target };
    }
    case "night_flights": {
      const target = Number(criteria.count || 3);
      return { meets: stats.nightFlights >= target };
    }
    case "airports_multi": {
      const airports = (criteria.airports || []).map((a) =>
        String(a).toUpperCase(),
      );
      const target = Number(criteria.count || 1);
      let current = 0;
      for (const icao of airports) {
        current += stats.airportCounts.get(icao) || 0;
      }
      return { meets: current >= target };
    }
    case "clean_streak": {
      const target = Number(criteria.count || 20);
      return { meets: stats.totalFlights >= target };
    }
    case "membership_days": {
      const target = Number(criteria.days || 365);
      return { meets: stats.membershipDays >= target };
    }
    case "manual":
    default:
      return { meets: false };
  }
}

async function main() {
  console.log("Starting retroactive award backfill scan...");

  const connection = await mysql.createConnection(databaseConfiguration());

  try {
    try {
      const [columns] = await connection.query("SHOW COLUMNS FROM `awards`");
      const existingColNames = new Set(
        columns.map((c) => String(c.Field).toLowerCase()),
      );

      const alters = [];
      if (!existingColNames.has("name_zh")) {
        alters.push("ADD COLUMN `name_zh` VARCHAR(255) NULL");
      }
      if (!existingColNames.has("description_zh")) {
        alters.push("ADD COLUMN `description_zh` TEXT NULL");
      }
      if (!existingColNames.has("category")) {
        alters.push(
          "ADD COLUMN `category` VARCHAR(50) NOT NULL DEFAULT 'milestone'",
        );
      }
      if (!existingColNames.has("criteria")) {
        alters.push("ADD COLUMN `criteria` JSON NULL");
      }

      if (alters.length > 0) {
        await connection.query(`ALTER TABLE \`awards\` ${alters.join(", ")}`);
        console.log(`✓ Added missing columns: ${alters.join(", ")}`);
      }
    } catch (schemaErr) {
      console.log("ℹ Note on column check:", schemaErr.message || schemaErr);
    }

    const [pilots] = await connection.query(`
      SELECT id, callsign, name, joined
      FROM pilots
      ORDER BY id ASC
    `);

    const [awards] = await connection.query(`
      SELECT id, name, category, criteria
      FROM awards
      ORDER BY id ASC
    `);

    console.log(`Found ${pilots.length} pilots and ${awards.length} awards.`);

    let totalNewGrants = 0;
    let affectedPilots = 0;
    const now = new Date();

    for (const pilot of pilots) {
      const pilotId = Number(pilot.id);

      // 1. Fetch approved PIREPs with aircraft name
      const [pireps] = await connection.query(
        `
        SELECT p.id, p.departure, p.arrival, p.flighttime, p.date, a.name AS aircraft_name
        FROM pireps p
        LEFT JOIN aircraft a ON p.aircraftid = a.id
        WHERE p.pilotid = ? AND p.status = 1
      `,
        [pilotId],
      );

      let totalSeconds = 0;
      let maxSingleSeconds = 0;
      const airportCounts = new Map();
      const routeCounts = new Map();
      const aircraftCounts = new Map();
      let nightFlights = 0;

      for (const pirep of pireps) {
        const seconds = Number(pirep.flighttime || 0);
        totalSeconds += seconds;
        if (seconds > maxSingleSeconds) maxSingleSeconds = seconds;

        const dep = String(pirep.departure || "").trim().toUpperCase();
        const arr = String(pirep.arrival || "").trim().toUpperCase();

        if (dep) airportCounts.set(dep, (airportCounts.get(dep) || 0) + 1);
        if (arr) airportCounts.set(arr, (airportCounts.get(arr) || 0) + 1);

        if (dep && arr) {
          const pairKey1 = `${dep}-${arr}`;
          const pairKey2 = `${arr}-${dep}`;
          routeCounts.set(pairKey1, (routeCounts.get(pairKey1) || 0) + 1);
          if (pairKey1 !== pairKey2) {
            routeCounts.set(pairKey2, (routeCounts.get(pairKey2) || 0) + 1);
          }
        }

        const aircraftName = pirep.aircraft_name
          ? String(pirep.aircraft_name).toUpperCase()
          : "";
        if (aircraftName) {
          aircraftCounts.set(
            aircraftName,
            (aircraftCounts.get(aircraftName) || 0) + 1,
          );
        }

        if (pirep.date) {
          const flightDate = new Date(pirep.date);
          const hours = flightDate.getUTCHours();
          if (hours >= 21 || hours <= 5) {
            nightFlights += 1;
          }
        }
      }

      let membershipDays = 0;
      if (pilot.joined) {
        const joinedTime = new Date(pilot.joined).getTime();
        membershipDays = Math.max(
          0,
          Math.floor((Date.now() - joinedTime) / (1000 * 60 * 60 * 24)),
        );
      }

      const stats = {
        totalSeconds,
        totalHours: totalSeconds / 3600,
        totalFlights: pireps.length,
        maxSingleDurationHours: maxSingleSeconds / 3600,
        airportCounts,
        routeCounts,
        aircraftCounts,
        nightFlights,
        membershipDays,
      };

      // 2. Fetch already granted awards for this pilot
      const [existingGrants] = await connection.query(
        `SELECT awardid FROM awards_granted WHERE pilotid = ?`,
        [pilotId],
      );
      const ownedIds = new Set(existingGrants.map((g) => Number(g.awardid)));

      const grantsToInsert = [];
      const notificationsToInsert = [];
      const grantedNames = [];

      for (const award of awards) {
        const awardId = Number(award.id);
        if (ownedIds.has(awardId)) continue;

        const criteria = parseCriteria(award.criteria);
        if (!criteria || criteria.type === "manual") continue;

        const { meets } = evaluateCriteria(criteria, stats);
        if (meets) {
          ownedIds.add(awardId);
          grantsToInsert.push([awardId, pilotId, now]);
          notificationsToInsert.push([
            pilotId,
            "award",
            "获得新勋章",
            `祝贺你解锁了成就勋章【${award.name}】！`,
            now,
          ]);
          grantedNames.push(award.name);
        }
      }

      if (grantsToInsert.length > 0) {
        affectedPilots++;
        totalNewGrants += grantsToInsert.length;

        await connection.query(
          `INSERT IGNORE INTO awards_granted (awardid, pilotid, dateawarded) VALUES ?`,
          [grantsToInsert],
        );

        try {
          await connection.query(
            `INSERT INTO notifications (pilotid, icon, subject, content, datetime) VALUES ?`,
            [notificationsToInsert],
          );
        } catch {
          // Notifications table may have different constraints
        }

        console.log(
          `[Pilot #${pilot.id} - ${pilot.callsign}] Granted ${grantsToInsert.length} new awards:`,
          grantedNames.join(", "),
        );
      }
    }

    console.log("\n==========================================");
    console.log("Backfill Complete!");
    console.log(`Total Pilots Checked: ${pilots.length}`);
    console.log(`Pilots Awarded:       ${affectedPilots}`);
    console.log(`Total Awards Granted: ${totalNewGrants}`);
    console.log("==========================================");
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Fatal error during backfill:", err);
  process.exit(1);
});
