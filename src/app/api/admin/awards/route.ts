import { NextResponse } from "next/server";
import { Op } from "sequelize";

import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { requirePermission } from "@/lib/server-auth";
import { livePilotAwardId } from "@/lib/scheduling/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function positiveId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function validatedImageUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

type AwardPayload = {
  name: string;
  name_zh?: string | null;
  description: string;
  description_zh?: string | null;
  imageurl: string;
  featured: boolean;
  category?: string;
  criteria?: Record<string, unknown> | null;
};

async function validateAward(
  body: Record<string, unknown>,
  currentId?: number,
): Promise<{ error: string } | { value: AwardPayload }> {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const name_zh = typeof body.name_zh === "string" ? body.name_zh.trim() : null;
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const description_zh = typeof body.description_zh === "string" ? body.description_zh.trim() : null;
  const imageurl = validatedImageUrl(body.imageurl);
  const featured = body.featured === true;
  const category =
    typeof body.category === "string" && body.category.trim()
      ? body.category.trim()
      : "milestone";
  let criteria: Record<string, unknown> | null = null;
  if (body.criteria && typeof body.criteria === "object") {
    criteria = body.criteria as Record<string, unknown>;
  } else if (typeof body.criteria === "string" && body.criteria.trim()) {
    try {
      criteria = JSON.parse(body.criteria);
    } catch {
      // Ignored if invalid JSON
    }
  }

  if (!name) return { error: "Award name is required" };
  if (!description) return { error: "Award description is required" };
  if (!imageurl) return { error: "Award image must be a valid HTTPS URL or local asset path" };

  const awards = await models.Award.findAll({ attributes: ["id", "name"], raw: true });
  if (
    awards.some(
      (award: any) =>
        award.id !== currentId &&
        typeof award.name === "string" &&
        award.name.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    return { error: "An award with this name already exists" };
  }

  return {
    value: {
      name,
      name_zh,
      description,
      description_zh,
      imageurl,
      featured,
      category,
      criteria,
    },
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "awards");
    if (!auth.ok) return auth.response;
    const awards = await models.Award.findAll({
      attributes: [
        "id",
        "name",
        "name_zh",
        "description",
        "description_zh",
        "imageurl",
        "featured",
        "category",
        "criteria",
      ],
      order: [
        ["category", "ASC"],
        ["name", "ASC"],
      ],
      raw: true,
    });
    return NextResponse.json({ awards });
  } catch (error) {
    console.error("[Admin Awards] Fetch error:", error);
    return NextResponse.json({ success: false, message: "Failed to load awards" }, { status: 500 });
  }
}

async function saveAward(
  values: AwardPayload,
  id?: number,
) {
  return sequelize.transaction(async (transaction) => {
    if (values.featured) {
      await models.Award.update({ featured: null }, { where: { featured: 1 }, transaction });
    }
    const stored = { ...values, featured: values.featured ? 1 : null };
    if (id) {
      const award = await models.Award.findByPk(id, {
        attributes: [
          "id",
          "name",
          "name_zh",
          "description",
          "description_zh",
          "imageurl",
          "featured",
          "category",
          "criteria",
        ],
        transaction,
      });
      if (!award) return null;
      await award.update(stored, { transaction });
      return award;
    }
    return models.Award.create(stored, { transaction });
  });
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "awards");
    if (!auth.ok) return auth.response;
    const validated = await validateAward(await request.json());
    if (!("value" in validated)) {
      return NextResponse.json({ success: false, message: validated.error }, { status: 400 });
    }
    const award = await saveAward(validated.value);
    return NextResponse.json({ success: true, award, message: "Award created" }, { status: 201 });
  } catch (error) {
    console.error("[Admin Awards] Create error:", error);
    return NextResponse.json({ success: false, message: "Failed to create award" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requirePermission(request, "awards");
    if (!auth.ok) return auth.response;
    const body = (await request.json()) as Record<string, unknown>;
    const id = positiveId(body.id);
    if (!id) return NextResponse.json({ success: false, message: "A valid award ID is required" }, { status: 400 });
    if (!(await models.Award.findByPk(id, { attributes: ["id"] }))) {
      return NextResponse.json({ success: false, message: "Award not found" }, { status: 404 });
    }
    const validated = await validateAward(body, id);
    if (!("value" in validated)) {
      return NextResponse.json({ success: false, message: validated.error }, { status: 400 });
    }
    const award = await saveAward(validated.value, id);
    return NextResponse.json({ success: true, award, message: "Award updated" });
  } catch (error) {
    console.error("[Admin Awards] Update error:", error);
    return NextResponse.json({ success: false, message: "Failed to update award" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requirePermission(request, "awards");
    if (!auth.ok) return auth.response;
    const id = positiveId(new URL(request.url).searchParams.get("id"));
    if (!id) return NextResponse.json({ success: false, message: "A valid award ID is required" }, { status: 400 });
    if (id === livePilotAwardId()) {
      return NextResponse.json(
        { success: false, message: "This award controls live scheduling access. Configure another Live Pilot award before deleting it." },
        { status: 409 },
      );
    }
    if (!(await models.Award.findByPk(id, { attributes: ["id"] }))) {
      return NextResponse.json({ success: false, message: "Award not found" }, { status: 404 });
    }
    const [aircraft, grants] = await Promise.all([
      models.Aircraft.count({ where: { awardreq: id } }),
      models.AwardGranted.count({ where: { awardid: id } }),
    ]);
    if (aircraft || grants) {
      const dependencies = [
        aircraft ? `${aircraft} aircraft` : null,
        grants ? `${grants} pilot grant${grants === 1 ? "" : "s"}` : null,
      ].filter(Boolean).join(" and ");
      return NextResponse.json(
        { success: false, message: `This award is still used by ${dependencies}. Remove those references before deleting it.` },
        { status: 409 },
      );
    }
    await models.Award.destroy({ where: { id: { [Op.eq]: id } } });
    return NextResponse.json({ success: true, message: "Award deleted" });
  } catch (error) {
    console.error("[Admin Awards] Delete error:", error);
    return NextResponse.json({ success: false, message: "Failed to delete award" }, { status: 500 });
  }
}
