import { NextRequest, NextResponse } from "next/server";
import { models } from "@/lib/db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request: NextRequest) {
  try {
    console.log("[Auth] Received auth request");
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
      console.log("[Auth] Request body:", body);
    } catch (error) {
      console.error("[Auth] Error parsing request body:", error);
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }

    const { action = "login", ...data } = body;
    console.log("[Auth] Database connection status: Connected");

    switch (action) {
      case "login":
        console.log("Processing login request");
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
  console.log("[Login] Attempt for email:", email);
  const normalizedEmail = email.trim().toLowerCase();
  console.log("[Login] Normalized email:", normalizedEmail);
  console.log("[Login] Attempting database query...");

  let pilot;
  try {
    pilot = await models.Pilot.findOne({
      where: { email: normalizedEmail },
      attributes: ["id", "email", "password", "name", "callsign"],
    });
    console.log("[Login] Database query successful");
  } catch (error) {
    console.error("[Login] Database query error:", error);
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 }
    );
  }

  if (!pilot) {
    console.log("No pilot found with email:", normalizedEmail);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  console.log("[Login] Pilot found:", { id: pilot.id, email: pilot.email });
  console.log("[Login] Stored hash length:", pilot.password?.length);
  console.log("[Login] Input password length:", password?.length);
  console.log("[Login] Starting password comparison...");

  let isValidPassword = false;
  try {
    if (!password || !pilot.password) {
      console.log("[Login] Error: Missing password or stored hash");
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }
    if (!/^\$2[abxy]\$\d+\$/.test(pilot.password)) {
      console.log("[Login] Error: Invalid hash format in database");
      return NextResponse.json(
        { error: "Authentication error" },
        { status: 500 }
      );
    }
    isValidPassword = await bcrypt.compare(password, pilot.password);
    console.log(
      "[Login] Password comparison completed. Match result:",
      isValidPassword
    );
  } catch (error) {
    console.error("[Login] Error comparing passwords:", error);
    if (
      error instanceof Error &&
      error.message.includes("Invalid salt version")
    ) {
      console.log("[Login] Invalid hash format detected in error");
      return NextResponse.json(
        { error: "Authentication error" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Authentication error" },
      { status: 500 }
    );
  }

  if (!isValidPassword) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = jwt.sign(
    { id: pilot.id, email: pilot.email },
    JWT_SECRET as string,
    {
      expiresIn: "7d",
    }
  );

  const response = NextResponse.json(
    {
      message: "Login successful",
      user: {
        id: pilot.id,
        name: pilot.name,
        email: pilot.email,
        callsign: pilot.callsign,
      },
    },
    { status: 200 }
  );

  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return response;
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

  const hashedPassword = await bcrypt.hash(password, 10);
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
