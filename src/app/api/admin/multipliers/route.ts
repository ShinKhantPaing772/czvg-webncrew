import { NextResponse } from "next/server";

import { models } from "@/lib/models";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MultiplierPayload = {
  code: number;
  multiplier: number;
  name: string;
  minrankid: number | null;
};

type StoredMultiplier = {
  id: number;
  code: number;
  multiplier: number;
  name: string;
  minrankid: number | null;
};

function positiveId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function validateMultiplier(
  body: Record<string, unknown>,
  currentId?: number,
): Promise<{ error: string } | { value: MultiplierPayload }> {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const code = Number(body.code);
  const multiplier = Number(body.multiplier);
  const minrankid =
    body.minrankid === null ||
    body.minrankid === undefined ||
    body.minrankid === ""
      ? null
      : positiveId(body.minrankid);

  if (!name || name.length > 120) {
    return {
      error: "Multiplier name is required and cannot exceed 120 characters",
    };
  }

  if (
    !Number.isInteger(code) ||
    code <= 0 ||
    code > 2_147_483_647
  ) {
    return { error: "Code must be a positive whole number" };
  }

  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    return { error: "Multiplier must be greater than zero" };
  }

  if (
    body.minrankid !== null &&
    body.minrankid !== undefined &&
    body.minrankid !== "" &&
    minrankid === null
  ) {
    return { error: "Minimum rank is invalid" };
  }

  if (minrankid && !(await models.Rank.findByPk(minrankid))) {
    return { error: "Minimum rank was not found" };
  }

  const multipliers = (await models.Multiplier.findAll({
    attributes: ["id", "code", "name"],
    raw: true,
  })) as Array<Pick<StoredMultiplier, "id" | "code" | "name">>;

  if (
    multipliers.some(
      (item) => item.id !== currentId && Number(item.code) === code,
    )
  ) {
    return { error: "A multiplier with this code already exists" };
  }

  if (
    multipliers.some(
      (item) =>
        item.id !== currentId &&
        item.name.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    return { error: "A multiplier with this name already exists" };
  }

  return {
    value: {
      code,
      multiplier,
      name,
      minrankid,
    },
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "pireps");
    if (!auth.ok) return auth.response;

    const [storedMultipliers, ranks] = await Promise.all([
      models.Multiplier.findAll({
        attributes: ["id", "code", "multiplier", "name", "minrankid"],
        order: [
          ["name", "ASC"],
          ["id", "ASC"],
        ],
        raw: true,
      }) as Promise<StoredMultiplier[]>,
      models.Rank.findAll({
        attributes: ["id", "name", "timereq"],
        order: [["timereq", "ASC"]],
        raw: true,
      }),
    ]);

    const rankNames = new Map(
      ranks.map((rank: any) => [Number(rank.id), String(rank.name)]),
    );

    return NextResponse.json({
      multipliers: storedMultipliers.map((multiplier) => ({
        ...multiplier,
        code: Number(multiplier.code),
        multiplier: Number(multiplier.multiplier),
        minrankid:
          multiplier.minrankid === null ? null : Number(multiplier.minrankid),
        minRankName: multiplier.minrankid
          ? rankNames.get(Number(multiplier.minrankid)) ?? null
          : null,
      })),
      ranks,
    });
  } catch (error) {
    console.error("[Admin Multipliers] Fetch error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load multipliers" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "pireps");
    if (!auth.ok) return auth.response;

    const validated = await validateMultiplier(
      (await request.json()) as Record<string, unknown>,
    );
    if (!("value" in validated)) {
      return NextResponse.json(
        { success: false, message: validated.error },
        { status: 400 },
      );
    }

    const multiplier = await models.Multiplier.create(validated.value);
    return NextResponse.json(
      { success: true, multiplier, message: "Multiplier created" },
      { status: 201 },
    );
  } catch (error) {
    console.error("[Admin Multipliers] Create error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create multiplier" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requirePermission(request, "pireps");
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as Record<string, unknown>;
    const id = positiveId(body.id);
    if (!id) {
      return NextResponse.json(
        { success: false, message: "A valid multiplier ID is required" },
        { status: 400 },
      );
    }

    const storedMultiplier = await models.Multiplier.findByPk(id);
    if (!storedMultiplier) {
      return NextResponse.json(
        { success: false, message: "Multiplier not found" },
        { status: 404 },
      );
    }

    const validated = await validateMultiplier(body, id);
    if (!("value" in validated)) {
      return NextResponse.json(
        { success: false, message: validated.error },
        { status: 400 },
      );
    }

    await storedMultiplier.update(validated.value);
    return NextResponse.json({
      success: true,
      multiplier: storedMultiplier,
      message: "Multiplier updated",
    });
  } catch (error) {
    console.error("[Admin Multipliers] Update error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update multiplier" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requirePermission(request, "pireps");
    if (!auth.ok) return auth.response;

    const id = positiveId(new URL(request.url).searchParams.get("id"));
    if (!id) {
      return NextResponse.json(
        { success: false, message: "A valid multiplier ID is required" },
        { status: 400 },
      );
    }

    const multiplier = await models.Multiplier.findByPk(id);
    if (!multiplier) {
      return NextResponse.json(
        { success: false, message: "Multiplier not found" },
        { status: 404 },
      );
    }

    await multiplier.destroy();
    return NextResponse.json({
      success: true,
      message: "Multiplier deleted",
    });
  } catch (error) {
    console.error("[Admin Multipliers] Delete error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete multiplier" },
      { status: 500 },
    );
  }
}
