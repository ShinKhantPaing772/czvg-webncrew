import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function request(path: string, method = "GET") {
  return new NextRequest(`https://ifczvg.com${path}`, {
    method,
    headers: { Authorization: "Bearer existing-admin-session" },
  });
}

afterEach(() => vi.unstubAllEnvs());

describe("manual Crew Center maintenance", () => {
  it("leaves normal access open by default and after the switch is turned off", () => {
    vi.stubEnv("CREW_LOGIN_DISABLED", undefined);
    expect(middleware(request("/crew/home")).headers.get("x-middleware-next")).toBe("1");
    vi.stubEnv("CREW_LOGIN_DISABLED", "true");
    expect(middleware(request("/api/pireps", "POST")).status).toBe(503);
    vi.stubEnv("CREW_LOGIN_DISABLED", "false");
    expect(middleware(request("/api/pireps", "POST")).headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["/crew", "/crew/home", "/crew/admin/users", "/crew/application", "/oauth/callback?code=oauth-code"])(
    "shows maintenance instead of %s even with a session",
    (path) => {
      vi.stubEnv("CREW_LOGIN_DISABLED", "true");
      const response = middleware(request(path));
      expect(response.status).toBe(503);
      expect(response.headers.get("x-middleware-rewrite")).toBe("https://ifczvg.com/maintenance");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    },
  );

  it.each([
    ["/api/auth", "POST"],
    ["/api/auth/verify", "POST"],
    ["/api/pireps", "POST"],
    ["/api/admin/users", "PUT"],
    ["/api/pilots/42/dashboard", "GET"],
    ["/api/auth/maintenance", "POST"],
  ])("blocks %s %s before a protected handler can run", async (path, method) => {
    vi.stubEnv("CREW_LOGIN_DISABLED", "true");
    const response = middleware(request(path, method));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "CREW_LOGIN_DISABLED" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each(["/", "/operations/fleet", "/maintenance", "/api/auth/maintenance"])(
    "keeps public browsing and maintenance status available at %s",
    (path) => {
      vi.stubEnv("CREW_LOGIN_DISABLED", "true");
      expect(middleware(request(path)).headers.get("x-middleware-next")).toBe("1");
    },
  );
});
