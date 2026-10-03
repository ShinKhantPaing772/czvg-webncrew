import { NextResponse } from "next/server";
import { IfLiveError } from "./config";

export function ifRouteError(error: unknown) {
  if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: "Request body must be valid JSON", code: "validation" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (error instanceof IfLiveError) return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: error.status >= 400 && error.status <= 599 ? error.status : 502, headers: { "Cache-Control": "no-store", ...(error.status === 429 ? { "Retry-After": String(error.retryAfterSeconds) } : {}) } });
  // Database/provider errors can include sensitive query parameters. Do not return or log them.
  return NextResponse.json({ success: false, error: "IF scheduling integration is unavailable; confirm the migration and configuration are installed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export function ifJson(value: unknown) { return NextResponse.json(value, { headers: { "Cache-Control": "no-store" } }); }
