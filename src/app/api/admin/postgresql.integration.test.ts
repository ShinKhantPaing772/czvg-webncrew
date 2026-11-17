import { isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { QueryTypes, Sequelize } from "sequelize";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const suppliedUrl = process.env.SCHEDULING_TEST_DATABASE_URL;

function remoteTestTlsAllowed(target: URL) {
  return process.env.SCHEDULING_TEST_ALLOW_REMOTE === "1"
    && target.searchParams.get("sslmode") === "verify-full"
    && isAbsolute(target.searchParams.get("sslrootcert") || "");
}

// These tests run real admin route handlers/Sequelize queries in an owned
// PostgreSQL schema. Authentication and external integrations are isolated.
describe.skipIf(!suppliedUrl)("PostgreSQL admin query compatibility", () => {
  let database: Sequelize;
  let models: typeof import("@/lib/models").models;
  let api: {
    ranks: typeof import("./ranks/route");
    multipliers: typeof import("./multipliers/route");
    awards: typeof import("./awards/route");
    users: typeof import("./users/route");
    metrics: typeof import("./users/if-metrics/route");
    permissions: typeof import("./permissions/route");
    routes: typeof import("./routes/route");
    routeDetail: typeof import("./routes/[id]/route");
    routeImport: typeof import("./routes/bulk-import/route");
    pilotAwards: typeof import("./pilot-awards/route");
    pireps: typeof import("./pireps/route");
    dashboard: typeof import("./dashboard/route");
    filteredDashboard: typeof import("./dashboard/filter/route");
    analytics: typeof import("./dashboard/analytics/route");
  };
  const schema = `crew_admin_test_${randomUUID().replaceAll("-", "")}`;
  let mayCleanUp = false;
  let resetSequences: string;

  function request(path: string, method = "GET", body?: unknown) {
    return new Request(`https://crew.example.test/api/admin/${path}`, {
      method,
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  }

  async function body(response: Response, status = 200) {
    const result = await response.json();
    expect(response.status, JSON.stringify(result)).toBe(status);
    return result;
  }

  beforeAll(async () => {
    const target = new URL(suppliedUrl!);
    const name = decodeURIComponent(target.pathname.slice(1));
    const loopback = ["localhost", "127.0.0.1", "[::1]", "::1"].includes(target.hostname);
    if (!["postgres:", "postgresql:"].includes(target.protocol) || !/^webncrew_scheduling_test_[a-z0-9_]+$/i.test(name) || (!loopback && !remoteTestTlsAllowed(target))) {
      throw new Error("Admin SQL tests require webncrew_scheduling_test_*; remote access requires SCHEDULING_TEST_ALLOW_REMOTE=1, sslmode=verify-full and an absolute sslrootcert path");
    }
    database = new Sequelize(target.toString(), {
      dialect: "postgres", logging: false, timezone: "+00:00", pool: { min: 0, max: 4 },
      dialectOptions: { options: `-c search_path=${schema},public`, ...(loopback ? { ssl: false } : {}) },
    });
    await database.authenticate();
    const selected = await database.query<{ name: string }>("SELECT current_database() AS name", { type: QueryTypes.SELECT });
    if (selected[0]?.name !== name) throw new Error("The admin test connection selected an unexpected database");
    await database.query(`CREATE SCHEMA "${schema}"`);
    mayCleanUp = true;
    await database.query(await readFile(new URL("../../../../migrations/postgresql/001_baseline.sql", import.meta.url), "utf8"));
    resetSequences = await readFile(new URL("../../../../migrations/postgresql/002_reset_identity_sequences.sql", import.meta.url), "utf8");

    vi.doMock("@/lib/database", () => ({ default: database }));
    models = (await import("@/lib/models")).models;
    vi.doMock("@/lib/server-auth", () => ({
      requirePermission: async () => ({ ok: true, user: { id: 9, email: "admin@example.com", permissions: ["admin"] } }),
      hasPermission: () => true,
    }));
    vi.doMock("next/server", async () => ({ ...await vi.importActual<typeof import("next/server")>("next/server"), after: vi.fn() }));
    vi.doMock("@/lib/awards/columns", () => ({ getSafeAwards: (options: object = {}) => models.Award.findAll({ raw: true, ...options }) }));
    vi.doMock("@/lib/awards/evaluator", () => ({ evaluateAndGrantAwards: vi.fn() }));
    vi.doMock("@/lib/infinite-flight-api", () => ({
      getInfiniteFlightUser: async () => ({ data: { result: [] }, cacheStatus: "MISS" }),
      findInfiniteFlightUser: () => ({ grade: 4, violations: 3 }),
      InfiniteFlightApiError: class extends Error {},
    }));
    api = {
      ranks: await import("./ranks/route"),
      multipliers: await import("./multipliers/route"),
      awards: await import("./awards/route"),
      users: await import("./users/route"),
      metrics: await import("./users/if-metrics/route"),
      permissions: await import("./permissions/route"),
      routes: await import("./routes/route"),
      routeDetail: await import("./routes/[id]/route"),
      routeImport: await import("./routes/bulk-import/route"),
      pilotAwards: await import("./pilot-awards/route"),
      pireps: await import("./pireps/route"),
      dashboard: await import("./dashboard/route"),
      filteredDashboard: await import("./dashboard/filter/route"),
      analytics: await import("./dashboard/analytics/route"),
    };
  }, 30_000);

  beforeEach(async () => {
    const tables = await database.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = :schema AND tablename <> 'options'", { replacements: { schema }, type: QueryTypes.SELECT });
    await database.query(`TRUNCATE TABLE ${tables.map(row => `"${schema}"."${row.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
    await models.Pilot.bulkCreate([1, 2, 9].map(id => ({ id, name: `Pilot ${id}`, callsign: `China Southern ${100 + id}VG`, ifc: `Pilot${id}`, email: `Pilot${id}@example.com`, password: "retained-test-hash", status: id === 2 ? 0 : 1, joined: new Date("2026-11-01T12:00:00Z") })));
    await models.Rank.create({ id: 1, name: "Initial", timereq: 0 });
    await models.Award.create({ id: 1, name: "Existing award", description: "Existing", imageurl: "/badges/existing.svg" });
    await models.Aircraft.bulkCreate([{ id: 1, name: "Airbus A350", liveryname: "China Southern", rankreq: 1, status: 1 }, { id: 2, name: "Boeing 777", liveryname: null, rankreq: 1, status: 0 }]);
    await models.Route.create({ id: 1, fltnum: "CZ101", dep: "CYYZ", arr: "KJFK", duration: 3600, notes: "Existing" });
    await models.RouteAircraft.create({ id: 1, routeid: 1, aircraftid: 1 });
    await models.Pirep.create({ id: 1, flightnum: "CZ101", departure: "CYYZ", arrival: "KJFK", flighttime: 4500, pilotid: 1, date: "2026-11-01", aircraftid: 1, fuelused: 123, multi: "None", status: 0 });
    await models.PirepComment.create({ id: 1, pirepid: 1, userid: 1, content: "Pilot note" });
    await models.Application.create({ id: 1, pilotid: 1, exam_status: 2, exam_score: 95.5 });
    await database.query(resetSequences);
  });

  afterAll(async () => {
    if (database) {
      try { if (mayCleanUp) await database.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await database.close(); }
    }
    vi.doUnmock("@/lib/database");
    vi.doUnmock("@/lib/server-auth");
    vi.doUnmock("next/server");
    vi.doUnmock("@/lib/awards/columns");
    vi.doUnmock("@/lib/awards/evaluator");
    vi.doUnmock("@/lib/infinite-flight-api");
  });

  it("creates, updates and deletes ranks/multipliers with returned identities and reference checks", async () => {
    const rankPayload = { name: "Captain", timereq: 7200, imageurl: null, barcount: 4, bartone: "gold", starcount: 2 };
    const created = await body(await api.ranks.POST(request("ranks", "POST", rankPayload)), 201);
    expect(created.rank.id).toBe(2);
    await body(await api.ranks.PUT(request("ranks", "PUT", { ...rankPayload, id: created.rank.id, timereq: 7300 })));
    const multiplierPayload = { code: 42, multiplier: 1.25, name: "Captain special", minrankid: created.rank.id };
    const multiplier = await body(await api.multipliers.POST(request("multipliers", "POST", multiplierPayload)), 201);
    expect(multiplier.multiplier.id).toBe(1);
    const listed = await body(await api.multipliers.GET(request("multipliers")));
    expect(listed.multipliers[0]).toMatchObject({ multiplier: 1.25, minRankName: "Captain", minrankid: created.rank.id });
    await body(await api.ranks.DELETE(request(`ranks?id=${created.rank.id}`, "DELETE")), 409);
    await body(await api.multipliers.PUT(request("multipliers", "PUT", { ...multiplierPayload, id: multiplier.multiplier.id, minrankid: null, multiplier: 2.5 })));
    await body(await api.multipliers.DELETE(request(`multipliers?id=${multiplier.multiplier.id}`, "DELETE")));
    await body(await api.ranks.DELETE(request(`ranks?id=${created.rank.id}`, "DELETE")));
    expect((await body(await api.ranks.GET(request("ranks")))).ranks).toHaveLength(1);
  });

  it("round-trips award JSON, nullable featured uniqueness and dependency-aware deletion", async () => {
    const payload = { name: "Staff award", name_zh: "荣誉", description: "Pilot's award", imageurl: "/badges/staff.svg", criteria: { type: "manual", nested: [1, true] }, featured: true, category: "honor" };
    const first = await body(await api.awards.POST(request("awards", "POST", payload)), 201);
    const second = await body(await api.awards.POST(request("awards", "POST", { ...payload, name: "Second award" })), 201);
    expect((await models.Award.findByPk(first.award.id))?.featured).toBeNull();
    expect(second.award).toMatchObject({ featured: 1, criteria: payload.criteria });
    await body(await api.awards.PUT(request("awards", "PUT", { ...payload, id: first.award.id, criteria: '{"type":"manual","count":3}', featured: false })));
    const listed = await body(await api.awards.GET(request("awards")));
    expect(listed.awards.find((item: { id: number }) => item.id === first.award.id).criteria).toEqual({ type: "manual", count: 3 });
    await models.AwardGranted.create({ awardid: first.award.id, pilotid: 1, dateawarded: "2026-11-01" });
    await body(await api.awards.DELETE(request(`awards?id=${first.award.id}`, "DELETE")), 409);
    await body(await api.awards.DELETE(request(`awards?id=${second.award.id}`, "DELETE")));
  });

  it("handles route CRUD joins, exact case-insensitive airport filters and native aircraft arrays", async () => {
    const payload = { fltnum: "CZ202", dep: "cyvr", arr: "cyyz", duration: "02:30", aircraft: [1], notes: "New route" };
    const created = await body(await api.routes.POST(request("routes", "POST", payload)));
    expect(created.data).toMatchObject({ id: 2, dep: "CYVR", arr: "CYYZ", duration: 9000 });
    const listed = await body(await api.routes.GET(request("routes?dep=cyvr&arr=cyyz&fltnum=cz&aircraftId=1&minDuration=5000&maxDuration=10000")));
    expect(listed.data.routes).toHaveLength(1);
    expect(listed.data.routes[0].aircraft[0].id).toBe(1);
    await body(await api.routes.PUT(request("routes", "PUT", { ...payload, id: created.data.id, aircraft: [2], duration: "03:00" })));
    const details = await body(await api.routeDetail.GET(request(`routes/${created.data.id}`), { params: Promise.resolve({ id: String(created.data.id) }) }));
    expect(details.data).toMatchObject({ rawDuration: 10800, aircraft: [{ id: 2, name: "Boeing 777" }] });
    await body(await api.routes.PUT(request("routes", "PUT", { ...payload, id: created.data.id, aircraft: [] })));
    expect((await body(await api.routeDetail.GET(request(`routes/${created.data.id}`), { params: Promise.resolve({ id: String(created.data.id) }) })) ).data.aircraft).toEqual([]);
    await body(await api.routes.DELETE(request(`routes?id=${created.data.id}`, "DELETE")));
    expect(await models.RouteAircraft.count({ where: { routeid: created.data.id } })).toBe(0);
  });

  it("appends and overwrites route imports in transactions using generated route IDs", async () => {
    const route = { fltnum: "IM201", dep: "CYYZ", arr: "CYVR", duration: "04:30", aircraftNames: ["Airbus"], notes: "Imported" };
    const imported = await body(await api.routeImport.POST(request("routes/bulk-import", "POST", { mode: "import", importType: "append", routes: [route], mappings: { Airbus: 1 } })));
    expect(imported).toMatchObject({ createdCount: 1, clearedCount: 0 });
    const createdId = imported.createdRoutes[0].id;
    expect(await models.RouteAircraft.count({ where: { routeid: createdId, aircraftid: 1 } })).toBe(1);
    const overwritten = await body(await api.routeImport.POST(request("routes/bulk-import", "POST", { mode: "import", importType: "overwrite", routes: [{ ...route, fltnum: "IM202" }], mappings: { Airbus: 2 } })));
    expect(overwritten).toMatchObject({ createdCount: 1, clearedCount: 2 });
    expect(await models.Route.count()).toBe(1);
    expect(await models.RouteAircraft.count({ where: { aircraftid: 2 } })).toBe(1);
  });

  it("updates applicant data and refreshes mocked IF metrics through real findOrCreate queries", async () => {
    await body(await api.users.PUT(request("users", "PUT", { id: 2, name: "Accepted Pilot", email: "Mixed@Example.com", callsign: "China Southern 202VG", status: 3, transhours: 3600, transflights: 2, application: { examScore: 87.25, discordInviteUrl: "https://discord.example.test/invite" } })));
    const application = await models.Application.findOne({ where: { pilotid: 2 } });
    expect(Number(application?.exam_score)).toBe(87.25);
    expect(application?.exam_status).toBe(2);
    await body(await api.metrics.POST(request("users/if-metrics", "POST", { id: 2 })));
    await application?.reload();
    expect(application?.toJSON()).toMatchObject({ if_grade: 4, if_violations: 3 });
    const users = await body(await api.users.GET(request("users")));
    expect(users.find((user: { id: number }) => user.id === 2)).toMatchObject({ email: "mixed@example.com", status: 3, examScore: 87.25, ifGrade: 4 });
    expect((await body(await api.metrics.POST(request("users/if-metrics", "POST", { id: 9 })))).ifGrade).toBe(4);
  });

  it("retains case-insensitive callsign collision checks for historical pilot records", async () => {
    await models.Pilot.update({ callsign: "china southern 222vg" }, { where: { id: 1 } });
    await body(await api.users.PUT(request("users", "PUT", { id: 2, callsign: "China Southern 222VG" })), 409);
    expect((await models.Pilot.findByPk(2))?.callsign).toBe("China Southern 102VG");
  });

  it("replaces, aggregates and deletes permissions using numeric pilot IDs", async () => {
    await body(await api.permissions.POST(request("permissions", "POST", { email: "pILOT1@EXAMPLE.COM", role: "route_manager" })));
    const permissions = await body(await api.permissions.GET(request("permissions")));
    expect(permissions.admins[0]).toMatchObject({ id: 1, permissions: ["home", "routes"] });
    await body(await api.permissions.PUT(request("permissions", "PUT", { id: 1, permissions: ["scheduling", "awards", "awards"] })));
    expect(await models.Permission.count({ where: { userid: 1 } })).toBe(2);
    await body(await api.permissions.DELETE(request("permissions?id=1", "DELETE")));
    expect(await models.Permission.count()).toBe(0);
  });

  it("grants, replaces and revokes pilot awards with DATE calendar values and empty lists", async () => {
    const granted = await body(await api.pilotAwards.POST(request("pilot-awards", "POST", { pilotIds: [1, 2], awardIds: [1] })));
    expect(granted.createdCount).toBe(2);
    expect((await body(await api.pilotAwards.POST(request("pilot-awards", "POST", { pilotIds: [1], awardIds: [1] })))).createdCount).toBe(0);
    const recipients = await body(await api.pilotAwards.GET(request("pilot-awards?awardId=1")));
    expect(recipients.recipients).toHaveLength(2);
    expect(recipients.recipients[0].dateAwarded).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((await body(await api.pilotAwards.GET(request("pilot-awards?query=pilot1")))).pilots).toHaveLength(1);
    await body(await api.pilotAwards.PUT(request("pilot-awards", "PUT", { pilotId: 1, awardIds: [] })));
    expect((await body(await api.pilotAwards.DELETE(request("pilot-awards?pilotId=2&awardId=1", "DELETE")))).deletedCount).toBe(1);
    expect(await models.AwardGranted.count()).toBe(0);
  });

  it("filters PIREPs through belongsTo joins and edits comments atomically", async () => {
    const listed = await body(await api.pireps.GET(request("pireps?search=PILOT%201&status=0&limit=1")));
    expect(listed.data.pireps).toHaveLength(1);
    const updated = await body(await api.pireps.PUT(request("pireps", "PUT", { id: 1, status: 1, flighttime: "02:15", fuelused: 456.5, aircraftid: 2, departure: "cyvr", arrival: "cyyz", multi: "Special", comment: "Admin's review", deleteCommentIds: [1] })));
    expect(updated.success).toBe(true);
    expect((await models.Pirep.findByPk(1))?.toJSON()).toMatchObject({ status: 1, flighttime: 8100, fuelused: 457, aircraftid: 2, departure: "CYVR" });
    const comments = await models.PirepComment.findAll({ where: { pirepid: 1 } });
    expect(comments.map(comment => comment.content)).toEqual(["Admin's review"]);
  });

  it("runs dashboard aggregates and all permission-dependent analytics sections", async () => {
    await models.Pirep.update({ status: 1 }, { where: { id: 1 } });
    await models.Permission.create({ userid: 9, name: "admin" });
    const main = await body(await api.dashboard.GET(request("dashboard")));
    expect(main.success).toBe(true);
    const filtered = await body(await api.filteredDashboard.GET(request("dashboard/filter?startDate=2026-11-01&endDate=2026-11-02")));
    expect(filtered.data).toMatchObject({ pirepsInRange: 1, flightHours: "01:15" });
    const analytics = await body(await api.analytics.GET(request("dashboard/analytics?startDate=2026-11-01&endDate=2026-11-02")));
    expect(analytics.success).toBe(true);
    expect(analytics.sections.overview.range).toMatchObject({ approvedPireps: 1, flightHours: 1.25 });
    expect(analytics.sections.pireps.trends[0]).toMatchObject({ flights: 1, hours: 1.25 });
    expect(Object.keys(analytics.sections)).toEqual(expect.arrayContaining(["users", "routes", "aircrafts", "permissions"]));
  });
});
