import { NextResponse } from "next/server";
import { models } from "@/lib/models";
import { requirePermission } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "aircrafts");
    if (!auth.ok) return auth.response;

    const [ranks, awards] = await Promise.all([
      models.Rank.findAll({
        attributes: ["id", "name", "timereq"],
        order: [["timereq", "ASC"]],
        raw: true,
      }),
      models.Award.findAll({
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
        raw: true,
      }),
    ]);

    return NextResponse.json({ ranks, awards });
  } catch (error) {
    console.error("[Aircraft Requirements] Fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch aircraft requirements" },
      { status: 500 },
    );
  }
}
