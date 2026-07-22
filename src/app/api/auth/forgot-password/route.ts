import { NextResponse } from "next/server";
import {
  normalizeEmail,
  requestPasswordResetOtp,
  resetPassword,
  verifyPasswordResetOtp,
} from "@/lib/auth/password-reset";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body.email);

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    switch (body.action) {
      case "request":
        return requestPasswordResetOtp(email);
      case "verify":
        return verifyPasswordResetOtp(email, body.otp);
      case "reset":
        return resetPassword(email, body.otp, body.password);
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
