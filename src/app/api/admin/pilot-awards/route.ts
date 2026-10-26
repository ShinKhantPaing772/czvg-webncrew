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
            attributes: ["id", "name", "callsign", "ifc", "email", "status"],
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
    const limitParam = searchParams.get("limit");
    const parsedLimit = limitParam ? Number(limitParam) : 50;
    const limit =
      Number.isInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 500)
        : 50;

    const where = query
      ? {
          [Op.or]: [
            { name: { [Op.like]: `%${query}%` } },
            { callsign: { [Op.like]: `%${query}%` } },
            { ifc: { [Op.like]: `%${query}%` } },
            { email: { [Op.like]: `%${query}%` } },
          ],
        }
      : undefined;
    const pilots = await models.Pilot.findAll({
      where,
      attributes: ["id", "name", "callsign", "ifc", "email", "status"],
      order: [["name", "ASC"]],
      limit,
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

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "awards");
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const rawPilotIds = Array.isArray(body.pilotIds)
      ? body.pilotIds
      : body.pilotId !== undefined
        ? [body.pilotId]
        : [];
    const pilotIds: number[] = Array.from(
      new Set<number>(
        rawPilotIds
          .map((value: unknown) => validId(value))
          .filter((id: number | null): id is number => id !== null),
      ),
    );

    const rawAwardIds = Array.isArray(body.awardIds)
      ? body.awardIds
      : body.awardId !== undefined
        ? [body.awardId]
        : [];
    const awardIds: number[] = Array.from(
      new Set<number>(
        rawAwardIds
          .map((value: unknown) => validId(value))
          .filter((id: number | null): id is number => id !== null),
      ),
    );

    if (pilotIds.length === 0 || awardIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "At least one valid pilot and one valid award are required",
        },
        { status: 400 },
      );
    }

    const [existingPilots, existingAwards] = await Promise.all([
      models.Pilot.findAll({
        where: { id: { [Op.in]: pilotIds } },
        attributes: ["id"],
        raw: true,
      }),
      models.Award.findAll({
        where: { id: { [Op.in]: awardIds } },
        attributes: ["id"],
        raw: true,
      }),
    ]);

    if (existingPilots.length !== pilotIds.length) {
      return NextResponse.json(
        { success: false, message: "One or more pilots were not found" },
        { status: 404 },
      );
    }

    if (existingAwards.length !== awardIds.length) {
      return NextResponse.json(
        { success: false, message: "One or more awards were not found" },
        { status: 404 },
      );
    }

    let createdCount = 0;
    await sequelize.transaction(async (transaction) => {
      // Sort pilotIds ascending to prevent deadlocks across concurrent requests
      const sortedPilotIds = [...pilotIds].sort((a, b) => a - b);
      for (const pId of sortedPilotIds) {
        await models.Pilot.findByPk(pId, {
          attributes: ["id"],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
      }

      const existingGrants = await models.AwardGranted.findAll({
        where: {
          pilotid: { [Op.in]: pilotIds },
          awardid: { [Op.in]: awardIds },
        },
        attributes: ["pilotid", "awardid"],
        transaction,
        raw: true,
      });

      const grantedSet = new Set(
        existingGrants.map(
          (grant: any) => `${Number(grant.pilotid)}:${Number(grant.awardid)}`,
        ),
      );

      const now = new Date();
      const toCreate: Array<{
        pilotid: number;
        awardid: number;
        dateawarded: Date;
      }> = [];
      for (const pId of pilotIds) {
        for (const aId of awardIds) {
          if (!grantedSet.has(`${pId}:${aId}`)) {
            toCreate.push({
              pilotid: pId,
              awardid: aId,
              dateawarded: now,
            });
          }
        }
      }

      if (toCreate.length > 0) {
        await models.AwardGranted.bulkCreate(toCreate, { transaction });
      }
      createdCount = toCreate.length;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully granted awards (${createdCount} new assignment${
        createdCount === 1 ? "" : "s"
      })`,
      createdCount,
    });
  } catch (error) {
    console.error("[Pilot Awards] Batch grant error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to grant awards" },
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
      // Scheduling transactions lock the same pilot before checking eligibility.
      // Serialize grant changes so a revoked award cannot authorize a new booking.
      await models.Pilot.findByPk(pilotId, {
        attributes: ["id"],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
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

export async function DELETE(request: Request) {
  try {
    const auth = await requirePermission(request, "awards");
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    let pilotIds: number[] = [];
    let awardIds: number[] = [];

    const qAwardId = validId(url.searchParams.get("awardId"));
    const qPilotId = validId(url.searchParams.get("pilotId"));

    if (qAwardId && qPilotId) {
      awardIds = [qAwardId];
      pilotIds = [qPilotId];
    } else {
      const body = await request.json().catch(() => ({}));
      const rawPilotIds = Array.isArray(body.pilotIds)
        ? body.pilotIds
        : body.pilotId !== undefined
          ? [body.pilotId]
          : [];
      pilotIds = Array.from(
        new Set<number>(
          rawPilotIds
            .map((value: unknown) => validId(value))
            .filter((id: number | null): id is number => id !== null),
        ),
      );

      const rawAwardIds = Array.isArray(body.awardIds)
        ? body.awardIds
        : body.awardId !== undefined
          ? [body.awardId]
          : [];
      awardIds = Array.from(
        new Set<number>(
          rawAwardIds
            .map((value: unknown) => validId(value))
            .filter((id: number | null): id is number => id !== null),
        ),
      );
    }

    if (pilotIds.length === 0 || awardIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Valid pilot(s) and award(s) are required to revoke",
        },
        { status: 400 },
      );
    }

    let deletedCount = 0;
    await sequelize.transaction(async (transaction) => {
      const sortedPilotIds = [...pilotIds].sort((a, b) => a - b);
      for (const pId of sortedPilotIds) {
        await models.Pilot.findByPk(pId, {
          attributes: ["id"],
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
      }

      deletedCount = await models.AwardGranted.destroy({
        where: {
          pilotid: { [Op.in]: pilotIds },
          awardid: { [Op.in]: awardIds },
        },
        transaction,
      });
    });

    return NextResponse.json({
      success: true,
      message: `Revoked award(s) from ${deletedCount} record(s)`,
      deletedCount,
    });
  } catch (error) {
    console.error("[Pilot Awards] Revoke error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to revoke awards" },
      { status: 500 },
    );
  }
}
