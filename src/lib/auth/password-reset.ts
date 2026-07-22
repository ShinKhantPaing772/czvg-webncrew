import bcryptjs from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { sendPasswordResetOtp } from "@/lib/auth/password-reset-email";
import { models } from "@/lib/db";

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_VERIFY_ATTEMPTS = 5;
const GENERIC_REQUEST_MESSAGE =
  "If an account exists with this email, an OTP has been sent.";

type AttemptStore = Map<string, { count: number; resetAt: number }>;

const requestAttempts: AttemptStore = new Map();
const verifyAttempts: AttemptStore = new Map();

export function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function isRateLimited(store: AttemptStore, key: string, limit: number) {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > limit;
}

function clearAttempts(store: AttemptStore, key: string) {
  store.delete(key);
}

export async function requestPasswordResetOtp(email: string) {
  if (isRateLimited(requestAttempts, email, MAX_REQUESTS_PER_WINDOW)) {
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
  if (isRateLimited(verifyAttempts, email, MAX_VERIFY_ATTEMPTS)) {
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

  clearAttempts(verifyAttempts, email);
  return NextResponse.json({ message: "OTP verified successfully" });
}

export async function resetPassword(
  email: string,
  otp: unknown,
  password: unknown,
) {
  if (isRateLimited(verifyAttempts, email, MAX_VERIFY_ATTEMPTS)) {
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

  await models.Pilot.update(
    { password: await bcryptjs.hash(password, 10) },
    { where: { email } },
  );

  await otpRecord.destroy();
  clearAttempts(verifyAttempts, email);
  clearAttempts(requestAttempts, email);

  return NextResponse.json({ message: "Password reset successfully" });
}
