import { constantTimeEqual } from "@/lib/scheduling/infinite-flight/crypto";
import { runIfLivePublisher } from "@/lib/scheduling/infinite-flight/publisher";
import { ifJson, ifRouteError } from "@/lib/scheduling/infinite-flight/http";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  const secret = process.env.IF_LIVE_WORKER_SECRET?.trim();
  if (!secret || secret.length < 32) return new Response("Worker is not configured", { status: 503 });
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ") || !constantTimeEqual(authorization.substring(7), secret)) return new Response("Forbidden", { status: 403 });
  try { return ifJson({ success: true, data: await runIfLivePublisher() }); }
  catch (error) { return ifRouteError(error); }
}
