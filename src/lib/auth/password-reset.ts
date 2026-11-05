import bcryptjs from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { sendPasswordResetOtp } from "@/lib/auth/password-reset-email";
import sequelize, { models } from "@/lib/db";
import { deleteCached, incrementCounter } from "@/lib/utils/if-cache";

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_VERIFY_ATTEMPTS = 5;
const GENERIC_REQUEST_MESSAGE =
  "If an account exists with this email, an OTP has been sent.";

type AttemptKind = "request" | "verify";

export function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// Attempts are counted in the database so the limits hold across serverless
// instances. The email is hashed to keep keys short and addresses out of the
// cache table.
function attemptKey(kind: AttemptKind, email: string) {
  const digest = crypto.createHash("sha256").update(email).digest("hex");
  return `rate:password-reset:${kind}:${digest}`;
}

async function isRateLimited(kind: AttemptKind, email: string, limit: number) {
  const attempts = await incrementCounter(
    attemptKey(kind, email),
    RATE_LIMIT_WINDOW_SECONDS,
  );
  return attempts > limit;
}

async function clearAttempts(kind: AttemptKind, email: string) {
  try {
    await deleteCached(attemptKey(kind, email));
  } catch {
    // The cache already logged it, and the counter expires with its window.
  }
}

export async function requestPasswordResetOtp(email: string) {
  if (await isRateLimited("request", email, MAX_REQUESTS_PER_WINDOW)) {
    return NextResponse.json(
      { error: "Too many OTP requests. Please try again later." },
      { status: 429 },
    );
  }

  const user = await models.Pilot.findOne({
    where: { email },
    attributes: ["id", "email", "name"],
  });

  if (!user) {
    return NextResponse.json({ message: GENERIC_REQUEST_MESSAGE });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const otpHash = await bcryptjs.hash(otp, 10);

  try {
    await models.OTP.destroy({ where: { email } });
    await models.OTP.create({
      email,
      otp: otpHash,
      expires: new Date(Date.now() + OTP_TTL_MS),
    });

    const delivered = await sendPasswordResetOtp({
      email,
      name: user.name,
      otp,
    });
    if (!delivered) throw new Error("Failed to send email");

    // A new code gets a fresh set of attempts, as the 429 message promises.
    // Requests are capped too, so guesses stay limited.
    await clearAttempts("verify", email);

    return NextResponse.json({ message: GENERIC_REQUEST_MESSAGE });
  } catch (error) {
    console.error("Password reset email error:", error);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 },
    );
  }
}

export async function verifyPasswordResetOtp(email: string, otp: unknown) {
  if (await isRateLimited("verify", email, MAX_VERIFY_ATTEMPTS)) {
    return NextResponse.json(
      { error: "Too many invalid attempts. Please request a new code." },
      { status: 429 },
    );
  }

  const record = await models.OTP.findOne({ where: { email } });
  if (!record) {
    return NextResponse.json(
      { error: "No OTP request found. Please request a new code." },
      { status: 400 },
    );
  }

  if (new Date() > record.expires) {
    await record.destroy();
    return NextResponse.json(
      { error: "OTP has expired. Please request a new code." },
      { status: 400 },
    );
  }

  if (!(await bcryptjs.compare(String(otp || ""), record.otp))) {
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
  }

  await clearAttempts("verify", email);
  return NextResponse.json({ message: "OTP verified successfully" });
}

export async function resetPassword(
  email: string,
  otp: unknown,
  password: unknown,
) {
  if (await isRateLimited("verify", email, MAX_VERIFY_ATTEMPTS)) {
    return NextResponse.json(
      { error: "Too many invalid attempts. Please request a new code." },
      { status: 429 },
    );
  }

  const otpRecord = await models.OTP.findOne({ where: { email } });
  if (!otpRecord) {
    return NextResponse.json({ error: "No OTP found" }, { status: 400 });
  }

  if (!(await bcryptjs.compare(String(otp || ""), otpRecord.otp))) {
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
  }

  if (new Date() > otpRecord.expires) {
    await otpRecord.destroy();
    return NextResponse.json({ error: "OTP expired" }, { status: 400 });
  }

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters long" },
      { status: 400 },
    );
  }

  const passwordHash = await bcryptjs.hash(password, 10);
  const pilots = await models.Pilot.findAll({
    where: { email },
    attributes: ["id"],
  });
  const pilotIds = pilots.map((pilot) => pilot.id);

  // A reset signs out every device, so a leaked session token can't outlive
  // the password it was issued under.
  await sequelize.transaction(async (transaction) => {
    await models.Pilot.update(
      { password: passwordHash },
      { where: { email }, transaction },
    );
    if (pilotIds.length > 0) {
      await models.Token.destroy({
        where: { pilotId: pilotIds },
        transaction,
      });
    }
    await otpRecord.destroy({ transaction });
  });

  await clearAttempts("verify", email);
  await clearAttempts("request", email);

  return NextResponse.json({ message: "Password reset successfully" });
}
