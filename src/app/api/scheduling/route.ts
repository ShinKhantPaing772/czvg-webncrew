import { NextResponse } from "next/server";
import { requireLivePilotAuth } from "@/lib/scheduling/access";
import { requestFlight, changeFlight, schedulingSnapshot, schedulingFailure } from "@/lib/scheduling/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const auth = await requireLivePilotAuth(request);
    if (!auth.ok) return auth.response;
    return NextResponse.json(await schedulingSnapshot({ id: auth.user.id, admin: false }));
  } catch (error) { const failure = schedulingFailure(error); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
}
async function mutate(request: Request, creating: boolean) {
  try {
    const auth = await requireLivePilotAuth(request);
    if (!auth.ok) return auth.response;
    let body: Record<string, unknown>;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request body" }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    if (creating && body.action !== "request") return NextResponse.json({ error: "Unknown scheduling action" }, { status: 400 });
    const result = await (creating ? requestFlight : changeFlight)({ id: auth.user.id, admin: false }, body);
    return NextResponse.json({ success: true, ...result }, { status: creating ? 201 : 200 });
  } catch (error) { const failure = schedulingFailure(error); return NextResponse.json({ error: failure.error }, { status: failure.status }); }
}
export const POST = (request: Request) => mutate(request, true);
export const PATCH = (request: Request) => mutate(request, false);
