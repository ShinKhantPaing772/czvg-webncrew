import { NextResponse } from "next/server";
import { Op } from "sequelize";
import type { Includeable } from "sequelize";
import { models } from "@/lib/models";
import { formatFlightTime } from "@/lib/utils/time";
import { hasPermission, requireAuth } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pirepInclude: Includeable[] = [
  {
    model: models.Aircraft,
    as: "Aircraft",
    attributes: ["id", "name", "liveryname"],
  },
  {
    model: models.PirepComment,
    as: "Comments",
    attributes: ["id", "userid", "content", "dateposted"],
    separate: true,
    order: [["id", "ASC"] as [string, string]],
    include: [
      {
        model: models.Pilot,
        as: "User",
        attributes: ["id", "callsign", "name"],
      },
    ],
  },
];

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

    const canViewPireps =
      String(auth.user.id) === String(pilotId) ||
      hasPermission(auth.user, ["pireps", "users"]);

    if (!canViewPireps) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const pageParam = Number(searchParams.get("page") ?? "1");
    const limitParam = Number(searchParams.get("limit") ?? "10");
    const searchQuery = searchParams.get("search")?.trim();
    const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit =
      Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 100
        ? limitParam
        : 10;
    const offset = (page - 1) * limit;
    const where: Record<string | symbol, unknown> = { pilotid: pilotId };

    if (searchQuery) {
      const normalizedSearch = searchQuery.toLowerCase();
      const statusSearch = [];
      if ("approved".includes(normalizedSearch)) statusSearch.push(1);
      if ("pending".includes(normalizedSearch)) statusSearch.push(0);
      if ("rejected".includes(normalizedSearch)) statusSearch.push(2);

      where[Op.or] = [
        { flightnum: { [Op.like]: `%${searchQuery}%` } },
        { departure: { [Op.like]: `%${searchQuery}%` } },
        { arrival: { [Op.like]: `%${searchQuery}%` } },
        { date: { [Op.like]: `%${searchQuery}%` } },
        { fuelused: { [Op.like]: `%${searchQuery}%` } },
        { multi: { [Op.like]: `%${searchQuery}%` } },
        { "$Aircraft.name$": { [Op.like]: `%${searchQuery}%` } },
        { "$Aircraft.liveryname$": { [Op.like]: `%${searchQuery}%` } },
        ...(statusSearch.length > 0 ? [{ status: { [Op.in]: statusSearch } }] : []),
      ];
    }

    const count = await models.Pirep.count({
      where,
      include: searchQuery
        ? [
            {
              model: models.Aircraft,
              as: "Aircraft",
              attributes: [],
            },
          ]
        : undefined,
    });

    const pireps = await models.Pirep.findAll({
      where,
      include: pirepInclude,
      attributes: [
        "id",
        "flightnum",
        "departure",
        "arrival",
        "flighttime",
        "date",
        "aircraftid",
        "fuelused",
        "multi",
        "status",
      ],
      order: [["date", "DESC"]],
      limit,
      offset,
      subQuery: false,
    });

    // Format flight time for each PIREP (for display)
    const formattedPireps = pireps.map((pirep) => ({
      ...pirep.get(),
      flighttime: formatFlightTime(pirep.flighttime || 0),
    }));

    const approvedPireps = await models.Pirep.findAll({
      where: { pilotid: pilotId, status: 1 },
      attributes: ["flighttime"],
    });

    // Calculate total flight time using only approved PIREPs
    const totalSeconds = approvedPireps.reduce(
      (total, pirep) => total + (pirep.flighttime || 0),
      0,
    );

    // Fetch all ranks
    const ranks = await models.Rank.findAll({
      order: [["timereq", "ASC"]],
    });

    // Determine the pilot's rank based on total approved flight time
    let pilotRank = { id: 0, name: "Trainee", timereq: 0 }; // Default rank
    for (const rank of ranks) {
      if (totalSeconds >= rank.timereq) {
        pilotRank = rank.get();
      } else {
        break;
      }
    }

    // Calculate progress toward next rank
    let nextRank = null;
    let progressToNextRank = 100;

    const currentRankIndex = ranks.findIndex(
      (rank) => rank.id === pilotRank.id,
    );
    if (currentRankIndex < ranks.length - 1) {
      nextRank = ranks[currentRankIndex + 1].get();
      const remainingTime = nextRank.timereq - totalSeconds;
      const totalRankTime = nextRank.timereq - pilotRank.timereq;
      progressToNextRank = Math.min(
        100,
        Math.max(0, ((totalRankTime - remainingTime) / totalRankTime) * 100),
      );
    }

    // Return all PIREPs but stats based only on approved ones
    return NextResponse.json({
      pireps: formattedPireps,
      pagination: {
        total: count,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        limit,
      },
      statistics: {
        totalFlightTime: formatFlightTime(totalSeconds),
        totalPireps: approvedPireps.length,
        rank: pilotRank.name,
        rankId: pilotRank.id,
        nextRank: nextRank ? nextRank.name : null,
        nextRankTimeReq: nextRank ? formatFlightTime(nextRank.timereq) : null,
        progressToNextRank: progressToNextRank.toFixed(2),
      },
    });
  } catch (error) {
    console.error("[PIREPs] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
