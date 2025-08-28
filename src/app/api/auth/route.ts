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
        { status: 500 }
      );
    }
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error("[Auth] Error parsing request body:", error);
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
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
      error instanceof Error ? error.stack : "No stack trace"
    );
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
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
      where: { email: normalizedEmail },
      attributes: ["id", "email", "password", "name", "callsign"],
    });
  } catch (error) {
    console.error("[Login] Database query error:", error);
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 }
    );
  }

  if (!pilot) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  let isValidPassword = false;
  try {
    if (!password || !pilot.password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }
    // bcrypt.compare already handles hash validation internally
    isValidPassword = await bcryptjs.compare(password, pilot.password);
  } catch (error) {
    console.error("[Login] Error comparing passwords:", error);
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 }
    );
  }

  if (!isValidPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Store token in database
  try {
    const tokenString = jwt.sign(
      { id: pilot.id, email: pilot.email },
      JWT_SECRET as string,
      {
        expiresIn: "7d",
      }
    );

    // Calculate expiration date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Create token in database
    await models.Token.create({
      pilotId: pilot.id,
      token: tokenString,
      expiresAt,
    });

    // Return token in response body
    const response = NextResponse.json(
      {
        message: "Login successful",
        token: tokenString, // Include database token in response
        user: {
          id: pilot.id,
          name: pilot.name,
          email: pilot.email,
          callsign: pilot.callsign,
        },
      },
      { status: 200 }
    );

    return response;
  } catch (error) {
    console.error("[Login] Error creating token:", error);
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 }
    );
  }
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
}: {
  email: string;
  password: string;
  name: string;
  ifc: string;
}) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingPilot = await models.Pilot.findOne({
    where: { email: normalizedEmail },
  });

  if (existingPilot) {
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 400 }
    );
  }

  const hashedPassword = await bcryptjs.hash(password, 10);
  const callsign = await generateUniqueCallsign();

  const pilot = await models.Pilot.create({
    email: normalizedEmail,
    password: hashedPassword,
    name: name.trim(),
    callsign,
    ifc: "https://community.infinitefllight.com/u/" + ifc.trim(),
    status: 0, // Pending approval
  });

  return NextResponse.json(
    {
      message: `Registration successful. Your callsign is ${pilot.callsign}. Please check your inbox for an email with more information incoming.`,
    },
    { status: 201 }
  );
}
