const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const DEFAULT_SENDER = {
  name: "China Southern Virtual Group",
  email: "noreply@ifczvg.com",
};

type SendEmailParams = {
  sender?: {
    name: string;
    email: string;
  };
  to: {
    email: string;
    name?: string;
  };
  subject: string;
  htmlContent: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendEmail({
  sender,
  to,
  subject,
  htmlContent,
}: SendEmailParams) {
  if (!BREVO_API_KEY) {
    console.error("[Email] BREVO_API_KEY is not configured");
    return false;
  }

  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: sender ?? DEFAULT_SENDER,
      to: [{ email: to.email, name: to.name || to.email }],
      subject,
      htmlContent,
    }),
  });

  if (!response.ok) {
    let errorBody: unknown = null;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }
    console.error("[Email] Brevo API error:", errorBody);
    return false;
  }

  return true;
}

function emailLayout(title: string, body: string) {
  return `
<!DOCTYPE html>
<html>
  <body style="font-family: Arial, Helvetica, sans-serif; background-color: #f9fbfd; margin: 0; padding: 0;">
    <table align="center" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); overflow: hidden;">
      <tr>
        <td style="background-color: #005baa; color: #ffffff; text-align: center; padding: 20px 10px;">
          <h1 style="margin: 0; font-size: 22px;">${escapeHtml(title)}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 30px;">
          ${body}
          <p style="font-size: 15px; color: #333; margin-top: 30px;">
            Thank you,<br>
            <strong>China Southern Virtual Group Team</strong>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 13px; color: #777; text-align: center;">
            For assistance or inquiries, please contact us via the
            <a href="https://community.infiniteflight.com/u/chinasouthernvg/summary" style="color: #005baa; text-decoration: none;">IFC</a>.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function paragraph(content: string) {
  return `<p style="font-size: 15px; color: #555; line-height: 1.6;">${content}</p>`;
}

function button(label: string, href: string) {
  return `
  <div style="text-align: center; margin: 28px 0;">
    <a href="${escapeHtml(href)}" style="display: inline-block; background-color: #005baa; color: #ffffff; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-weight: bold;">
      ${escapeHtml(label)}
    </a>
  </div>`;
}

export function applicationReceivedEmail({
  name,
  callsign,
  portalUrl,
}: {
  name: string;
  callsign: string;
  portalUrl: string;
}) {
  const safeName = escapeHtml(name || "Pilot");
  const safeCallsign = escapeHtml(callsign);

  return emailLayout(
    "Application Received",
    [
      paragraph(`Hello <strong>${safeName}</strong>,`),
      paragraph(
        `Your China Southern Virtual Group application has been recorded. Your assigned callsign is <strong>${safeCallsign}</strong>.`,
      ),
      paragraph(
        "You can sign in to the applicant portal to review your application information and complete the entrance examination.",
      ),
      button("Open Applicant Portal", portalUrl),
    ].join(""),
  );
}

export function examGradeEmail({
  name,
  score,
  requiresReplay,
  portalUrl,
  isUpdate = false,
}: {
  name: string;
  score: number;
  requiresReplay: boolean;
  portalUrl: string;
  isUpdate?: boolean;
}) {
  const safeName = escapeHtml(name || "Pilot");
  const scoreText = escapeHtml(`${score}/100`);

  return emailLayout(
    isUpdate
      ? "Entrance Examination Grade Updated"
      : "Entrance Examination Result",
    [
      paragraph(`Hello <strong>${safeName}</strong>,`),
      paragraph(
        isUpdate
          ? `Your entrance examination grade has been updated to <strong>${scoreText}</strong>.`
          : `Your entrance examination grade is now available: <strong>${scoreText}</strong>.`,
      ),
      requiresReplay
        ? paragraph(
            "Because your score is below 80, we require an additional flight replay with full ATC coverage from departure to arrival. Please upload the replay through ShareMyInfiniteFlight and paste the link in your applicant portal.",
          )
        : paragraph(
            "Your score meets the standard examination requirement. Our recruiting team will continue reviewing your application.",
          ),
      button("Open Applicant Portal", portalUrl),
    ].join(""),
  );
}

export function discordInviteEmail({
  name,
  inviteUrl,
  portalUrl,
}: {
  name: string;
  inviteUrl: string;
  portalUrl: string;
}) {
  const safeName = escapeHtml(name || "Pilot");

  return emailLayout(
    "Discord Invite Available",
    [
      paragraph(`Hello <strong>${safeName}</strong>,`),
      paragraph(
        "Your Discord invite is now available. Please join the Discord server to continue onboarding.",
      ),
      button("Join Discord", inviteUrl),
      paragraph(
        `You can also access the invite from your <a href="${escapeHtml(
          portalUrl,
        )}" style="color: #005baa; text-decoration: none;">applicant portal</a>.`,
      ),
    ].join(""),
  );
}

export function pilotApprovedEmail({
  name,
  callsign,
  crewCenterUrl,
}: {
  name: string;
  callsign: string;
  crewCenterUrl: string;
}) {
  const safeName = escapeHtml(name || "Pilot");
  const safeCallsign = escapeHtml(callsign);

  return emailLayout(
    "Application Approved",
    [
      paragraph(`Hello <strong>${safeName}</strong>,`),
      paragraph(
        `Congratulations! Your China Southern Virtual Group application has been approved. Your assigned callsign is <strong>${safeCallsign}</strong>.`,
      ),
      paragraph(
        "You can now sign in to the Crew Center and begin flying with CZVG.",
      ),
      button("Open Crew Center", crewCenterUrl),
    ].join(""),
  );
}

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://ifczvg.com"
  ).replace(/\/$/, "");
}

export function getApplicantPortalUrl() {
  return `${getBaseUrl()}/crew/application`;
}

export function getCrewCenterUrl() {
  return `${getBaseUrl()}/crew/home`;
}
