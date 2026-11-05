import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  incrementCounter: vi.fn(),
  getInfiniteFlightUser: vi.fn(),
  findInfiniteFlightUser: vi.fn(),
}));

vi.mock("@/lib/utils/if-cache", () => ({
  incrementCounter: mocks.incrementCounter,
}));

vi.mock("@/lib/infinite-flight-api", () => {
  class InfiniteFlightApiError extends Error {
    constructor(
      message: string,
      readonly status = 502,
    ) {
      super(message);
    }
  }

  return {
    getInfiniteFlightUser: mocks.getInfiniteFlightUser,
    findInfiniteFlightUser: mocks.findInfiniteFlightUser,
    InfiniteFlightApiError,
  };
});

import { GET } from "./route";

const CLIENT_KEY = "rate:ifc-lookup:ip:203.0.113.7";
const GLOBAL_KEY = "rate:ifc-lookup:all";
const ifUser = { userId: "if-user-1", discourseUsername: "NewPilot" };

function lookup(username = "NewPilot") {
  const request = new NextRequest(
    `http://localhost/api/auth/ifc/${username}`,
    { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } },
  );
  return GET(request, { params: Promise.resolve({ username }) });
}

function countHits(hits: Record<string, number>) {
  mocks.incrementCounter.mockImplementation(async (key: string) => hits[key]);
}

describe("GET /api/auth/ifc/[username] rate limits", () => {
  beforeEach(() => {
    mocks.getInfiniteFlightUser.mockResolvedValue({
      data: { errorCode: 0, result: [ifUser] },
      cacheStatus: "MISS",
    });
    mocks.findInfiniteFlightUser.mockReturnValue(ifUser);
  });

  it("looks the user up while both limits have room", async () => {
    countHits({ [CLIENT_KEY]: 30, [GLOBAL_KEY]: 15 });

    const response = await lookup();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.result).toEqual([ifUser]);
    expect(mocks.incrementCounter).toHaveBeenCalledWith(CLIENT_KEY, 600);
    expect(mocks.incrementCounter).toHaveBeenCalledWith(GLOBAL_KEY, 60);
    expect(mocks.getInfiniteFlightUser).toHaveBeenCalledWith("NewPilot");
  });

  it("stops a client over its own limit without spending the shared budget", async () => {
    countHits({ [CLIENT_KEY]: 31 });

    const response = await lookup();

    expect(response.status).toBe(429);
    expect(mocks.incrementCounter).toHaveBeenCalledTimes(1);
    expect(mocks.getInfiniteFlightUser).not.toHaveBeenCalled();
  });

  it("stops every client once the shared budget is spent", async () => {
    countHits({ [CLIENT_KEY]: 1, [GLOBAL_KEY]: 16 });

    const response = await lookup();
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toMatch(/too many/i);
    expect(mocks.getInfiniteFlightUser).not.toHaveBeenCalled();
  });
});
