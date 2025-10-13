import { NextResponse } from "next/server";
import { models } from "@/lib/db";
import crypto from "crypto";
import bcryptjs from "bcryptjs";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email, otp, password } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await models.Pilot.findOne({
      where: { email },
      attributes: ["id", "email", "name"],
    });

    if (!user && action !== "reset") {
      return NextResponse.json(
        { error: "No account found with this email" },
        { status: 404 }
      );
    }

    switch (action) {
      case "request":
        return await handleOTPRequest(email, user!.name);
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

async function handleOTPRequest(email: string, name: string) {
  const otp = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    // Delete any existing OTP for this email
    await models.OTP.destroy({ where: { email } });

    // Store new OTP
    await models.OTP.create({
      email,
      otp,
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
        to: [{ email, name }],
        subject: "Password Reset Request",
        htmlContent: `
          <html>
            <body>
              <h1>Password Reset Request</h1>
              <p>Hello ${name},</p>
              <p>Your verification code is:</p>
              <h2 style="font-size: 24px; padding: 10px; background-color: #f0f0f0; text-align: center;">${otp}</h2>
              <p>This code will expire in 10 minutes.</p>
              <p>If you didn't request this, please ignore this email.</p>
              <p>Thank you,<br>China Southern Virtual Group Team</p>
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

    return NextResponse.json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("Email sending error:", error);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }
}

async function verifyOTP(email: string, otp: string) {
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

  if (record.otp !== otp) {
    return NextResponse.json({ error: "Invalid OTP" }, { status: 400 });
  }

  return NextResponse.json({ message: "OTP verified successfully" });
}

async function resetPassword(email: string, otp: string, password: string) {
  const otpCheck = await models.OTP.findOne({ where: { email } });

  if (!otpCheck) {
    return NextResponse.json({ error: "No OTP found" }, { status: 400 });
  }

  if (otpCheck.otp !== otp) {
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

  return NextResponse.json({ message: "Password reset successfully" });
}
