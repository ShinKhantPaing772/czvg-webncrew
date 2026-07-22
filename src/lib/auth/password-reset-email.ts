import { sendEmail } from "@/lib/email";

const PASSWORD_RESET_SENDER = {
  name: "China Southern Virtual Group",
  email: "noreply-otp@ifczvg.com",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function sendPasswordResetOtp({
  email,
  name,
  otp,
}: {
  email: string;
  name?: string;
  otp: string;
}) {
  const recipientName = name || "Pilot";

  return sendEmail({
    sender: PASSWORD_RESET_SENDER,
    to: { email, name: recipientName },
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
          <p style="font-size: 16px; color: #333;">Hello <strong>${escapeHtml(recipientName)}</strong>,</p>
          <p style="font-size: 15px; color: #555;">We received a request to reset your password.</p>
          <p style="font-size: 15px; color: #555;">Please enter the OTP code below to verify your identity and complete the password reset process.</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #f3f7fb; border: 2px dashed #005baa; padding: 15px 30px; border-radius: 8px;">
              <h2 style="font-size: 28px; color: #005baa; letter-spacing: 4px; margin: 0;">${escapeHtml(otp)}</h2>
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
</html>`,
  });
}
