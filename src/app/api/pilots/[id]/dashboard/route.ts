import { NextResponse } from "next/server";
import { QueryTypes } from "sequelize";

import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { formatFlightTime } from "@/lib/utils/time";
import { hasPermission, requireAuth } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RankRecord = {
  id: number;
  name: string;
  timereq: number;
};

type SuggestionRow = {
  id: number;
  fltnum: string;
  dep: string;
  arr: string;
  duration: number;
  notes: string | null;
  aircraftId: number;
  aircraftName: string;
  liveryname: string | null;
  rankreq: number | null;
  awardreq: number | null;
};

function secondsToDurationInput(seconds: number) {
  return formatFlightTime(seconds || 0);
}

function formatHours(seconds: number) {
  return formatFlightTime(seconds || 0);
}

function toDateString(value: unknown) {
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const pilotId = Number(params.id);
    if (!Number.isInteger(pilotId) || pilotId <= 0) {
      return NextResponse.json({ error: "Invalid pilot id" }, { status: 400 });
    }

    const canViewDashboard =
      String(auth.user.id) === String(pilotId) ||
      hasPermission(auth.user, ["users", "pireps"]);

    if (!canViewDashboard) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pilot = await models.Pilot.findByPk(pilotId, {
      attributes: ["id", "name", "email", "callsign", "joined", "status"],
      raw: true,
    });

    if (!pilot) {
      return NextResponse.json({ error: "Pilot not found" }, { status: 404 });
    }

    const [
      approvedSeconds,
      approvedCount,
      pendingCount,
      rejectedCount,
      recentPireps,
      ranks,
      recentRouteRows,
    ] = await Promise.all([
      models.Pirep.sum("flighttime", { where: { pilotid: pilotId, status: 1 } }),
      models.Pirep.count({ where: { pilotid: pilotId, status: 1 } }),
      models.Pirep.count({ where: { pilotid: pilotId, status: 0 } }),
      models.Pirep.count({ where: { pilotid: pilotId, status: 2 } }),
      models.Pirep.findAll({
        where: { pilotid: pilotId },
        attributes: [
          "id",
          "flightnum",
          "departure",
          "arrival",
          "flighttime",
          "date",
          "aircraftid",
          "status",
        ],
        include: [
          {
            model: models.Aircraft,
            as: "Aircraft",
            attributes: ["id", "name", "liveryname"],
          },
        ],
        order: [["date", "DESC"]],
        limit: 8,
      }),
      models.Rank.findAll({
        attributes: ["id", "name", "timereq"],
        order: [["timereq", "ASC"]],
        raw: true,
      }) as Promise<RankRecord[]>,
      sequelize.query<{ dep: string; arr: string }>(
        `
          SELECT departure AS dep, arrival AS arr
          FROM pireps
          WHERE pilotid = :pilotId
          ORDER BY date DESC, id DESC
          LIMIT 12
        `,
        { replacements: { pilotId }, type: QueryTypes.SELECT },
      ),
    ]);

    const totalSeconds = Number(approvedSeconds || 0);
    const rankRows = ranks.length
      ? ranks
      : [{ id: 0, name: "Trainee", timereq: 0 }];
    let currentRank = rankRows[0];

    for (const rank of rankRows) {
      if (totalSeconds >= rank.timereq) currentRank = rank;
    }

    const currentRankIndex = rankRows.findIndex(
      (rank) => rank.id === currentRank.id,
    );
    const nextRank =
      currentRankIndex >= 0 && currentRankIndex < rankRows.length - 1
        ? rankRows[currentRankIndex + 1]
        : null;
    const rankSpan = nextRank
      ? Math.max(1, nextRank.timereq - currentRank.timereq)
      : 1;
    const progressToNextRank = nextRank
      ? Math.min(
          100,
          Math.max(0, ((totalSeconds - currentRank.timereq) / rankSpan) * 100),
        )
      : 100;
    const eligibleRankIds = rankRows
      .filter((rank) => totalSeconds >= rank.timereq)
      .map((rank) => rank.id);
    const recentRouteKeys = new Set(
      recentRouteRows.map((route) => `${route.dep}-${route.arr}`),
    );

    const suggestionRows = await sequelize.query<SuggestionRow>(
      `
        SELECT
          r.id,
          r.fltnum,
          r.dep,
          r.arr,
          r.duration,
          r.notes,
          a.id AS aircraftId,
          a.name AS aircraftName,
          a.liveryname,
          a.rankreq,
          a.awardreq
        FROM routes r
        INNER JOIN route_aircraft ra ON ra.routeid = r.id
        INNER JOIN aircraft a ON a.id = ra.aircraftid
        LEFT JOIN ranks rk ON rk.id = a.rankreq
        WHERE a.status = 1
          AND a.awardreq IS NULL
          AND (a.rankreq IS NULL OR rk.timereq <= :totalSeconds)
        ORDER BY
          CASE
            WHEN r.duration < 5400 THEN 1
            WHEN r.duration < 14400 THEN 2
            ELSE 3
          END ASC,
          r.duration ASC,
          r.fltnum ASC
        LIMIT 60
      `,
      { replacements: { totalSeconds }, type: QueryTypes.SELECT },
    );

    const suggestions: SuggestionRow[] = [];
    const selectedBuckets = new Set<number>();
    for (const route of suggestionRows) {
      const routeKey = `${route.dep}-${route.arr}`;
      if (recentRouteKeys.has(routeKey)) continue;
      const bucket = route.duration < 5400 ? 1 : route.duration < 14400 ? 2 : 3;
      if (selectedBuckets.has(bucket) && suggestions.length < 3) continue;
      suggestions.push(route);
      selectedBuckets.add(bucket);
      if (suggestions.length >= 6) break;
    }

    for (const route of suggestionRows) {
      if (suggestions.length >= 6) break;
      if (!suggestions.some((item) => item.id === route.id)) {
        suggestions.push(route);
      }
    }

    return NextResponse.json({
      pilot,
      standing: {
        status: Number((pilot as any).status),
        label:
          Number((pilot as any).status) === 1
            ? "Active"
            : Number((pilot as any).status) === 0
              ? "Applicant"
              : Number((pilot as any).status) === 2
                ? "Rejected"
                : "Review required",
      },
      rank: {
        current: {
          id: currentRank.id,
          name: currentRank.name,
          timeReq: currentRank.timereq,
          timeReqFormatted: formatHours(currentRank.timereq),
        },
        next: nextRank
          ? {
              id: nextRank.id,
              name: nextRank.name,
              timeReq: nextRank.timereq,
              timeReqFormatted: formatHours(nextRank.timereq),
              remainingSeconds: Math.max(0, nextRank.timereq - totalSeconds),
              remainingFormatted: formatHours(
                Math.max(0, nextRank.timereq - totalSeconds),
              ),
            }
          : null,
        progressToNextRank: Number(progressToNextRank.toFixed(2)),
        eligibleRankIds,
      },
      statistics: {
        approvedFlightSeconds: totalSeconds,
        totalFlightTime: formatHours(totalSeconds),
        approvedPireps: approvedCount,
        pendingPireps: pendingCount,
        rejectedPireps: rejectedCount,
      },
      recentPireps: recentPireps.map((pirep: any) => ({
        id: pirep.id,
        flightnum: pirep.flightnum,
        date: toDateString(pirep.date),
        departure: pirep.departure,
        arrival: pirep.arrival,
        flighttime: formatHours(pirep.flighttime || 0),
        flightTimeInput: secondsToDurationInput(pirep.flighttime || 0),
        status: pirep.status,
        aircraft: pirep.Aircraft
          ? {
              id: pirep.Aircraft.id,
              name: pirep.Aircraft.name,
              liveryname: pirep.Aircraft.liveryname,
            }
          : null,
      })),
      routeSuggestions: suggestions.map((route) => ({
        id: route.id,
        fltnum: route.fltnum,
        dep: route.dep,
        arr: route.arr,
        duration: formatHours(route.duration),
        durationSeconds: route.duration,
        flightTimeInput: secondsToDurationInput(route.duration),
        notes: route.notes,
        aircraft: {
          id: route.aircraftId,
          name: route.aircraftName,
          liveryname: route.liveryname,
          rankreq: route.rankreq,
          awardreq: route.awardreq,
        },
      })),
    });
  } catch (error) {
    console.error("[Pilot Dashboard] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
