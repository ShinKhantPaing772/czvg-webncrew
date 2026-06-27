import { NextResponse } from "next/server";
import { models } from "@/lib/models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.substring(7).trim();
}

function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseScore(score: unknown) {
  const numericScore =
    typeof score === "number" ? score : Number(String(score ?? "").trim());

  if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 100) {
    return null;
  }

  return Number(numericScore.toFixed(2));
}

export async function POST(request: Request) {
  try {
    const expectedToken = process.env.ZAPIER_EXAM_API_KEY;
    if (!expectedToken) {
      console.error("[Exam Result] ZAPIER_EXAM_API_KEY is not configured");
      return NextResponse.json(
        { success: false, error: "Exam result endpoint is not configured" },
        { status: 500 },
      );
    }

    if (getBearerToken(request) !== expectedToken) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const email = normalizeEmail(body.email);
    const ifc = normalizeText(body.ifc);
    const examScore = parseScore(body.exam_score ?? body.examScore);

    if (!email || !ifc || examScore === null) {
      return NextResponse.json(
        {
          success: false,
          error: "email, ifc, and exam_score are required",
        },
        { status: 400 },
      );
    }

    const pilot = await models.Pilot.findOne({
      where: { email, ifc },
      attributes: ["id", "email", "ifc", "status"],
    });

    if (!pilot) {
      return NextResponse.json(
        {
          success: false,
          error: "No pilot matched that email and IFC username",
        },
        { status: 404 },
      );
    }

    const [application] = await models.Application.findOrCreate({
      where: { pilotid: pilot.get("id") },
      defaults: {
        pilotid: pilot.get("id"),
        exam_status: 0,
      },
    });

    await application.update({
      exam_status: 2,
      exam_score: examScore,
      exam_completed_at:
        application.get("exam_completed_at") || new Date(),
      exam_result_received_at: new Date(),
    });

    return NextResponse.json({
      success: true,
      pilotid: pilot.get("id"),
      exam_status: 2,
      exam_score: examScore,
    });
  } catch (error) {
    console.error("[Exam Result] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save exam result" },
      { status: 500 },
    );
  }
}
