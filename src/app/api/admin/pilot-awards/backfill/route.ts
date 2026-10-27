import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/server-auth";
import { syncAndBackfillAwards } from "@/lib/awards/sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "awards");
    if (!auth.ok) return auth.response;

    const result = await syncAndBackfillAwards();

    return NextResponse.json({
      success: true,
      message: `已成功同步 ${result.sync.totalCatalog} 枚勋章，并为 ${result.backfill.affectedPilots} 位飞行员补发了 ${result.backfill.totalNewGrants} 项历史荣誉！`,
      sync: result.sync,
      backfill: result.backfill,
    });
  } catch (error) {
    console.error("[Pilot Awards Backfill] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to sync and backfill awards",
      },
      { status: 500 },
    );
  }
}
