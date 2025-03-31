import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("token");
  const isCrewRoute = request.nextUrl.pathname.startsWith("/crew");
  const isLoginPage = request.nextUrl.pathname === "/crew";

  if (isCrewRoute) {
    if (!token && !isLoginPage) {
      return NextResponse.redirect(new URL("/crew", request.url));
    }
    if (token && isLoginPage) {
      return NextResponse.redirect(new URL("/crew/home", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/crew/:path*",
};
