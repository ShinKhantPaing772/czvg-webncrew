import { NextResponse, type NextRequest } from "next/server";

import { handleCrewPreviewApi, isCrewPreviewEnabled } from "@/lib/mock/crew-preview";

export function middleware(request: NextRequest) {
  if (!isCrewPreviewEnabled()) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const previewResponse = handleCrewPreviewApi(request);
    if (previewResponse) return previewResponse;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
