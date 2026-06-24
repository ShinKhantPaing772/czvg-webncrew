import { NextResponse } from "next/server";
import { QueryTypes } from "sequelize";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const availablePermissionIds = [
  "home",
  "pireps",
  "routes",
  "users",
  "aircrafts",
  "permissions",
  "admin",
] as const;

const rolePermissionMap: Record<string, string[]> = {
  super_admin: ["admin"],
  admin: ["home", "pireps", "routes", "users", "aircrafts"],
  pirep_manager: ["home", "pireps"],
  route_manager: ["home", "routes"],
  user_manager: ["home", "users"],
  aircraft_manager: ["home", "aircrafts"],
  permissions_manager: ["home", "permissions"],
};

type AdminPermissionRow = {
  id: number;
  name: string;
  email: string;
  callsign: string;
  joined: string;
  lastActive: string | null;
  permissions: string | null;
};

function normalizePermissions(permissions: unknown) {
  if (!Array.isArray(permissions)) {
    return [];
  }

  return Array.from(
    new Set(
      permissions
        .filter((permission): permission is string => typeof permission === "string")
        .map((permission) => permission.trim())
        .filter((permission) =>
          availablePermissionIds.includes(
            permission as (typeof availablePermissionIds)[number],
          ),
        ),
    ),
  );
}

async function replaceUserPermissions(userid: number, permissions: string[]) {
  return sequelize.transaction(async (transaction) => {
    await models.Permission.destroy({
      where: { userid },
      transaction,
    });

    if (permissions.length > 0) {
      await models.Permission.bulkCreate(
        permissions.map((name) => ({ name, userid })),
        { transaction },
      );
    }
  });
}

export async function GET() {
  try {
    const rows = await sequelize.query<AdminPermissionRow>(
      `
        SELECT
          p.id,
          p.name,
          p.email,
          p.callsign,
          p.joined,
          (
            SELECT MAX(pr.date)
            FROM pireps pr
            WHERE pr.pilotid = p.id
          ) AS lastActive,
          GROUP_CONCAT(DISTINCT perms.name ORDER BY perms.name SEPARATOR ',') AS permissions
        FROM pilots p
        INNER JOIN permissions perms ON perms.userid = p.id
        GROUP BY p.id, p.name, p.email, p.callsign, p.joined
        ORDER BY p.name ASC
      `,
      { type: QueryTypes.SELECT },
    );

    return NextResponse.json({
      admins: rows.map((row) => ({
        ...row,
        permissions: row.permissions ? row.permissions.split(",") : [],
      })),
    });
  } catch (error) {
    console.error("Error fetching admin permissions", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch admin permissions" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const roleId = typeof body.role === "string" ? body.role : "";

    if (!email || !rolePermissionMap[roleId]) {
      return NextResponse.json(
        { success: false, message: "A valid email and role are required" },
        { status: 400 },
      );
    }

    const pilot = await models.Pilot.findOne({ where: { email } });
    if (!pilot) {
      return NextResponse.json(
        { success: false, message: "No pilot account found with that email" },
        { status: 404 },
      );
    }

    await replaceUserPermissions(pilot.id, rolePermissionMap[roleId]);

    return NextResponse.json({
      success: true,
      message: "Admin permissions updated",
    });
  } catch (error) {
    console.error("Error adding admin permissions", error);
    return NextResponse.json(
      { success: false, message: "Failed to add admin permissions" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const userid = Number(body.id);
    const permissions = normalizePermissions(body.permissions);

    if (!Number.isInteger(userid) || userid <= 0) {
      return NextResponse.json(
        { success: false, message: "A valid user id is required" },
        { status: 400 },
      );
    }

    const pilot = await models.Pilot.findByPk(userid);
    if (!pilot) {
      return NextResponse.json(
        { success: false, message: "Pilot not found" },
        { status: 404 },
      );
    }

    await replaceUserPermissions(userid, permissions);

    return NextResponse.json({
      success: true,
      message: "Permissions updated",
    });
  } catch (error) {
    console.error("Error updating admin permissions", error);
    return NextResponse.json(
      { success: false, message: "Failed to update permissions" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userid = Number(searchParams.get("id"));

    if (!Number.isInteger(userid) || userid <= 0) {
      return NextResponse.json(
        { success: false, message: "A valid user id is required" },
        { status: 400 },
      );
    }

    await models.Permission.destroy({ where: { userid } });

    return NextResponse.json({
      success: true,
      message: "Admin access removed",
    });
  } catch (error) {
    console.error("Error removing admin permissions", error);
    return NextResponse.json(
      { success: false, message: "Failed to remove admin access" },
      { status: 500 },
    );
  }
}
