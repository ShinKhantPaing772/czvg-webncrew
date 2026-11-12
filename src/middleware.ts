import { NextRequest, NextResponse } from "next/server";
import {
  CREW_LOGIN_DISABLED_MESSAGE,
  isCrewLoginDisabled,
} from "@/lib/login-maintenance";

export function middleware(request: NextRequest) {
  if (!isCrewLoginDisabled()) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/api/auth/maintenance" && request.method === "GET") {
    return NextResponse.next();
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return NextResponse.json(
      { code: "CREW_LOGIN_DISABLED", error: CREW_LOGIN_DISABLED_MESSAGE },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (pathname === "/crew" || pathname.startsWith("/crew/") || pathname === "/oauth/callback") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/maintenance";
    destination.search = "";
    return NextResponse.rewrite(destination, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/crew/:path*", "/api/:path*", "/oauth/callback"],
};
