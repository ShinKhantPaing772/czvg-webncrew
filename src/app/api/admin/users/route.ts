import { NextResponse } from "next/server";
import { models } from "@/lib/models";
import sequelize from "@/lib/database";
import { requirePermission } from "@/lib/server-auth";

// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requirePermission(request, "users");
    if (!auth.ok) return auth.response;

    const [users] = await sequelize.query(`
      SELECT
        p.\`id\`,
        p.\`name\`,
        p.\`callsign\`,
        p.\`ifc\`,
        p.\`ifuserid\`,
        p.\`email\`,
        p.\`joined\`,
        p.\`status\`,
        p.\`notes\`,
        p.\`transhours\`,
        p.\`transflights\`,
        a.\`exam_status\` AS examStatus,
        a.\`exam_score\` AS examScore,
        a.\`exam_completed_at\` AS examCompletedAt,
        a.\`exam_result_received_at\` AS examResultReceivedAt,
        a.\`flight_replay_url\` AS flightReplayUrl,
        a.\`flight_replay_submitted_at\` AS flightReplaySubmittedAt,
        a.\`discord_invite_url\` AS discordInviteUrl,
        a.\`discord_invite_sent_at\` AS discordInviteSentAt,
        a.\`if_grade\` AS ifGrade,
        a.\`if_violations\` AS ifViolations,
        a.\`if_metrics_updated_at\` AS ifMetricsUpdatedAt,
        (
          SELECT MAX(\`date\`)
          FROM \`pireps\`
          WHERE \`pilotid\` = p.\`id\` AND \`status\` = 1
        ) AS lastActivity
      FROM \`pilots\` p
      LEFT JOIN \`applications\` a ON a.\`pilotid\` = p.\`id\`
    `);

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching admin users", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requirePermission(request, "users");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { id, name, email, callsign, status, notes, application } = body;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const callsignPattern = /^China Southern \d{3}VG$/;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Missing pilot id" },
        { status: 400 },
      );
    }

    const updateFields: Record<string, string | number> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json(
          { success: false, message: "Name is required" },
          { status: 400 },
        );
      }
      updateFields.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        return NextResponse.json(
          { success: false, message: "Email is required" },
          { status: 400 },
        );
      }
      const nextEmail = email.trim();
      if (!emailPattern.test(nextEmail)) {
        return NextResponse.json(
          { success: false, message: "Enter a valid email address" },
          { status: 400 },
        );
      }
      updateFields.email = nextEmail;
    }

    if (callsign !== undefined) {
      if (typeof callsign !== "string" || !callsign.trim()) {
        return NextResponse.json(
          { success: false, message: "Assigned callsign is required" },
          { status: 400 },
        );
      }
      const nextCallsign = callsign.trim();
      if (!callsignPattern.test(nextCallsign)) {
        return NextResponse.json(
          {
            success: false,
            message: "Callsign must match China Southern ###VG",
          },
          { status: 400 },
        );
      }
      const existingPilot = await models.Pilot.findOne({
        where: { callsign: nextCallsign },
      });
      if (existingPilot && String(existingPilot.get("id")) !== String(id)) {
        return NextResponse.json(
          {
            success: false,
            message: "Callsign is already assigned to another user",
          },
          { status: 409 },
        );
      }
      updateFields.callsign = nextCallsign;
    }

    if (status !== undefined) {
      const nextStatus = Number(status);
      if (!Number.isInteger(nextStatus) || nextStatus < 0 || nextStatus > 3) {
        return NextResponse.json(
          { success: false, message: "Invalid status" },
          { status: 400 },
        );
      }
      updateFields.status = nextStatus;
    }

    if (notes !== undefined) {
      updateFields.notes = typeof notes === "string" ? notes : "";
    }

    const applicationUpdates: Record<string, string | number | Date | null> =
      {};

    if (application !== undefined) {
      if (!application || typeof application !== "object") {
        return NextResponse.json(
          { success: false, message: "Invalid application payload" },
          { status: 400 },
        );
      }

      if ("examScore" in application) {
        const rawScore = application.examScore;
        if (rawScore === "" || rawScore === null || rawScore === undefined) {
          applicationUpdates.exam_score = null;
        } else {
          const nextScore = Number(rawScore);
          if (
            !Number.isFinite(nextScore) ||
            nextScore < 0 ||
            nextScore > 100
          ) {
            return NextResponse.json(
              { success: false, message: "Exam score must be between 0 and 100" },
              { status: 400 },
            );
          }
          applicationUpdates.exam_score = Number(nextScore.toFixed(2));
          applicationUpdates.exam_status = 2;
          applicationUpdates.exam_result_received_at = new Date();
        }
      }

      if ("discordInviteUrl" in application) {
        const inviteUrl =
          typeof application.discordInviteUrl === "string"
            ? application.discordInviteUrl.trim()
            : "";

        applicationUpdates.discord_invite_url = inviteUrl || null;
        applicationUpdates.discord_invite_sent_at = inviteUrl ? new Date() : null;
      }
    }

    if (
      Object.keys(updateFields).length === 0 &&
      Object.keys(applicationUpdates).length === 0
    ) {
      return NextResponse.json(
        { success: false, message: "No fields to update" },
        { status: 400 },
      );
    }

    const pilot = await models.Pilot.findByPk(id);
    if (!pilot) {
      return NextResponse.json(
        { success: false, message: "Pilot not found" },
        { status: 404 },
      );
    }

    await pilot.update(updateFields);

    if (Object.keys(applicationUpdates).length > 0) {
      const [applicationRecord] = await models.Application.findOrCreate({
        where: { pilotid: Number(id) },
        defaults: {
          pilotid: Number(id),
          exam_status: 0,
        },
      });

      await applicationRecord.update(applicationUpdates);
    }

    return NextResponse.json({
      success: true,
      message: "Pilot Updated Successfully",
      user: pilot,
    });
  } catch (error) {
    console.error("Error updating pilot", error);
    return NextResponse.json({
      success: false,
      message: "Pilot Update Failed",
    });
  }
}
