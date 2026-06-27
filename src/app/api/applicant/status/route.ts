import { NextResponse } from "next/server";
import { models } from "@/lib/models";
import { requireAuth } from "@/lib/server-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function statusLabel(status: number) {
  switch (status) {
    case 0:
      return "Application pending";
    case 1:
      return "Approved";
    case 2:
      return "Rejected";
    case 3:
      return "Inactive";
    default:
      return "Unknown";
  }
}

function normalizeScore(score: unknown) {
  if (score === null || score === undefined || score === "") return null;

  const numericScore =
    typeof score === "number" ? score : Number(String(score).trim());

  return Number.isFinite(numericScore) ? numericScore : null;
}

async function getApplicant(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth;

  const pilot = await models.Pilot.findByPk(auth.user.id, {
    attributes: ["id", "name", "callsign", "email", "status"],
  });

  if (!pilot) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: "Applicant not found" },
        { status: 404 },
      ),
    };
  }

  const [application] = await models.Application.findOrCreate({
    where: { pilotid: pilot.get("id") },
    defaults: {
      pilotid: pilot.get("id"),
      exam_status: 0,
    },
  });

  return { ok: true as const, pilot, application };
}

export async function GET(request: Request) {
  try {
    const result = await getApplicant(request);
    if (!result.ok) return result.response;

    const status = Number(result.pilot.get("status"));
    const examStatus = Number(result.application.get("exam_status") || 0);
    const examScore = normalizeScore(result.application.get("exam_score"));
    const discordInviteUrl = result.application.get("discord_invite_url");

    return NextResponse.json({
      id: result.pilot.get("id"),
      name: result.pilot.get("name"),
      callsign: result.pilot.get("callsign"),
      email: result.pilot.get("email"),
      status,
      statusLabel: statusLabel(status),
      examStatus,
      examDeclared: examStatus >= 1,
      examScore,
      examResultReceivedAt: result.application.get("exam_result_received_at"),
      discordInviteUrl:
        typeof discordInviteUrl === "string" && discordInviteUrl.trim()
          ? discordInviteUrl
          : null,
    });
  } catch (error) {
    console.error("[Applicant Status] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load applicant status" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const result = await getApplicant(request);
    if (!result.ok) return result.response;

    const status = Number(result.pilot.get("status"));
    if (status !== 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Only pending applicants can declare exam completion",
        },
        { status: 400 },
      );
    }

    const examStatus = Number(result.application.get("exam_status") || 0);
    if (examStatus < 1) {
      await result.application.update({
        exam_status: 1,
        exam_completed_at: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      examStatus: Math.max(examStatus, 1),
      examDeclared: true,
      message: "Exam completion declared",
    });
  } catch (error) {
    console.error("[Applicant Status] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update applicant status" },
      { status: 500 },
    );
  }
}
