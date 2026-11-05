import { after, NextRequest, NextResponse } from "next/server";
import { models } from "@/lib/db";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { postDiscordWebhook } from "@/lib/discord-webhook";
import {
  applicationReceivedEmail,
  getApplicantPortalUrl,
  sendEmail,
} from "@/lib/email";
import {
  findInfiniteFlightUser,
  getInfiniteFlightUser,
  InfiniteFlightApiError,
} from "@/lib/infinite-flight-api";
import { isIfcLookupRateLimited } from "@/lib/infinite-flight/lookup-rate-limit";
import { extractInfiniteFlightMetrics } from "@/lib/infinite-flight/user-metrics";
import { canPilotLogIn, getCrewLandingPath } from "@/lib/pilot-status";
import { isValidSignupName } from "@/lib/utils/signup-name";

const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const INVALID_IFC_MESSAGE =
  "IFC username entered is not valid, please enter a valid IFC username.";

export async function POST(request: NextRequest) {
  try {
    if (!models?.Pilot) {
      console.error("[Auth] Error: Database connection not established");
      return NextResponse.json(
        { error: "Database connection error" },
        { status: 500 },
      );
    }
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error("[Auth] Error parsing request body:", error);
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 },
      );
    }

    const { action = "login", ...data } = body;

    // Awaited so unexpected errors reach the JSON error response below.
    switch (action) {
      case "login":
        return await handleLogin(data);
      case "signup":
        return await handleSignup(data, request);
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[Auth] Unhandled error:", error);
    console.error(
      "[Auth] Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

async function handleLogin({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();

  let pilot;
  try {
    pilot = await models.Pilot.findOne({
      where: {
        email: normalizedEmail,
      },
      attributes: ["id", "email", "password", "name", "callsign", "status"],
    });
  } catch (error) {
    console.error("[Login] Database query error:", error);
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 },
    );
  }

  if (!pilot) {
    return NextResponse.json(
      { error: "Invalid credentials. Please check your email and password." },
      { status: 401 },
    );
  }

  let isValidPassword = false;
  try {
    if (!password || !pilot.password) {
      return NextResponse.json(
        { error: "Invalid credentials. Please check your email and password." },
        { status: 401 },
      );
    }
    // bcrypt.compare already handles hash validation internally
    isValidPassword = await bcryptjs.compare(password, pilot.password);
  } catch (error) {
    console.error("[Login] Error comparing passwords:", error);
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 },
    );
  }

  if (!isValidPassword) {
    return NextResponse.json(
      { error: "Invalid credentials. Please check your email and password." },
      { status: 401 },
    );
  }

  if (!canPilotLogIn(pilot.status)) {
    return NextResponse.json(
      { error: "This account is not available for login." },
      { status: 401 },
    );
  }

  try {
    const tokenString = await createAuthToken(pilot.id, pilot.email);

    const response = NextResponse.json(
      {
        message: "Login successful",
        token: tokenString,
        user: {
          id: pilot.id,
          name: pilot.name,
          email: pilot.email,
          callsign: pilot.callsign,
          status: pilot.status,
        },
        redirectTo: getCrewLandingPath(pilot.status),
      },
      { status: 200 },
    );

    return response;
  } catch (error) {
    console.error("[Login] Error creating token:", error);
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 },
    );
  }
}

async function createAuthToken(pilotId: number, email: string) {
  const tokenString = jwt.sign({ id: pilotId, email }, JWT_SECRET as string, {
    expiresIn: "7d",
  });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await models.Token.create({
    pilotId,
    token: tokenString,
    expiresAt,
  });

  return tokenString;
}

async function generateUniqueCallsign() {
  while (true) {
    const randomNumber = Math.floor(Math.random() * 900) + 100; // Generate random 3-digit number
    const callsign = `China Southern ${randomNumber}VG`;

    const existingCallsign = await models.Pilot.findOne({
      where: { callsign },
    });

    if (!existingCallsign) {
      return callsign;
    }
  }
}

/**
 * Looks the IFC username up on the server. Whatever the signup form sends
 * about the IF account can be edited, so only this result is stored. It is
 * usually a cache hit from the form's own username check moments earlier.
 */
async function lookUpIfcIdentity(ifc: string, request: Request) {
  if (await isIfcLookupRateLimited(request)) {
    return {
      response: NextResponse.json(
        {
          error:
            "Too many IFC username checks. Please wait a few minutes and try again.",
        },
        { status: 429 },
      ),
    };
  }

  let user: ReturnType<typeof findInfiniteFlightUser> = null;
  try {
    const { data } = await getInfiniteFlightUser(ifc);
    user = findInfiniteFlightUser(data.result, ifc);
  } catch (error) {
    const isUnknownUser =
      error instanceof InfiniteFlightApiError &&
      (error.status === 400 || error.status === 404);
    if (!isUnknownUser) {
      console.error("[Signup] IFC lookup failed:", error);
      return {
        response: NextResponse.json(
          {
            error:
              "We couldn't verify your IFC username right now. Please try again in a few minutes.",
          },
          { status: 503 },
        ),
      };
    }
  }

  if (!user) {
    return {
      response: NextResponse.json(
        { error: INVALID_IFC_MESSAGE },
        { status: 400 },
      ),
    };
  }

  return {
    identity: {
      userId: String(user.userId),
      ...extractInfiniteFlightMetrics(user),
    },
  };
}

