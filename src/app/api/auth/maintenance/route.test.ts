import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/auth/maintenance", () => {
  it.each([
    [undefined, false],
    ["false", false],
    ["true", true],
    [" TRUE ", true],
    ["1", false],
  ])("reports the login switch for %s without caching", async (value, loginDisabled) => {
    vi.stubEnv("CREW_LOGIN_DISABLED", value);
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ loginDisabled });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("reads the current switch on every request", async () => {
    vi.stubEnv("CREW_LOGIN_DISABLED", "true");
    expect(await (await GET()).json()).toEqual({ loginDisabled: true });

    vi.stubEnv("CREW_LOGIN_DISABLED", "false");
    expect(await (await GET()).json()).toEqual({ loginDisabled: false });
  });
});
