import { NextResponse } from "next/server";
import { Op } from "sequelize";

import { models } from "@/lib/models";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RankPayload = {
  name: string;
  timereq: number;
  imageurl: string | null;
  barcount: number;
  bartone: "gold" | "white";
  starcount: number;
};

function positiveId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function httpsUrl(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

async function validateRank(
  body: Record<string, unknown>,
  currentId?: number,
): Promise<{ error: string } | { value: RankPayload }> {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const timereq = Number(body.timereq);
  const imageurl = httpsUrl(body.imageurl);
  const barcount = Number(body.barcount);
  const bartone = body.bartone;
  const starcount = Number(body.starcount);

  if (!name || name.length > 120) {
    return { error: "Rank name is required and cannot exceed 120 characters" };
  }
  if (!Number.isInteger(timereq) || timereq < 0) {
    return { error: "Required time must be a whole number of seconds" };
  }
  if (imageurl === undefined) {
    return { error: "Image URL must be a valid HTTPS URL" };
  }
  if (!Number.isInteger(barcount) || barcount < 1 || barcount > 4) {
    return { error: "Bar count must be between 1 and 4" };
  }
  if (bartone !== "gold" && bartone !== "white") {
    return { error: "Bar color must be gold or white" };
  }
  if (!Number.isInteger(starcount) || starcount < 0 || starcount > 2) {
    return { error: "Star count must be between 0 and 2" };
  }

  const ranks = await models.Rank.findAll({ attributes: ["id", "name", "timereq"], raw: true });
  const duplicateName = ranks.some(
    (rank: any) => rank.id !== currentId && rank.name.trim().toLowerCase() === name.toLowerCase(),
  );
  if (duplicateName) return { error: "A rank with this name already exists" };

  const duplicateTime = ranks.some(
    (rank: any) => rank.id !== currentId && Number(rank.timereq) === timereq,
  );
  if (duplicateTime) return { error: "A rank with this required time already exists" };

  return {
    value: { name, timereq, imageurl, barcount, bartone, starcount } as RankPayload,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "ranks");
    if (!auth.ok) return auth.response;

    const ranks = await models.Rank.findAll({
      attributes: ["id", "name", "timereq", "imageurl", "barcount", "bartone", "starcount"],
      order: [["timereq", "ASC"]],
      raw: true,
    });
    return NextResponse.json({ ranks });
  } catch (error) {
    console.error("[Admin Ranks] Fetch error:", error);
    return NextResponse.json({ success: false, message: "Failed to load ranks" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "ranks");
    if (!auth.ok) return auth.response;

    const validated = await validateRank(await request.json());
    if (!("value" in validated)) {
      return NextResponse.json({ success: false, message: validated.error }, { status: 400 });
    }
    const rank = await models.Rank.create(validated.value);
    return NextResponse.json({ success: true, rank, message: "Rank created" }, { status: 201 });
  } catch (error) {
    console.error("[Admin Ranks] Create error:", error);
    return NextResponse.json({ success: false, message: "Failed to create rank" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requirePermission(request, "ranks");
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as Record<string, unknown>;
    const id = positiveId(body.id);
    if (!id) return NextResponse.json({ success: false, message: "A valid rank ID is required" }, { status: 400 });

    const rank = await models.Rank.findByPk(id);
    if (!rank) return NextResponse.json({ success: false, message: "Rank not found" }, { status: 404 });

    const validated = await validateRank(body, id);
    if (!("value" in validated)) {
      return NextResponse.json({ success: false, message: validated.error }, { status: 400 });
    }
    await rank.update(validated.value);
    return NextResponse.json({ success: true, rank, message: "Rank updated" });
  } catch (error) {
    console.error("[Admin Ranks] Update error:", error);
    return NextResponse.json({ success: false, message: "Failed to update rank" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requirePermission(request, "ranks");
    if (!auth.ok) return auth.response;

    const id = positiveId(new URL(request.url).searchParams.get("id"));
    if (!id) return NextResponse.json({ success: false, message: "A valid rank ID is required" }, { status: 400 });

    const rank = await models.Rank.findByPk(id);
    if (!rank) return NextResponse.json({ success: false, message: "Rank not found" }, { status: 404 });
    if ((await models.Rank.count()) <= 1) {
      return NextResponse.json({ success: false, message: "The final rank cannot be deleted" }, { status: 409 });
    }

    const [aircraft, multipliers] = await Promise.all([
      models.Aircraft.count({ where: { rankreq: id } }),
      models.Multiplier.count({ where: { minrankid: id } }),
    ]);
    if (aircraft || multipliers) {
      const dependencies = [
        aircraft ? `${aircraft} aircraft` : null,
        multipliers ? `${multipliers} multiplier${multipliers === 1 ? "" : "s"}` : null,
      ].filter(Boolean).join(" and ");
      return NextResponse.json(
        { success: false, message: `This rank is still used by ${dependencies}. Reassign them before deleting it.` },
        { status: 409 },
      );
    }

    await models.Rank.destroy({ where: { id: { [Op.eq]: id } } });
    return NextResponse.json({ success: true, message: "Rank deleted" });
  } catch (error) {
    console.error("[Admin Ranks] Delete error:", error);
    return NextResponse.json({ success: false, message: "Failed to delete rank" }, { status: 500 });
  }
}
