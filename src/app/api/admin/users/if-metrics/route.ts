import { NextResponse } from "next/server";
import {
  findInfiniteFlightUser,
  getInfiniteFlightUser,
  InfiniteFlightApiError,
} from "@/lib/infinite-flight-api";
import { models } from "@/lib/models";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type UnknownRecord = Record<string, unknown>;

function getNestedValue(record: UnknownRecord, paths: string[][]) {
  for (const path of paths) {
    let current: unknown = record;

    for (const part of path) {
      if (!current || typeof current !== "object" || !(part in current)) {
        current = undefined;
        break;
      }

      current = (current as UnknownRecord)[part];
    }

    if (current !== undefined && current !== null) return current;
  }

  return null;
}

function normalizeInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const numberValue =
    typeof value === "number" ? value : Number(String(value).trim());

  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : null;
}

function extractInfiniteFlightMetrics(user: UnknownRecord) {
  const grade = normalizeInteger(
    getNestedValue(user, [
      ["grade"],
      ["userGrade"],
      ["statistics", "grade"],
      ["stats", "grade"],
    ]),
  );

  const violationsValue = getNestedValue(user, [
    ["violations"],
    ["violationCount"],
    ["totalViolations"],
    ["statistics", "violations"],
    ["statistics", "violationCount"],
    ["stats", "violations"],
    ["stats", "violationCount"],
  ]);

  const violations = Array.isArray(violationsValue)
    ? violationsValue.length
    : normalizeInteger(violationsValue);

  return { grade, violations };
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "users");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { success: false, message: "Missing pilot id" },
        { status: 400 },
      );
    }

    const pilot = await models.Pilot.findByPk(id, {
      attributes: ["id", "ifc"],
    });

    if (!pilot) {
      return NextResponse.json(
        { success: false, message: "Pilot not found" },
        { status: 404 },
      );
    }

    const ifc = String(pilot.get("ifc") || "").trim();
    if (!ifc) {
      return NextResponse.json(
        { success: false, message: "Pilot does not have an IFC username" },
        { status: 400 },
      );
    }

    const { data: ifData, cacheStatus } = await getInfiniteFlightUser(ifc);
    const ifUser = findInfiniteFlightUser(ifData.result, ifc);

    if (!ifUser || typeof ifUser !== "object") {
      return NextResponse.json(
        { success: false, message: "Infinite Flight user not found" },
        { status: 404 },
      );
    }

    const metrics = extractInfiniteFlightMetrics(ifUser as UnknownRecord);
    const updatedAt = new Date();

    const [application] = await models.Application.findOrCreate({
      where: { pilotid: id },
      defaults: {
        pilotid: id,
        exam_status: 0,
      },
    });

    await application.update({
      if_grade: metrics.grade,
      if_violations: metrics.violations,
      if_metrics_updated_at: updatedAt,
    });

    return NextResponse.json(
      {
        success: true,
        ifGrade: metrics.grade,
        ifViolations: metrics.violations,
        ifMetricsUpdatedAt: updatedAt,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Infinite-Flight-Cache": cacheStatus,
        },
      },
    );
  } catch (error) {
    console.error("Error refreshing Infinite Flight metrics", error);
    const status = error instanceof InfiniteFlightApiError ? error.status : 500;
    const message =
      error instanceof InfiniteFlightApiError
        ? error.message
        : "Failed to refresh Infinite Flight metrics";
    return NextResponse.json(
      { success: false, message },
      { status },
    );
  }
}
