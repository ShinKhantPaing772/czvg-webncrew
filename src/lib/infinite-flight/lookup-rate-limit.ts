import { incrementCounter } from "@/lib/utils/if-cache";

// IFC username lookups run before login (signup), yet each one spends the
// VA's Infinite Flight API budget that ACARS and scheduling also need.
const CLIENT_LIMIT = 30; // lookups per client IP per window
const CLIENT_WINDOW_SECONDS = 10 * 60;
const GLOBAL_LIMIT = 15; // lookups per window across all clients
const GLOBAL_WINDOW_SECONDS = 60;

function clientIp(request: Request) {
  // Vercel overwrites x-forwarded-for, so clients can't spoof it there.
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim();
  return ip ? ip.slice(0, 64) : "unknown";
}

/** Counts one public IFC lookup and reports whether it is over the limits. */
export async function isIfcLookupRateLimited(request: Request) {
  const clientHits = await incrementCounter(
    `rate:ifc-lookup:ip:${clientIp(request)}`,
    CLIENT_WINDOW_SECONDS,
  );
  // Checked first, so a client over its own limit can't use up the shared
  // budget and lock everyone else out.
  if (clientHits > CLIENT_LIMIT) return true;

  const globalHits = await incrementCounter(
    "rate:ifc-lookup:all",
    GLOBAL_WINDOW_SECONDS,
  );
  return globalHits > GLOBAL_LIMIT;
}
