import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { models } from "@/lib/models";

const JWT_SECRET = process.env.JWT_SECRET;

export type AuthenticatedUser = {
  id: number;
  email: string;
  permissions: string[];
};

type AuthSuccess = {
  ok: true;
  user: AuthenticatedUser;
  token: string;
};

type AuthFailure = {
  ok: false;
  response: NextResponse;
};

export type AuthResult = AuthSuccess | AuthFailure;

function bearerToken(request: Request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.substring(7).trim();
  return token || null;
}

export async function getRequestToken(request: Request) {
  const headerToken = bearerToken(request);
  if (headerToken) return headerToken;

  try {
    const body = await request.clone().json();
    return typeof body?.token === "string" && body.token.trim()
      ? body.token.trim()
      : null;
  } catch {
    return null;
  }
}

export async function requireAuth(request: Request): Promise<AuthResult> {
  if (!JWT_SECRET) {
    console.error("[Auth] JWT_SECRET is not configured");
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Authentication configuration error" },
        { status: 500 },
      ),
    };
  }

  const token = await getRequestToken(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Authentication token required" },
        { status: 401 },
      ),
    };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id?: number;
      email?: string;
    };

    if (!decoded?.id) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: "Invalid token" },
          { status: 401 },
        ),
      };
    }

    const tokenRecord = await models.Token.findOne({ where: { token } });
    if (
      !tokenRecord ||
      tokenRecord.pilotId !== decoded.id ||
      new Date() > tokenRecord.expiresAt ||
      tokenRecord.isRevoked
    ) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: "Invalid or expired token" },
          { status: 401 },
        ),
      };
    }

    const permissions = await models.Permission.findAll({
      where: { userid: decoded.id },
      attributes: ["name"],
      raw: true,
    });

    return {
      ok: true,
      token,
      user: {
        id: decoded.id,
        email: decoded.email || "",
        permissions: permissions
          .map((permission: any) => permission.name)
          .filter((name: unknown): name is string => typeof name === "string"),
      },
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: "Invalid token" },
          { status: 401 },
        ),
      };
    }

    console.error("[Auth] Error:", error);
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: "Authentication failed" },
        { status: 500 },
      ),
    };
  }
}

export function hasPermission(
  user: AuthenticatedUser,
  permission: string | string[],
) {
  if (user.permissions.includes("admin")) return true;

  const required = Array.isArray(permission) ? permission : [permission];
  return required.some((item) => user.permissions.includes(item));
}

export async function requirePermission(
  request: Request,
  permission: string | string[],
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth;

  if (!hasPermission(auth.user, permission)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      ),
    };
  }

  return auth;
}
