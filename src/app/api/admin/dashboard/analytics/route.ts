import { NextResponse } from "next/server";
import { QueryTypes } from "sequelize";

import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { hasPermission, requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CountRow = { label: string; value: number };
type TrendRow = { label: string; flights?: number; hours?: number; pilots?: number };

function dateParam(value: string | null, fallback: Date) {
  if (!value) return fallback;

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function permissionList(userPermissions: string[]) {
  const permissions = new Set(userPermissions);
  if (permissions.has("admin")) {
    return [
      "home",
      "pireps",
      "routes",
      "users",
      "aircrafts",
      "permissions",
      "admin",
    ];
  }

  return Array.from(permissions);
}

async function countByStatus(table: "pireps" | "pilots") {
  const rows = await sequelize.query<{ status: number; total: number }>(
    `
      SELECT status, COUNT(*) AS total
      FROM ${table}
      GROUP BY status
      ORDER BY status ASC
    `,
    { type: QueryTypes.SELECT },
  );

  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[String(row.status)] = Number(row.total) || 0;
    return acc;
  }, {});
}

async function topAirportRows(column: "departure" | "arrival" | "dep" | "arr") {
  const table = column === "departure" || column === "arrival" ? "pireps" : "routes";

  return sequelize.query<CountRow>(
    `
      SELECT ${column} AS label, COUNT(*) AS value
      FROM ${table}
      WHERE ${column} IS NOT NULL AND ${column} <> ''
      GROUP BY ${column}
      ORDER BY value DESC, label ASC
      LIMIT 6
    `,
    { type: QueryTypes.SELECT },
  );
}

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "home");
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 29);

    const startDate = dateParam(searchParams.get("startDate"), defaultStart);
    const endDate = dateParam(searchParams.get("endDate"), now);
    const start = dateOnly(startDate);
    const end = dateOnly(endDate);

    const [totalPilots, totalFlights, pendingPireps, totalRoutes, activeAircraft] =
      await Promise.all([
        models.Pilot.count({ where: { status: 1 } }),
        models.Pirep.count({ where: { status: 1 } }),
        models.Pirep.count({ where: { status: 0 } }),
        models.Route.count(),
        models.Aircraft.count({ where: { status: 1 } }),
      ]);

    const totalHoursRows = await sequelize.query<{ total: number | null }>(
      `
        SELECT SUM(flighttime) AS total
        FROM pireps
        WHERE status = 1
      `,
      { type: QueryTypes.SELECT },
    );
    const rangeRows = await sequelize.query<{
      approvedPireps: number;
      flightSeconds: number | null;
      newPilots: number;
    }>(
      `
        SELECT
          (
            SELECT COUNT(*)
            FROM pireps
            WHERE status = 1 AND date BETWEEN :start AND :end
          ) AS approvedPireps,
          (
            SELECT SUM(flighttime)
            FROM pireps
            WHERE status = 1 AND date BETWEEN :start AND :end
          ) AS flightSeconds,
          (
            SELECT COUNT(*)
            FROM pilots
            WHERE joined BETWEEN :startDateTime AND :endDateTime
          ) AS newPilots
      `,
      {
        replacements: {
          start,
          end,
          startDateTime: `${start} 00:00:00`,
          endDateTime: `${end} 23:59:59`,
        },
        type: QueryTypes.SELECT,
      },
    );

    const sections: Record<string, unknown> = {};
    const range = rangeRows[0] ?? {
      approvedPireps: 0,
      flightSeconds: 0,
      newPilots: 0,
    };

    sections.overview = {
      totalPilots,
      totalFlights,
      pendingPireps,
      totalHours: ((totalHoursRows[0]?.total ?? 0) as number) / 3600,
      totalRoutes,
      activeAircraft,
      range: {
        approvedPireps: Number(range.approvedPireps) || 0,
        flightHours: Number(range.flightSeconds || 0) / 3600,
        newPilots: Number(range.newPilots) || 0,
      },
      liveMapUrl: "https://map.ifczvg.com/",
    };

    if (hasPermission(auth.user, "pireps")) {
      const [statusCounts, trends, topDepartures, topArrivals] = await Promise.all([
        countByStatus("pireps"),
        sequelize.query<TrendRow>(
          `
            SELECT
              DATE_FORMAT(date, '%Y-%m-%d') AS label,
              COUNT(*) AS flights,
              SUM(flighttime) / 3600 AS hours
            FROM pireps
            WHERE status = 1 AND date BETWEEN :start AND :end
            GROUP BY DATE_FORMAT(date, '%Y-%m-%d')
            ORDER BY label ASC
          `,
          { replacements: { start, end }, type: QueryTypes.SELECT },
        ),
        topAirportRows("departure"),
        topAirportRows("arrival"),
      ]);

      sections.pireps = {
        statusCounts: {
          pending: statusCounts["0"] ?? 0,
          approved: statusCounts["1"] ?? 0,
          rejected: statusCounts["2"] ?? 0,
        },
        trends: trends.map((row) => ({
          label: row.label,
          flights: Number(row.flights) || 0,
          hours: Number(row.hours) || 0,
        })),
        topDepartures,
        topArrivals,
      };
    }

    if (hasPermission(auth.user, "users")) {
      const [pilotStatusCounts, growth, applicationRows, activeRows] =
        await Promise.all([
          countByStatus("pilots"),
          sequelize.query<TrendRow>(
            `
              SELECT DATE_FORMAT(joined, '%Y-%m-%d') AS label, COUNT(*) AS pilots
              FROM pilots
              WHERE joined BETWEEN :startDateTime AND :endDateTime
              GROUP BY DATE_FORMAT(joined, '%Y-%m-%d')
              ORDER BY label ASC
            `,
            {
              replacements: {
                startDateTime: `${start} 00:00:00`,
                endDateTime: `${end} 23:59:59`,
              },
              type: QueryTypes.SELECT,
            },
          ),
          sequelize.query<{
            examDeclared: number;
            scored: number;
            replaySubmitted: number;
            discordInvited: number;
          }>(
            `
              SELECT
                SUM(CASE WHEN exam_status >= 1 THEN 1 ELSE 0 END) AS examDeclared,
                SUM(CASE WHEN exam_score IS NOT NULL THEN 1 ELSE 0 END) AS scored,
                SUM(CASE WHEN flight_replay_url IS NOT NULL AND flight_replay_url <> '' THEN 1 ELSE 0 END) AS replaySubmitted,
                SUM(CASE WHEN discord_invite_url IS NOT NULL AND discord_invite_url <> '' THEN 1 ELSE 0 END) AS discordInvited
              FROM applications
            `,
            { type: QueryTypes.SELECT },
          ),
          sequelize.query<{ recentlyActive: number; inactive: number }>(
            `
              SELECT
                SUM(CASE WHEN lastFlight >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS recentlyActive,
                SUM(CASE WHEN lastFlight IS NULL OR lastFlight < DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS inactive
              FROM (
                SELECT p.id, MAX(pr.date) AS lastFlight
                FROM pilots p
                LEFT JOIN pireps pr ON pr.pilotid = p.id AND pr.status = 1
                WHERE p.status = 1
                GROUP BY p.id
              ) activity
            `,
            { type: QueryTypes.SELECT },
          ),
        ]);

      const applications = applicationRows[0] ?? {
        examDeclared: 0,
        scored: 0,
        replaySubmitted: 0,
        discordInvited: 0,
      };
      const activity = activeRows[0] ?? { recentlyActive: 0, inactive: 0 };

      sections.users = {
        pilotStatusCounts: {
          applicants: pilotStatusCounts["0"] ?? 0,
          active: pilotStatusCounts["1"] ?? 0,
          rejected: pilotStatusCounts["2"] ?? 0,
          suspended: pilotStatusCounts["3"] ?? 0,
        },
        applicationPipeline: [
          { label: "Exam declared", value: Number(applications.examDeclared) || 0 },
          { label: "Score received", value: Number(applications.scored) || 0 },
          { label: "Replay submitted", value: Number(applications.replaySubmitted) || 0 },
          { label: "Discord invited", value: Number(applications.discordInvited) || 0 },
        ],
        growth: growth.map((row) => ({
          label: row.label,
          pilots: Number(row.pilots) || 0,
        })),
        activity: {
          recentlyActive: Number(activity.recentlyActive) || 0,
          inactive: Number(activity.inactive) || 0,
        },
      };
    }

    if (hasPermission(auth.user, "routes")) {
      const [topDepartures, topArrivals, durationRows] = await Promise.all([
        topAirportRows("dep"),
        topAirportRows("arr"),
        sequelize.query<CountRow>(
          `
            SELECT bucket AS label, COUNT(*) AS value
            FROM (
              SELECT
                CASE
                  WHEN duration < 3600 THEN '< 01:00'
                  WHEN duration < 7200 THEN '01:00-02:00'
                  WHEN duration < 14400 THEN '02:00-04:00'
                  WHEN duration < 28800 THEN '04:00-08:00'
                  ELSE '08:00+'
                END AS bucket
              FROM routes
            ) buckets
            GROUP BY bucket
            ORDER BY FIELD(
              bucket,
              '< 01:00',
              '01:00-02:00',
              '02:00-04:00',
              '04:00-08:00',
              '08:00+'
            )
          `,
          { type: QueryTypes.SELECT },
        ),
      ]);

      sections.routes = {
        totalRoutes,
        topDepartures,
        topArrivals,
        durationBuckets: durationRows,
      };
    }

    if (hasPermission(auth.user, "aircrafts")) {
      const [liveryRows, usageRows] = await Promise.all([
        sequelize.query<CountRow>(
          `
            SELECT COALESCE(NULLIF(liveryname, ''), 'Unassigned') AS label, COUNT(*) AS value
            FROM aircraft
            WHERE status = 1
            GROUP BY COALESCE(NULLIF(liveryname, ''), 'Unassigned')
            ORDER BY value DESC, label ASC
            LIMIT 8
          `,
          { type: QueryTypes.SELECT },
        ),
        sequelize.query<CountRow>(
          `
            SELECT CONCAT(a.name, ' (', COALESCE(a.liveryname, 'No livery'), ')') AS label, COUNT(pr.id) AS value
            FROM pireps pr
            INNER JOIN aircraft a ON a.id = pr.aircraftid
            WHERE pr.status = 1
            GROUP BY a.id, a.name, a.liveryname
            ORDER BY value DESC, label ASC
            LIMIT 8
          `,
          { type: QueryTypes.SELECT },
        ),
      ]);

      sections.aircrafts = {
        activeAircraft,
        liveryBreakdown: liveryRows,
        usage: usageRows,
      };
    }

    if (hasPermission(auth.user, "permissions")) {
      const [adminCount, permissionRows] = await Promise.all([
        models.Permission.count({ distinct: true, col: "userid" }),
        sequelize.query<CountRow>(
          `
            SELECT name AS label, COUNT(DISTINCT userid) AS value
            FROM permissions
            GROUP BY name
            ORDER BY value DESC, label ASC
          `,
          { type: QueryTypes.SELECT },
        ),
      ]);

      sections.permissions = {
        adminCount,
        distribution: permissionRows,
      };
    }

    return NextResponse.json({
      success: true,
      permissions: permissionList(auth.user.permissions),
      range: { startDate: start, endDate: end },
      sections,
    });
  } catch (error) {
    console.error("Error fetching admin analytics:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch admin analytics" },
      { status: 500 },
    );
  }
}