async function handleSignup(
  {
    email,
    password,
    name,
    ifc,
  }: {
    email?: unknown;
    password?: unknown;
    name?: unknown;
    ifc?: unknown;
  },
  request: Request,
) {
  if (!isValidSignupName(name)) {
    return NextResponse.json(
      {
        error: "Name can only contain English letters, numbers, and spaces.",
      },
      { status: 400 },
    );
  }

  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      },
      { status: 400 },
    );
  }

  if (typeof ifc !== "string" || !ifc.trim()) {
    return NextResponse.json({ error: INVALID_IFC_MESSAGE }, { status: 400 });
  }

  const normalizedName = name.trim();
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedIfc = ifc.trim();
  const existingPilotMail = await models.Pilot.findOne({
    where: { email: normalizedEmail },
  });

  if (existingPilotMail) {
    return NextResponse.json(
      {
        error:
          "An account is already registered with this Email. If you just applied, rest assured your application is recorded. If you think this is an error please contact us on the IFC.",
      },
      { status: 400 },
    );
  }

  const existingPilotIFC = await models.Pilot.findOne({
    where: { ifc: normalizedIfc },
  });

  if (existingPilotIFC) {
    return NextResponse.json(
      {
        error:
          "An account is already registered with this IFC username. If you just applied, rest assured your application is recorded. If you think this is an error please contact us on the IFC.",
      },
      { status: 400 },
    );
  }

  const ifLookup = await lookUpIfcIdentity(normalizedIfc, request);
  if (ifLookup.response) return ifLookup.response;
  const ifIdentity = ifLookup.identity;

  const hashedPassword = await bcryptjs.hash(password, 10);
  const callsign = await generateUniqueCallsign();

  const pilot = await models.Pilot.create({
    email: normalizedEmail,
    password: hashedPassword,
    name: normalizedName,
    callsign,
    ifc: normalizedIfc,
    ifuserid: ifIdentity.userId,
    status: 0, // Pending approval
  });

  await models.Application.create({
    pilotid: pilot.id,
    exam_status: 0,
    if_grade: ifIdentity.grade,
    if_violations: ifIdentity.violations,
    if_metrics_updated_at: new Date(),
  });

  const webhookUrl = process.env.DISCORD_WEBHOOK_ADMIN;
  if (webhookUrl) {
    const discordPayload = {
      embeds: [
        {
          title: "New Pilot Application!",
          color: 3447003,
          fields: [
            {
              name: "Pilot",
              value: `${normalizedName} (${callsign})`,
              inline: false,
            },
            {
              name: "IFC Username",
              value: normalizedIfc,
              inline: false,
            },
            {
              name: "IFC UserId",
              value: ifIdentity.userId,
              inline: false,
            },
            {
              name: "Email",
              value: `${normalizedEmail}`,
              inline: false,
            },
          ],
          footer: {
            text: `China Southern Virtual Group • ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString(
              [],
              { hour: "2-digit", minute: "2-digit" },
            )}`,
          },
        },
      ],
    };

    // The account already exists, so post after responding: a Discord outage
    // must not turn a successful signup into an error.
    after(() => postDiscordWebhook(webhookUrl, discordPayload, "[Signup]"));
  }

  // `after` keeps the serverless function alive until the email is sent.
  after(() =>
    sendEmail({
      to: { email: pilot.email, name: pilot.name },
      subject: "Your CZVG application has been received",
      htmlContent: applicationReceivedEmail({
        name: pilot.name,
        callsign: pilot.callsign,
        portalUrl: getApplicantPortalUrl(),
      }),
    }).catch((error) => {
      console.error(
        "[Signup] Failed to send application received email:",
        error,
      );
    }),
  );

  const tokenString = await createAuthToken(pilot.id, pilot.email);

  return NextResponse.json(
    {
      message: `Your application is sent. Your callsign is assigned to ${pilot.callsign}. Our staff will contact you on the IFC soon, so make sure you keep an eye on it. `,
      token: tokenString,
      redirectTo: "/crew/application",
      user: {
        id: pilot.id,
        name: pilot.name,
        email: pilot.email,
        callsign: pilot.callsign,
        status: pilot.status,
      },
    },
    { status: 201 },
  );
}
