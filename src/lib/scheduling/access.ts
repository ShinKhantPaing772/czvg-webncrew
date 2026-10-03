import { NextResponse } from "next/server";
import type { Transaction } from "sequelize";

import { models } from "@/lib/models";
import { canAccessCrewCenter } from "@/lib/pilot-status";
import { requireCrewAuth, type AuthResult } from "@/lib/server-auth";

export function livePilotAwardId(): number | null {
  const value = process.env.LIVE_PILOT_AWARD_ID?.trim();
  if (!value || !/^[1-9]\d*$/.test(value)) return null;

  const id = Number(value);
  return Number.isSafeInteger(id) && id <= 2_147_483_647 ? id : null;
}

export async function canAccessLiveScheduling(
  pilotId: number,
  status?: number,
  transaction?: Transaction,
): Promise<boolean> {
  const awardId = livePilotAwardId();
  if (!awardId) return false;

  const transactionOptions = transaction
    ? { transaction, lock: transaction.LOCK.UPDATE }
    : {};
  let currentStatus = status;
  // Mutation callers always lock and recheck the pilot before locking grants.
  if (currentStatus === undefined || transaction) {
    const pilot = await models.Pilot.findByPk(pilotId, {
      attributes: ["status"],
      raw: true,
      ...transactionOptions,
    });
    if (!pilot) return false;
    currentStatus = Number(pilot.status);
  }

  if (!canAccessCrewCenter(currentStatus)) return false;

  const grant = await models.AwardGranted.findOne({
    where: { pilotid: pilotId, awardid: awardId },
    attributes: ["id"],
    ...transactionOptions,
  });
  return Boolean(grant);
}

export async function requireLivePilotAuth(request: Request): Promise<AuthResult> {
  const auth = await requireCrewAuth(request);
  if (!auth.ok) return auth;

  try {
    if (!(await canAccessLiveScheduling(auth.user.id, 1))) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: "Live scheduling access requires the Live Pilot award" },
          { status: 403 },
        ),
      };
    }
    return auth;
  } catch (error) {
    console.error("[Live Scheduling] Failed to verify access:", error);
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Failed to verify live scheduling access" },
        { status: 500 },
      ),
    };
  }
}
