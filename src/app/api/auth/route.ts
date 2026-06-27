import { NextRequest, NextResponse } from "next/server";
import { models } from "@/lib/db";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

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

    switch (action) {
      case "login":
        return handleLogin(data);
      case "signup":
        return handleSignup(data);
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

  if (pilot.status !== 0 && pilot.status !== 1) {
    let statusMessage =
      "Login Failed. Your application may still be pending or it may have been denied. Please contact us for more details if you believe this is an error.";

    if (pilot.status === 2) {
      statusMessage =
        "Your application has been rejected. If you believe this is a mistake, please contact us on the IFC.";
    } else if (pilot.status === 3) {
      statusMessage =
        "Your account is marked as inactive. Please contact us on the IFC for assistance.";
    }

    return NextResponse.json({ error: statusMessage }, { status: 401 });
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
        redirectTo: pilot.status === 0 ? "/crew/application" : "/crew/home",
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

async function handleSignup({
  email,
  password,
  name,
  ifc,
  ifUserId,
}: {
  email: string;
  password: string;
  name: string;
  ifc: string;
  ifUserId: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
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
    where: { ifc: ifc },
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

  const hashedPassword = await bcryptjs.hash(password, 10);
  const callsign = await generateUniqueCallsign();

  const pilot = await models.Pilot.create({
    email: normalizedEmail,
    password: hashedPassword,
    name: name.trim(),
    callsign,
    ifc: ifc.trim(),
    ifuserid: ifUserId,
    status: 0, // Pending approval
  });

  await models.Application.create({
    pilotid: pilot.id,
    exam_status: 0,
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
              value: `${name} (${callsign})`,
              inline: false,
            },
            {
              name: "IFC Username",
              value: `${ifc.trim()}`,
              inline: false,
            },
            {
              name: "IFC UserId",
              value: `${ifUserId}`,
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

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload),
    });
  }

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
