import { NextResponse } from "next/server";
import { Op } from "sequelize";

import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validId(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "awards");
    if (!auth.ok) return auth.response;

    const searchParams = new URL(request.url).searchParams;
    const awardIdParam = searchParams.get("awardId");

    if (awardIdParam !== null) {
      const awardId = validId(awardIdParam);
      if (!awardId) {
        return NextResponse.json(
          { success: false, message: "A valid award ID is required" },
          { status: 400 },
        );
      }

      const award = await models.Award.findByPk(awardId, {
        attributes: ["id", "name", "description", "imageurl"],
        raw: true,
      });
      if (!award) {
        return NextResponse.json(
          { success: false, message: "Award not found" },
          { status: 404 },
        );
      }

      const grants = await models.AwardGranted.findAll({
        where: { awardid: awardId },
        attributes: ["pilotid", "dateawarded"],
        order: [["dateawarded", "DESC"]],
        raw: true,
      });
      const pilotIds = Array.from(
        new Set(grants.map((grant: any) => Number(grant.pilotid))),
      );
      const pilots = pilotIds.length
        ? await models.Pilot.findAll({
            where: { id: { [Op.in]: pilotIds } },
            attributes: ["id", "name", "callsign", "email", "status"],
            order: [["name", "ASC"]],
            raw: true,
          })
        : [];
      const dateAwardedByPilot = new Map<number, Date>();
      for (const grant of grants as any[]) {
        const pilotId = Number(grant.pilotid);
        if (!dateAwardedByPilot.has(pilotId)) {
          dateAwardedByPilot.set(pilotId, grant.dateawarded);
        }
      }

      return NextResponse.json({
        award,
        recipients: pilots.map((pilot: any) => ({
          ...pilot,
          dateAwarded: dateAwardedByPilot.get(Number(pilot.id)),
        })),
      });
    }

    const query = searchParams.get("query")?.trim() || "";
    const where = query
      ? {
          [Op.or]: [
            { name: { [Op.like]: `%${query}%` } },
            { callsign: { [Op.like]: `%${query}%` } },
            { email: { [Op.like]: `%${query}%` } },
          ],
        }
      : undefined;
    const pilots = await models.Pilot.findAll({
      where,
      attributes: ["id", "name", "callsign", "email", "status"],
      order: [["name", "ASC"]],
      limit: 50,
      raw: true,
    });
    const pilotIds = pilots.map((pilot: any) => Number(pilot.id));
    const [awards, grants] = await Promise.all([
      models.Award.findAll({
        attributes: ["id", "name", "description", "imageurl"],
        order: [["name", "ASC"]],
        raw: true,
      }),
      pilotIds.length
        ? models.AwardGranted.findAll({
            where: { pilotid: { [Op.in]: pilotIds } },
            attributes: ["pilotid", "awardid", "dateawarded"],
            raw: true,
          })
        : [],
    ]);
    const grantMap = new Map<
      number,
      Array<{ awardId: number; dateAwarded: Date }>
    >();
    for (const grant of grants as any[]) {
      const list = grantMap.get(Number(grant.pilotid)) || [];
      list.push({
        awardId: Number(grant.awardid),
        dateAwarded: grant.dateawarded,
      });
      grantMap.set(Number(grant.pilotid), list);
    }
    return NextResponse.json({
      awards,
      pilots: pilots.map((pilot: any) => ({
        ...pilot,
        grants: grantMap.get(Number(pilot.id)) || [],
      })),
    });
  } catch (error) {
    console.error("[Pilot Awards] Fetch error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load pilot awards" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requirePermission(request, "awards");
    if (!auth.ok) return auth.response;
    const body = await request.json();
    const pilotId = validId(body.pilotId);
    const awardIds: number[] | null = Array.isArray(body.awardIds)
      ? Array.from(
          new Set<number>(
            body.awardIds
              .map((value: unknown) => validId(value))
              .filter((id: number | null): id is number => id !== null),
          ),
        )
      : null;
    if (!pilotId || awardIds === null) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid pilot and award list are required",
        },
        { status: 400 },
      );
    }
    if (!(await models.Pilot.findByPk(pilotId))) {
      return NextResponse.json(
        { success: false, message: "Pilot not found" },
        { status: 404 },
      );
    }
    const validAwards = awardIds.length
      ? await models.Award.findAll({
          where: { id: { [Op.in]: awardIds } },
          attributes: ["id"],
          raw: true,
        })
      : [];
    if (validAwards.length !== awardIds.length) {
      return NextResponse.json(
        { success: false, message: "One or more awards were not found" },
        { status: 400 },
      );
    }

    await sequelize.transaction(async (transaction) => {
      const existing = await models.AwardGranted.findAll({
        where: { pilotid: pilotId },
        attributes: ["awardid"],
        transaction,
        raw: true,
      });
      const existingIds = existing.map((grant: any) => Number(grant.awardid));
      const toRemove = existingIds.filter((id) => !awardIds.includes(id));
      const toAdd = awardIds.filter((id) => !existingIds.includes(id));
      if (toRemove.length) {
        await models.AwardGranted.destroy({
          where: { pilotid: pilotId, awardid: { [Op.in]: toRemove } },
          transaction,
        });
      }
      if (toAdd.length) {
        await models.AwardGranted.bulkCreate(
          toAdd.map((awardid) => ({
            pilotid: pilotId,
            awardid,
            dateawarded: new Date(),
          })),
          { transaction },
        );
      }
    });

    return NextResponse.json({ success: true, message: "Pilot awards updated" });
  } catch (error) {
    console.error("[Pilot Awards] Update error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update pilot awards" },
      { status: 500 },
    );
  }
}
