import { isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { NextRequest } from "next/server";
import bcryptjs from "bcryptjs";
import { Sequelize } from "sequelize";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Only a deliberately named scratch database may be used; remote access requires verified TLS and explicit opt-in. Each suite
// owns one temporary schema; application/production DB_* settings are ignored.
const suppliedUrl = process.env.SCHEDULING_TEST_DATABASE_URL;

function remoteTestTlsAllowed(target: URL) {
  return process.env.SCHEDULING_TEST_ALLOW_REMOTE === "1"
    && target.searchParams.get("sslmode") === "verify-full"
    && isAbsolute(target.searchParams.get("sslrootcert") || "");
}

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(), userLookup: vi.fn(), findUser: vi.fn(), rateLimited: vi.fn(), sendOtp: vi.fn(),
}));
vi.mock("@/lib/server-auth", () => ({
  requirePermission: mocks.authorize,
  requireCrewAuth: mocks.authorize,
  requireAuth: mocks.authorize,
  hasPermission: vi.fn().mockReturnValue(true),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  applicationReceivedEmail: vi.fn(), getApplicantPortalUrl: vi.fn(), sendEmail: vi.fn(),
  discordInviteEmail: vi.fn(), examGradeEmail: vi.fn(), getCrewCenterUrl: vi.fn(), pilotApprovedEmail: vi.fn(),
}));
vi.mock("@/lib/infinite-flight-api", () => ({
  findInfiniteFlightUser: mocks.findUser, getInfiniteFlightUser: mocks.userLookup, InfiniteFlightApiError: class extends Error {},
  isInfiniteFlightId: (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  normalizeInfiniteFlightId: (value: unknown) => typeof value === "string" ? value.trim().toLowerCase() : "",
}));
vi.mock("@/lib/infinite-flight/lookup-rate-limit", () => ({ isIfcLookupRateLimited: mocks.rateLimited }));
vi.mock("@/lib/auth/password-reset-email", () => ({ sendPasswordResetOtp: mocks.sendOtp }));
// Catalog synchronization has its own integration coverage. Keep this suite's
// fixtures stable while exercising actual award reads in dashboard/inbox paths.
vi.mock("@/lib/awards/sync", () => ({ ensureAwardCatalogSeeded: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/discord-webhook", () => ({ postDiscordWebhook: vi.fn() }));

function isolatedTestTarget(raw: string) {
  const target = new URL(raw);
  const database = decodeURIComponent(target.pathname.slice(1));
  const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(target.hostname);
  if (!["postgres:", "postgresql:"].includes(target.protocol)
    || !/^webncrew_scheduling_test_[a-z0-9_]+$/i.test(database)
    || (!loopback && !remoteTestTlsAllowed(target))) {
    throw new Error("API integration tests require webncrew_scheduling_test_<name>; remote access requires SCHEDULING_TEST_ALLOW_REMOTE=1, sslmode=verify-full and an absolute sslrootcert path");
  }
  return target.toString();
}

describe.skipIf(!suppliedUrl)("PostgreSQL Crew Center API queries", () => {
  let database: Sequelize;
  let administrator: Sequelize;
  let base: typeof import("@/lib/models").models;
  const schema = `api_test_${randomUUID().replaceAll("-", "")}`;
  let mayCleanUp = false;

  beforeAll(async () => {
    const target = isolatedTestTarget(suppliedUrl!);
    const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(new URL(target).hostname);
    administrator = new Sequelize(target, { dialect: "postgres", logging: false, pool: { max: 1, min: 0 }, dialectOptions: { ...(loopback ? { ssl: false } : {}) } });
    await administrator.query(`CREATE SCHEMA "${schema}"`);
    mayCleanUp = true;
    database = new Sequelize(target, {
      dialect: "postgres", logging: false, timezone: "+00:00", pool: { max: 4, min: 0 },
      dialectOptions: { options: `-c search_path=${schema},public -c timezone=UTC`, ...(loopback ? { ssl: false } : {}) },
    });
    await database.query(await readFile(new URL("../../../migrations/postgresql/001_baseline.sql", import.meta.url), "utf8"));
    vi.doMock("@/lib/database", () => ({ default: database, testConnection: vi.fn().mockResolvedValue(true) }));
    vi.stubEnv("JWT_SECRET", "isolated-api-integration-test-secret");
    base = (await import("@/lib/models")).models;
  }, 30_000);

  beforeEach(async () => {
    await database.query("TRUNCATE pilots, aircraft, ranks, awards, routes, news, otps, api_cache RESTART IDENTITY CASCADE");
    mocks.authorize.mockResolvedValue({ ok: true, user: { id: 1, email: "pilot@example.com", permissions: ["admin"] } });
    mocks.rateLimited.mockResolvedValue(false);
    mocks.sendOtp.mockReset().mockResolvedValue(true);
    await base.Pilot.create({ name: "Migrated Pilot", callsign: "China Southern 101VG", ifc: "MixedPilot", email: "Pilot@Example.com", password: await bcryptjs.hash("test-password", 4), status: 1, joined: new Date("2026-11-08T23:30:00Z") });
    await base.Rank.create({ name: "Trainee", timereq: 0 });
    await base.Aircraft.create({ rankreq: 1, name: "Airbus A350", liveryname: "CZVG", status: 1 });
    await base.Route.bulkCreate([
      { fltnum: "CZ001", dep: "ZGGG", arr: "ZBAA", duration: 5400 },
      { fltnum: "CZ002", dep: "ZGGG", arr: "ZSSS", duration: 1800 },
    ]);
    await base.RouteAircraft.create({ routeid: 1, aircraftid: 1 });
    await base.Pirep.create({ flightnum: "CZ001", departure: "ZGGG", arrival: "ZBAA", flighttime: 5400, pilotid: 1, date: "2026-11-08", aircraftid: 1, fuelused: 300, multi: "[]", status: 1 });
    await base.Application.create({ pilotid: 1, exam_status: 1, exam_score: 85 });
    await base.Permission.bulkCreate([{ userid: 1, name: "routes" }, { userid: 1, name: "home" }]);
  });

  afterAll(async () => {
    if (database) await database.close();
    if (administrator) {
      try { if (mayCleanUp) await administrator.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await administrator.close(); }
    }
    vi.doUnmock("@/lib/database");
    vi.unstubAllEnvs();
  });

  it("returns native aircraft JSON arrays and empty arrays for unassigned routes", async () => {
    const { GET } = await import("./routes/route");
    const response = await GET(new Request("http://localhost/api/routes?fltnum=cz&dep=zggg"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.pagination.total).toBe(2);
    expect(body.data.find((route: { id: number }) => route.id === 1).aircraft).toEqual([
      expect.objectContaining({ id: 1, name: "Airbus A350", status: 1 }),
    ]);
    expect(body.data.find((route: { id: number }) => route.id === 2).aircraft).toEqual([]);

    const { GET: routeDetail } = await import("./routes/[id]/route");
    const detail = await routeDetail(new Request("http://localhost/api/routes/1"), { params: Promise.resolve({ id: "1" }) });
    expect(detail.status).toBe(200);
    expect((await detail.json()).data).toMatchObject({ aircraft: [expect.objectContaining({ id: 1 })], recentFlights: [expect.objectContaining({ pilot: "Migrated Pilot" })] });

    const { GET: adminDetail } = await import("./admin/routes/[id]/route");
    const empty = await adminDetail(new Request("http://localhost/api/admin/routes/2"), { params: Promise.resolve({ id: "2" }) });
    expect(empty.status).toBe(200);
    expect((await empty.json()).data.aircraft).toEqual([]);
  });

  it("keeps chart counts numeric, fractional flight hours and UTC date labels", async () => {
    const { GET } = await import("./admin/dashboard/analytics/route");
    const response = await GET(new Request("http://localhost/api/admin/dashboard/analytics?startDate=2026-11-08&endDate=2026-11-08"));
    expect(response.status).toBe(200);
    const { sections } = await response.json();
    expect(sections.overview.range).toEqual({ approvedPireps: 1, flightHours: 1.5, newPilots: 1 });
    expect(sections.pireps.trends).toEqual([{ label: "2026-11-08", flights: 1, hours: 1.5 }]);
    expect(sections.pireps.topDepartures).toEqual([{ label: "ZGGG", value: 1 }]);
    expect(sections.users.growth).toEqual([{ label: "2026-11-08", pilots: 1 }]);
    expect(sections.routes.durationBuckets.map((bucket: { value: number }) => bucket.value)).toEqual([1, 1]);
    expect(sections.aircrafts.usage[0].value).toBe(1);
    expect(sections.permissions.distribution.every((entry: { value: unknown }) => typeof entry.value === "number")).toBe(true);
  });

  it("preserves camelCase admin aliases and sorted permission aggregation", async () => {
    const { GET } = await import("./admin/users/route");
    const response = await GET(new Request("http://localhost/api/admin/users"));
    expect(response.status).toBe(200);
    expect((await response.json())[0]).toMatchObject({ examStatus: 1, examScore: 85, lastActivity: "2026-11-08" });

    const { GET: permissions } = await import("./admin/permissions/route");
    const roles = await permissions(new Request("http://localhost/api/admin/permissions"));
    expect(roles.status).toBe(200);
    expect((await roles.json()).admins[0]).toMatchObject({ lastActive: "2026-11-08", permissions: ["home", "routes"] });
  });

  it.each(["2026-11", "300", "airbus"])("searches date, numeric and joined aircraft fields for %s", async (search) => {
    const { GET } = await import("./pilots/[id]/pireps/route");
    const response = await GET(new Request(`http://localhost/api/pilots/1/pireps?search=${search}`), { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(200);
    expect((await response.json()).pagination.total).toBe(1);
  });

  it("searches admin PIREPs through joined pilot fields", async () => {
    const { GET } = await import("./admin/pireps/route");
    const response = await GET(new Request("http://localhost/api/admin/pireps?search=migrated"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.pagination.total).toBe(1);
    expect(body.data.pireps[0]).toMatchObject({ date: "2026-11-08", flighttimeSeconds: 5400 });
  });

  it("logs in an existing mixed-case email and persists quoted token columns", async () => {
    const { POST } = await import("./auth/route");
    const response = await POST(new NextRequest("http://localhost/api/auth", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: " pilot@example.com ", password: "test-password" }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe(1);
    const token = await base.Token.findOne({ where: { token: body.token } });
    expect(token?.pilotId).toBe(1);
    expect(token?.isRevoked).toBe(false);
    expect(token?.expiresAt).toBeInstanceOf(Date);
  });

  it("resets a migrated mixed-case account and revokes its persisted sessions", async () => {
    const { resetPassword } = await import("@/lib/auth/password-reset");
    await base.OTP.create({ email: "Pilot@Example.com", otp: await bcryptjs.hash("123456", 4), expires: new Date(Date.now() + 60_000) });
    await base.Token.create({ pilotId: 1, token: "password-reset-test-session", expiresAt: new Date(Date.now() + 60_000) });
    const response = await resetPassword("pilot@example.com", "123456", "replacement-password");
    expect(response.status).toBe(200);
    expect(await base.Token.count({ where: { pilotId: 1 } })).toBe(0);
    expect(await base.OTP.count()).toBe(0);
    expect(await bcryptjs.compare("replacement-password", (await base.Pilot.findByPk(1))!.password)).toBe(true);
  });

  function writeRequest(path: string, body: Record<string, unknown>, method = "POST") {
    return new NextRequest(`http://localhost${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  it("creates a signup, application and login token using PostgreSQL generated IDs", async () => {
    const identity = { userId: "11111111-1111-4111-8111-111111111111", grade: 3, violations: 2 };
    mocks.userLookup.mockResolvedValue({ data: { result: [identity] } });
    mocks.findUser.mockReturnValue(identity);
    const random = vi.spyOn(Math, "random").mockReturnValue(0.1);
    try {
      const { POST } = await import("./auth/route");
      const response = await POST(writeRequest("/api/auth", { action: "signup", email: " New.Pilot@Example.com ", ifc: "NewPilot", name: "New Pilot", password: "signup-password" }));
      expect(response.status).toBe(201);
      const body = await response.json();
      const pilot = await base.Pilot.findOne({ where: { email: "new.pilot@example.com" } });
      expect(pilot?.id).toBe(2);
      expect(await base.Application.findOne({ where: { pilotid: 2 } })).toMatchObject({ exam_status: 0, if_grade: 3, if_violations: 2 });
      expect(await base.Token.findOne({ where: { token: body.token } })).toMatchObject({ pilotId: 2, isRevoked: false });
      const duplicate = await POST(writeRequest("/api/auth", { action: "signup", email: "other@example.com", ifc: "mixedpilot", name: "Another Pilot", password: "signup-password" }));
      expect(duplicate.status).toBe(400);
      expect((await duplicate.json()).error).toContain("IFC username");
    } finally { random.mockRestore(); }
  });

  it("creates applicant records concurrently and updates exam/replay fields", async () => {
    await base.Pilot.update({ status: 0 }, { where: { id: 1 } });
    await base.Application.destroy({ where: { pilotid: 1 } });
    const { GET, POST } = await import("./applicant/status/route");
    const responses = await Promise.all([GET(new Request("http://localhost/api/applicant/status")), GET(new Request("http://localhost/api/applicant/status"))]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await base.Application.count({ where: { pilotid: 1 } })).toBe(1);
    expect((await (await POST(writeRequest("/api/applicant/status", {}))).json()).examDeclared).toBe(true);
    expect((await (await POST(writeRequest("/api/applicant/status", { action: "undeclareExam" }))).json()).examDeclared).toBe(false);
    await base.Application.update({ exam_score: 65.5 }, { where: { pilotid: 1 } });
    const replay = await POST(writeRequest("/api/applicant/status", { action: "flightReplay", flightReplayUrl: "https://sharemyinfiniteflight.com/flight/test" }));
    expect(replay.status).toBe(200);
    expect(await base.Application.findOne({ where: { pilotid: 1 } })).toMatchObject({ flight_replay_url: "https://sharemyinfiniteflight.com/flight/test" });
    expect((await (await GET(new Request("http://localhost/api/applicant/status"))).json()).examScore).toBe(65.5);
  });

  it("verifies and logs out persisted sessions through joined permission rows", async () => {
    const { POST: login } = await import("./auth/route");
    const signed = await login(writeRequest("/api/auth", { email: "pilot@example.com", password: "test-password" }));
    const { token } = await signed.json();
    await base.Token.create({ pilotId: 1, token: "expired-session", expiresAt: new Date(Date.now() - 60_000) });
    const { POST: verify } = await import("./auth/verify/route");
    const verified = await verify(writeRequest("/api/auth/verify", { token }));
    expect(verified.status).toBe(200);
    expect((await verified.json()).Permissions).toEqual(expect.arrayContaining([expect.objectContaining({ name: "home" }), expect.objectContaining({ name: "routes" })]));
    expect(await base.Token.findOne({ where: { token: "expired-session" } })).toBeNull();
    const actualAuth = await vi.importActual<typeof import("@/lib/server-auth")>("@/lib/server-auth");
    expect((await actualAuth.requireCrewAuth(new Request("http://localhost", { headers: { Authorization: `Bearer ${token}` } }))).ok).toBe(true);
    await base.Token.update({ isRevoked: true }, { where: { token } });
    expect((await actualAuth.requireAuth(new Request("http://localhost", { headers: { Authorization: `Bearer ${token}` } }))).ok).toBe(false);
    const { POST: logout } = await import("./auth/logout/route");
    expect((await logout(writeRequest("/api/auth/logout", { token }))).status).toBe(200);
    expect((await verify(writeRequest("/api/auth/verify", { token }))).status).toBe(401);
  });

  it("creates and verifies password-reset OTPs for migrated mixed-case emails", async () => {
    const { requestPasswordResetOtp, verifyPasswordResetOtp } = await import("@/lib/auth/password-reset");
    expect((await requestPasswordResetOtp("pilot@example.com")).status).toBe(200);
    const { otp } = mocks.sendOtp.mock.calls[0][0];
    expect(await base.OTP.count()).toBe(1);
    expect((await verifyPasswordResetOtp("pilot@example.com", otp)).status).toBe(200);
  });

  it("runs manual aircraft CRUD and rank/award requirement queries", async () => {
    const { GET, POST, PUT, DELETE } = await import("./aircraft/route");
    const created = await POST(writeRequest("/api/aircraft", { source: "manual", name: "Test A320", liveryName: "CZVG", rankReq: 1 }));
    expect(created.status).toBe(200);
    const id = (await created.json()).data.id;
    const edited = await PUT(writeRequest("/api/aircraft", { id, source: "manual", name: "Test A321", liveryName: "CZVG", rankReq: 1 }, "PUT"));
    expect(edited.status).toBe(200);
    expect((await (await GET()).json()).aircrafts).toEqual(expect.arrayContaining([expect.objectContaining({ id, name: "Test A321" })]));
    const { GET: requirements } = await import("./aircraft/requirements/route");
    expect((await requirements(new Request("http://localhost/api/aircraft/requirements"))).status).toBe(200);
    expect((await DELETE(new Request(`http://localhost/api/aircraft?id=${id}`, { method: "DELETE" }))).status).toBe(200);
    expect(await base.Aircraft.findByPk(id)).toMatchObject({ status: 0 });
  });

  it("reads pilot profiles, sums and award associations in the dashboard", async () => {
    const award = await base.Award.create({ name: "Custom Audit Award", description: "Test", imageurl: "https://example.com/custom.png", criteria: { type: "manual" } });
    await base.AwardGranted.create({ pilotid: 1, awardid: award.id, dateawarded: "2026-11-08" });
    const { GET: profile } = await import("./pilots/[id]/route");
    expect((await profile(new Request("http://localhost/api/pilots/1"), { params: Promise.resolve({ id: "1" }) })).status).toBe(200);
    const { GET } = await import("./pilots/[id]/dashboard/route");
    const response = await GET(new Request("http://localhost/api/pilots/1/dashboard"), { params: Promise.resolve({ id: "1" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.statistics).toMatchObject({ approvedFlightSeconds: 5400, approvedPireps: 1 });
    expect(body.awards.received).toEqual(expect.arrayContaining([expect.objectContaining({ id: award.id, dateAwarded: "2026-11-08" })]));
    expect(body.recentPireps[0]).toMatchObject({ date: "2026-11-08", aircraft: { id: 1, name: "Airbus A350", liveryname: "CZVG" } });
  });

  it("resolves custom legacy award names without losing case-insensitive matching and marks inbox rows read", async () => {
    const award = await base.Award.create({ name: "Custom Audit Award", name_zh: "测试奖章", description: "Test", imageurl: "https://example.com/custom.png" });
    const notification = await base.Notification.create({ pilotid: 1, icon: "award", subject: "获得新勋章", content: "祝贺你解锁了成就勋章【custom audit award】！" });
    const { GET, PATCH } = await import("./pilots/[id]/notifications/route");
    const params = { params: Promise.resolve({ id: "1" }) };
    const response = await GET(new Request("http://localhost/api/pilots/1/notifications"), params);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.unreadCount).toBe(1);
    expect(body.notifications[0].award).toMatchObject({ id: award.id, nameZh: "测试奖章", imageurl: "https://example.com/custom.png" });
    const marked = await PATCH(writeRequest("/api/pilots/1/notifications", { ids: [notification.id] }, "PATCH"), params);
    expect((await marked.json())).toMatchObject({ updated: 1, unreadCount: 0 });
  });

  it("submits DATEONLY PIREPs without timezone shifts and detects duplicates", async () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = "America/Toronto";
    try {
      const expectedDate = new Date().toISOString().slice(0, 10);
      const body = { pilotid: 1, flightnum: "CZDATE", departure: "ZGGG", arrival: "ZBAA", flightTime: "01:00", date: expectedDate, aircraftId: 1, fuelUsed: "300", notes: "Pilot note" };
      const { POST } = await import("./pireps/route");
      const response = await POST(writeRequest("/api/pireps", body));
      expect(response.status).toBe(200);
      const saved = (await response.json()).pirep;
      expect(saved.date).toBe(expectedDate);
      expect(await base.PirepComment.findOne({ where: { pirepid: saved.id } })).toMatchObject({ content: "Pilot note" });
      expect((await POST(writeRequest("/api/pireps", body))).status).toBe(409);
      const { POST: comment } = await import("./pilots/[id]/pireps/route");
      const note = await comment(writeRequest("/api/pilots/1/pireps", { pirepId: saved.id, content: "Second comment" }), { params: Promise.resolve({ id: "1" }) });
      expect(note.status).toBe(201);
      expect((await note.json()).comment.User).toMatchObject({ id: 1, name: "Migrated Pilot" });
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });

  it("treats nonnumeric multiplier codes as invalid input rather than PostgreSQL integer errors", async () => {
    const { POST } = await import("./pireps/route");
    const response = await POST(writeRequest("/api/pireps", { pilotid: 1, flightnum: "CZMULTI", departure: "ZGGG", arrival: "ZBAA", flightTime: "01:00", date: new Date().toISOString().slice(0, 10), aircraftId: 1, fuelUsed: "300", multi: "invalid" }));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Invalid multiplier code");
  });

});
