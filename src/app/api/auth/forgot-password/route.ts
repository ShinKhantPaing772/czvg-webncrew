import { NextResponse } from "next/server";
import { models } from "@/lib/db";
import crypto from "crypto";
import bcryptjs from "bcryptjs";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_VERIFY_ATTEMPTS = 5;
const GENERIC_REQUEST_MESSAGE =
  "If an account exists with this email, an OTP has been sent.";

const requestAttempts = new Map<string, { count: number; resetAt: number }>();
const verifyAttempts = new Map<string, { count: number; resetAt: number }>();

function normalizeEmail(email: unknown) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function isRateLimited(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
  limit: number,
) {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > limit;
}

function clearAttempts(
  store: Map<string, { count: number; resetAt: number }>,
  key: string,
) {
  store.delete(key);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, otp, password } = body;
    const email = normalizeEmail(body.email);

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await models.Pilot.findOne({
      where: { email },
      attributes: ["id", "email", "name"],
    });

    switch (action) {
      case "request":
        return await handleOTPRequest(email, user?.name);
      case "verify":
        return await verifyOTP(email, otp);
      case "reset":
        return await resetPassword(email, otp, password);
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}

async function handleOTPRequest(email: string, name?: string) {
  if (isRateLimited(requestAttempts, email, MAX_REQUESTS_PER_WINDOW)) {
    return NextResponse.json(
      { error: "Too many OTP requests. Please try again later." },
      { status: 429 }
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
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const recipientName = name || user.name || "Pilot";

  try {
    // Delete any existing OTP for this email
    await models.OTP.destroy({ where: { email } });

    // Store new OTP
    await models.OTP.create({
      email,
      otp: otpHash,
      expires: expiresAt,
    });

    // Send email using Brevo API
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY!,
      },
      body: JSON.stringify({
        sender: {
          name: "China Southern Virtual Group",
          email: "noreply-otp@ifczvg.com",
        },
        to: [{ email, name: recipientName }],
        subject: "Password Reset OTP Verification",
        htmlContent: `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f9fbfd; margin: 0; padding: 0;">
    <table align="center" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden;">
      <tr>
        <td style="background-color: #005baa; color: #ffffff; text-align: center; padding: 20px 10px;">
          <h1 style="margin: 0; font-size: 22px;">Password Reset One-Time Passcode (OTP)</h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 30px;">
          <p style="font-size: 16px; color: #333;">Hello <strong>${recipientName}</strong>,</p>
          <p style="font-size: 15px; color: #555;">We received a request to reset your password.</p>
          <p style="font-size: 15px; color: #555;">Please enter the OTP code below to verify your identity and complete the password reset process.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #f3f7fb; border: 2px dashed #005baa; padding: 15px 30px; border-radius: 8px;">
              <h2 style="font-size: 28px; color: #005baa; letter-spacing: 4px; margin: 0;">${otp}</h2>
            </div>
          </div>

          <p style="font-size: 14px; color: #666;">This OTP is valid for <strong>10 minutes</strong> and can only be used once. If you did not request this, please disregard this email.</p>

          <p style="font-size: 15px; color: #333; margin-top: 30px;">
            Thank you,<br>
            <strong>China Southern Virtual Group Team</strong>
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="font-size: 13px; color: #777; text-align: center;">
            For assistance or inquiries, please contact us via the
            <a href="https://community.infiniteflight.com/u/chinasouthernvg/summary" style="color: #005baa; text-decoration: none;">IFC</a>
            or Discord.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>

        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo API error:", errorData);
      throw new Error("Failed to send email");
    }

    return NextResponse.json({ message: GENERIC_REQUEST_MESSAGE });
  } catch (error) {
    console.error("Email sending error:", error);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }
}

async function verifyOTP(email: string, otp: string) {
  if (isRateLimited(verifyAttempts, email, MAX_VERIFY_ATTEMPTS)) {
    return NextResponse.json(
      { error: "Too many invalid attempts. Please request a new code." },
      { status: 429 }
    );
  }

  const record = await models.OTP.findOne({ where: { email } });

  if (!record) {
    return NextResponse.json(
      { error: "No OTP request found. Please request a new code." },
      { status: 400 }
    );
  }

  if (new Date() > record.expires) {
    await record.destroy();
    return NextResponse.json(
      { error: "OTP has expired. Please request a new code." },
      { status: 400 }
    );
  }

  if (!(await bcryptjs.compare(String(otp || ""), record.otp))) {
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
  }

  clearAttempts(verifyAttempts, email);
  return NextResponse.json({ message: "OTP verified successfully" });
}

async function resetPassword(email: string, otp: string, password: string) {
  if (isRateLimited(verifyAttempts, email, MAX_VERIFY_ATTEMPTS)) {
    return NextResponse.json(
      { error: "Too many invalid attempts. Please request a new code." },
      { status: 429 }
    );
  }

  const otpCheck = await models.OTP.findOne({ where: { email } });

  if (!otpCheck) {
    return NextResponse.json({ error: "No OTP found" }, { status: 400 });
  }

  if (!(await bcryptjs.compare(String(otp || ""), otpCheck.otp))) {
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
  }

  if (new Date() > otpCheck.expires) {
    await otpCheck.destroy();
    return NextResponse.json({ error: "OTP expired" }, { status: 400 });
  }

  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters long" },
      { status: 400 }
    );
  }

  await models.Pilot.update(
    { password: await bcryptjs.hash(password, 10) },
    { where: { email } }
  );

  await otpCheck.destroy();
  clearAttempts(verifyAttempts, email);
  clearAttempts(requestAttempts, email);

  return NextResponse.json({ message: "Password reset successfully" });
}
