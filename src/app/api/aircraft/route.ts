import { NextResponse } from "next/server";
import { models } from "@/lib/models";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AircraftSource = "infinite-flight" | "manual";

function optionalId(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : Number.NaN;
}

async function validatePayload(body: Record<string, unknown>) {
  const source = body.source as AircraftSource;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const liveryName =
    typeof body.liveryName === "string" ? body.liveryName.trim() : "";
  const ifAircraftId =
    typeof body.ifAircraftId === "string" ? body.ifAircraftId.trim() : "";
  const ifLiveryId =
    typeof body.ifLiveryId === "string" ? body.ifLiveryId.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const rankReq = optionalId(body.rankReq);
  const awardReq = optionalId(body.awardReq);

  if (source !== "infinite-flight" && source !== "manual") {
    return { error: "Aircraft source is required" } as const;
  }
  if (!name) return { error: "Aircraft name is required" } as const;
  if (notes.length > 12) {
    return { error: "Notes cannot exceed 12 characters" } as const;
  }
  if (Number.isNaN(rankReq) || Number.isNaN(awardReq)) {
    return { error: "Rank and award IDs must be valid" } as const;
  }
  if (!rankReq && !awardReq) {
    return { error: "Select at least a rank or an award requirement" } as const;
  }
  if (source === "infinite-flight" && (!ifAircraftId || !ifLiveryId || !liveryName)) {
    return {
      error: "Infinite Flight aircraft and livery selections are required",
    } as const;
  }

  const [rank, award] = await Promise.all([
    rankReq ? models.Rank.findByPk(rankReq, { attributes: ["id"] }) : null,
    awardReq ? models.Award.findByPk(awardReq, { attributes: ["id"] }) : null,
  ]);
  if (rankReq && !rank) return { error: "Selected rank was not found" } as const;
  if (awardReq && !award) {
    return { error: "Selected award was not found" } as const;
  }

  return {
    value: {
      name,
      liveryname: liveryName || null,
      ifaircraftid: source === "infinite-flight" ? ifAircraftId : null,
      ifliveryid: source === "infinite-flight" ? ifLiveryId : null,
      notes: notes || null,
      rankreq: rankReq,
      awardreq: awardReq,
    },
  } as const;
}

export async function GET() {
  try {
    const aircrafts = await models.Aircraft.findAll({
      where: { status: 1 },
      attributes: [
        "id",
        "name",
        "ifaircraftid",
        "liveryname",
        "ifliveryid",
        "status",
        "notes",
        "rankreq",
        "awardreq",
      ],
      order: [["name", "ASC"]],
      raw: true,
    });
    return NextResponse.json({ aircrafts });
  } catch (error) {
    console.error("[Aircraft] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "aircrafts");
    if (!auth.ok) return auth.response;

    const validated = await validatePayload(await request.json());
    if ("error" in validated) {
      return NextResponse.json(
        { success: false, message: validated.error },
        { status: 400 },
      );
    }

    const aircraft = await models.Aircraft.create({
      ...validated.value,
      status: 1,
    });
    return NextResponse.json({
      success: true,
      data: aircraft,
      message: "Aircraft created successfully",
    });
  } catch (error) {
    console.error("[Aircraft] Create error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create aircraft" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requirePermission(request, "aircrafts");
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as Record<string, unknown>;
    const id = optionalId(body.id);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "Aircraft ID is required" },
        { status: 400 },
      );
    }

    const aircraft = await models.Aircraft.findOne({ where: { id, status: 1 } });
    if (!aircraft) {
      return NextResponse.json(
        { success: false, message: "Aircraft not found" },
        { status: 404 },
      );
    }

    const validated = await validatePayload(body);
    if ("error" in validated) {
      return NextResponse.json(
        { success: false, message: validated.error },
        { status: 400 },
      );
    }

    await aircraft.update(validated.value);
    return NextResponse.json({
      success: true,
      data: aircraft,
      message: "Aircraft updated successfully",
    });
  } catch (error) {
    console.error("[Aircraft] Update error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update aircraft" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requirePermission(request, "aircrafts");
    if (!auth.ok) return auth.response;

    const id = optionalId(new URL(request.url).searchParams.get("id"));
    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        { success: false, message: "Aircraft ID is required" },
        { status: 400 },
      );
    }

    const aircraft = await models.Aircraft.findOne({ where: { id, status: 1 } });
    if (!aircraft) {
      return NextResponse.json(
        { success: false, message: "Aircraft not found" },
        { status: 404 },
      );
    }

    await aircraft.update({ status: 0 });
    return NextResponse.json({
      success: true,
      message: "Aircraft deactivated successfully",
    });
  } catch (error) {
    console.error("[Aircraft] Delete error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to deactivate aircraft" },
      { status: 500 },
    );
  }
}
