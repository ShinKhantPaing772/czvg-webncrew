/**
 * Local UI preview fixtures — enabled with CREW_PREVIEW=1.
 * No database required; middleware serves these for /api/* requests.
 */

export const PREVIEW_TOKEN = "preview-token";

export const previewPilot = {
  id: 1001,
  name: "Chen Rui",
  email: "preview@ifczvg.local",
  callsign: "CSN1001VG",
  ifc: "CZVG_Preview",
  transhours: 0,
  transflights: 0,
  joined: "2024-03-18",
  status: 1,
  canAccessLiveScheduling: true,
  Permissions: [
    { userid: "1001", name: "admin" },
    { userid: "1001", name: "pireps" },
    { userid: "1001", name: "routes" },
    { userid: "1001", name: "aircrafts" },
    { userid: "1001", name: "users" },
    { userid: "1001", name: "awards" },
    { userid: "1001", name: "ranks" },
  ],
};

const aircraft = [
  {
    id: 1,
    name: "Boeing 777-300ER",
    ifaircraftid: "if-b77w",
    liveryname: "China Southern",
    ifliveryid: "liv-csn-77w",
    status: 1,
    notes: null,
    rankreq: 3,
    awardreq: null,
  },
  {
    id: 2,
    name: "Airbus A320neo",
    ifaircraftid: "if-a20n",
    liveryname: "China Southern",
    ifliveryid: "liv-csn-a20n",
    status: 1,
    notes: null,
    rankreq: 1,
    awardreq: null,
  },
  {
    id: 3,
    name: "Boeing 787-9",
    ifaircraftid: "if-b789",
    liveryname: "XiamenAir",
    ifliveryid: "liv-cxa-789",
    status: 1,
    notes: null,
    rankreq: 2,
    awardreq: null,
  },
  {
    id: 4,
    name: "Boeing 777F",
    ifaircraftid: "if-b77f",
    liveryname: "China Southern Cargo",
    ifliveryid: "liv-csn-77f",
    status: 1,
    notes: null,
    rankreq: 4,
    awardreq: 2,
  },
];

const routes = [
  {
    id: 101,
    fltnum: "CSN3101",
    dep: "ZGGG",
    arr: "ZBAD",
    durationSeconds: 8100,
    duration: "02:15",
    notes: "Guangzhou Baiyun to Beijing Daxing trunk express service.",
    aircraft: [aircraft[0], aircraft[1]],
  },
  {
    id: 102,
    fltnum: "CSN327",
    dep: "ZGGG",
    arr: "KLAX",
    durationSeconds: 46800,
    duration: "13:00",
    notes: "Flagship transpacific service from Guangzhou to Los Angeles.",
    aircraft: [aircraft[0]],
  },
  {
    id: 103,
    fltnum: "CSN383",
    dep: "ZGGG",
    arr: "EGLL",
    durationSeconds: 43200,
    duration: "12:00",
    notes: "Canton Route flagship service to London Heathrow Terminal 4.",
    aircraft: [aircraft[0], aircraft[2]],
  },
  {
    id: 104,
    fltnum: "5X104",
    dep: "RJBB",
    arr: "ZSPD",
    durationSeconds: 4500,
    duration: "01:15",
    notes: "Standard Line Operation",
    aircraft: [aircraft[1]],
  },
  {
    id: 105,
    fltnum: "CXA801",
    dep: "ZSAM",
    arr: "WSSS",
    durationSeconds: 14400,
    duration: "04:00",
    notes: "Xiamen Airlines Southeast Asia trunk route to Singapore Changi.",
    aircraft: [aircraft[2]],
  },
  {
    id: 106,
    fltnum: "CSN3009",
    dep: "ZGGG",
    arr: "ZSPD",
    durationSeconds: 7200,
    duration: "02:00",
    notes: "High-frequency Pearl River Delta to Shanghai Pudong shuttle.",
    aircraft: [],
  },
  {
    id: 107,
    fltnum: "CSN3001",
    dep: "ZBAD",
    arr: "RJTT",
    durationSeconds: 12600,
    duration: "03:30",
    notes: "Beijing Daxing international hub service to Tokyo Haneda.",
    aircraft: [aircraft[0], aircraft[2]],
  },
  {
    id: 108,
    fltnum: "CSN841",
    dep: "ZGGG",
    arr: "KJFK",
    durationSeconds: 57600,
    duration: "16:00",
    notes: "Ultra-long-haul non-stop service from Guangzhou to New York JFK.",
    aircraft: [aircraft[0]],
  },
];

const pireps = [
  {
    id: 9001,
    flightnum: "CSN327",
    departure: "ZGGG",
    arrival: "KLAX",
    flighttime: "13:05",
    date: "2026-10-18",
    aircraftid: 1,
    fuelused: 89200,
    multi: "None",
    status: 1,
    Aircraft: {
      id: 1,
      name: "Boeing 777-300ER",
      liveryname: "China Southern",
    },
    Comments: [
      {
        id: 1,
        userid: 1,
        content:
          "Verified against Expert Server telemetry. Great flight!",
        dateposted: "2026-10-18T16:20:00Z",
        User: { id: 1, callsign: "CSN0001VG", name: "Staff Ops" },
      },
    ],
  },
  {
    id: 9002,
    flightnum: "CSN3101",
    departure: "ZGGG",
    arrival: "ZBAD",
    flighttime: "02:18",
    date: "2026-10-20",
    aircraftid: 2,
    fuelused: 6400,
    multi: "1.3",
    status: 1,
    Aircraft: {
      id: 2,
      name: "Airbus A320neo",
      liveryname: "China Southern",
    },
    Comments: [],
  },
  {
    id: 9003,
    flightnum: "5X104",
    departure: "RJBB",
    arrival: "ZSPD",
    flighttime: "01:12",
    date: "2026-10-21",
    aircraftid: 2,
    fuelused: 4100,
    multi: "None",
    status: 0,
    Aircraft: {
      id: 2,
      name: "Airbus A320neo",
      liveryname: "China Southern",
    },
    Comments: [],
  },
  {
    id: 9004,
    flightnum: "CXA801",
    departure: "ZSAM",
    arrival: "WSSS",
    flighttime: "03:55",
    date: "2026-10-15",
    aircraftid: 3,
    fuelused: 22100,
    multi: "2.0",
    status: 2,
    Aircraft: {
      id: 3,
      name: "Boeing 787-9",
      liveryname: "XiamenAir",
    },
    Comments: [
      {
        id: 2,
        userid: 1,
        content:
          "2.0x event multiplier code was used outside event window; please re-file with 1.0x or 1.3x.",
        dateposted: "2026-10-16T09:00:00Z",
        User: { id: 1, callsign: "CSN0001VG", name: "Staff Ops" },
      },
    ],
  },
  {
    id: 9005,
    flightnum: "CSN3001",
    departure: "ZBAD",
    arrival: "RJTT",
    flighttime: "03:28",
    date: "2026-10-22",
    aircraftid: 1,
    fuelused: 18500,
    multi: "None",
    status: 1,
    Aircraft: {
      id: 1,
      name: "Boeing 777-300ER",
      liveryname: "China Southern",
    },
    Comments: [],
  },
];

const awards = [
  {
    id: 1,
    name: "Live Operations Certified Pilot",
    description:
      "Authorized for CZVG Live Aircraft Scheduling and real-time Infinite Flight dispatch queues.",
    imageurl: null,
    dateAwarded: "2025-06-01",
  },
  {
    id: 2,
    name: "CEO's Commendation Award (1.3x)",
    description:
      "Awarded by the CEO for outstanding dedication, operational excellence, and community leadership.",
    imageurl: null,
    dateAwarded: "2025-11-12",
  },
  {
    id: 3,
    name: "Canton Route Master",
    description:
      "Completed 50+ intercontinental wide-body sectors out of Guangzhou Baiyun International Hub (ZGGG).",
    imageurl: null,
    dateAwarded: "2026-02-20",
  },
];

const dashboard = {
  pilot: {
    id: previewPilot.id,
    name: previewPilot.name,
    email: previewPilot.email,
    callsign: previewPilot.callsign,
    joined: previewPilot.joined,
    status: previewPilot.status,
  },
  standing: { status: 1, label: "Active" },
  rank: {
    current: {
      id: 3,
      name: "Senior First Officer",
      timeReq: 180000,
      timeReqFormatted: "50:00",
    },
    next: {
      id: 4,
      name: "Captain",
      timeReq: 360000,
      timeReqFormatted: "100:00",
      remainingSeconds: 122400,
      remainingFormatted: "34:00",
    },
    progressToNextRank: 65.2,
    eligibleRankIds: [1, 2, 3],
  },
  awards: {
    ownedAwardIds: awards.map((a) => a.id),
    received: awards,
  },
  statistics: {
    approvedFlightSeconds: 237600,
    totalFlightTime: "66:00",
    approvedPireps: 42,
    pendingPireps: 1,
    rejectedPireps: 2,
    recentRejectedPireps: 1,
    recentPirepWarningLimit: 10,
  },
  recentPireps: pireps.slice(0, 10).map((p) => ({
    id: p.id,
    flightnum: p.flightnum,
    date: p.date,
    departure: p.departure,
    arrival: p.arrival,
    flighttime: p.flighttime,
    flightTimeInput: p.flighttime,
    status: p.status,
    aircraft: p.Aircraft
      ? {
          id: p.Aircraft.id,
          name: p.Aircraft.name,
          liveryname: p.Aircraft.liveryname,
        }
      : null,
  })),
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "x-crew-preview": "1",
      "cache-control": "no-store",
    },
  });
}

function match(
  pathname: string,
  pattern: string,
): Record<string, string> | null {
  const pathParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const expected = patternParts[i];
    const actual = pathParts[i];
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = actual;
      continue;
    }
    if (expected !== actual) return null;
  }
  return params;
}

export function isCrewPreviewEnabled() {
  return (
    process.env.CREW_PREVIEW === "1" ||
    process.env.NEXT_PUBLIC_CREW_PREVIEW === "1"
  );
}

export function handleCrewPreviewApi(request: Request): Response | null {
  if (!isCrewPreviewEnabled()) return null;

  const url = new URL(request.url);
  const { pathname, searchParams } = url;
  const method = request.method.toUpperCase();

  if (pathname === "/api/auth/verify" && method === "POST") {
    return json(previewPilot);
  }

  if (pathname === "/api/auth/logout" && method === "POST") {
    return json({ success: true });
  }

  if (pathname === "/api/auth" && method === "POST") {
    return json({
      token: PREVIEW_TOKEN,
      user: previewPilot,
      message: "Preview login",
    });
  }

  if (pathname === "/api/aircraft" && method === "GET") {
    return json({ aircrafts: aircraft });
  }

  if (pathname === "/api/routes" && method === "GET") {
    let filtered = [...routes];
    const fltnum = searchParams.get("fltnum")?.trim().toLowerCase();
    const dep = searchParams.get("dep")?.trim().toUpperCase();
    const arr = searchParams.get("arr")?.trim().toUpperCase();
    const aircraftId = searchParams.get("aircraftId");
    const minDuration = Number(searchParams.get("minDuration"));
    const maxDuration = Number(searchParams.get("maxDuration"));
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const limit = Math.min(
      500,
      Math.max(1, Number(searchParams.get("limit") ?? "100") || 100),
    );

    if (fltnum) {
      filtered = filtered.filter((route) =>
        route.fltnum.toLowerCase().includes(fltnum),
      );
    }
    if (dep) filtered = filtered.filter((route) => route.dep === dep);
    if (arr) filtered = filtered.filter((route) => route.arr === arr);
    if (aircraftId) {
      filtered = filtered.filter((route) =>
        route.aircraft.some((item) => String(item.id) === aircraftId),
      );
    }
    if (Number.isFinite(minDuration)) {
      filtered = filtered.filter(
        (route) => route.durationSeconds >= minDuration,
      );
    }
    if (Number.isFinite(maxDuration) && maxDuration > 0) {
      filtered = filtered.filter(
        (route) => route.durationSeconds <= maxDuration,
      );
    }

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const data = filtered.slice(offset, offset + limit).map((route) => ({
      ...route,
      aircraft: route.aircraft.map((item) => ({
        id: item.id,
        name: item.name,
        liveryname: item.liveryname,
        notes: item.notes,
        rankreq: item.rankreq,
        awardreq: item.awardreq,
        status: item.status,
      })),
    }));

    return json({
      success: true,
      data,
      pagination: {
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        currentPage: page,
        limit,
      },
    });
  }

  const routeDetail = match(pathname, "/api/routes/:id");
  if (routeDetail && method === "GET") {
    const route = routes.find((item) => String(item.id) === routeDetail.id);
    if (!route) {
      return json({ success: false, message: "Route not found" }, 404);
    }
    return json({
      success: true,
      data: {
        ...route,
        aircraft: route.aircraft.map((item) => ({
          id: item.id,
          name: item.name,
          ifaircraftid: item.ifaircraftid,
          liveryname: item.liveryname,
          ifliveryid: item.ifliveryid,
          notes: item.notes,
          rankreq: item.rankreq,
          awardreq: item.awardreq,
          status: item.status,
        })),
        recentFlights: pireps
          .filter(
            (pirep) =>
              pirep.departure === route.dep && pirep.arrival === route.arr,
          )
          .map((pirep) => ({
            id: pirep.id,
            date: pirep.date,
            pilot: previewPilot.name,
            pilotCallsign: previewPilot.callsign,
            aircraft: pirep.Aircraft.name,
            aircraftCode: null,
            flightTime: pirep.flighttime,
            status: pirep.status,
          })),
      },
    });
  }

  const pilotDashboard = match(pathname, "/api/pilots/:id/dashboard");
  if (pilotDashboard && method === "GET") {
    return json(dashboard);
  }

  const pilotPireps = match(pathname, "/api/pilots/:id/pireps");
  if (pilotPireps && method === "GET") {
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number(searchParams.get("limit") ?? "10") || 10),
    );
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
    let filtered = [...pireps];
    if (search) {
      filtered = filtered.filter((pirep) =>
        [
          pirep.flightnum,
          pirep.departure,
          pirep.arrival,
          pirep.multi,
          pirep.Aircraft.name,
          pirep.Aircraft.liveryname,
        ].some((value) => value.toLowerCase().includes(search)),
      );
    }
    const total = filtered.length;
    const offset = (page - 1) * limit;
    return json({
      pireps: filtered.slice(offset, offset + limit),
      pagination: {
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        currentPage: page,
        limit,
      },
      statistics: {
        totalFlightTime: dashboard.statistics.totalFlightTime,
        totalPireps: dashboard.statistics.approvedPireps,
        rank: dashboard.rank.current.name,
        rankId: dashboard.rank.current.id,
        nextRank: dashboard.rank.next?.name ?? null,
        nextRankTimeReq: dashboard.rank.next?.timeReqFormatted ?? null,
        progressToNextRank: String(dashboard.rank.progressToNextRank),
      },
    });
  }

  if (pilotPireps && method === "POST") {
    return json({ success: true, message: "Comment added (preview)" });
  }

  if (pathname === "/api/pireps" && method === "POST") {
    return json({
      success: true,
      message: "PIREP filed (preview — not persisted)",
      id: 9999,
    });
  }

  if (pathname === "/api/acars/current-flight" && method === "GET") {
    return json({
      success: false,
      message: "No active ACARS flight in preview mode",
    });
  }

  if (pathname === "/api/applicant/status" && method === "GET") {
    return json({
      status: 1,
      label: "Active",
      application: null,
    });
  }

  if (pathname.startsWith("/api/scheduling") && method === "GET") {
    return json({
      pilotId: previewPilot.id,
      aircraft: [
        {
          id: 1,
          registration: "B-30AL",
          type_name: "Boeing 777-300ER",
          livery_name: "China Southern",
          active: true,
          confirmed_airport: "ZGGG",
        },
        {
          id: 2,
          registration: "B-308D",
          type_name: "Airbus A320neo",
          livery_name: "China Southern",
          active: true,
          confirmed_airport: "ZBAD",
        },
      ],
      flights: [
        {
          id: 501,
          callsign: "CSN3101VG",
          departure: "ZGGG",
          arrival: "ZBAD",
          status: "approved",
          captain_id: previewPilot.id,
          live_aircraft_id: 1,
          scheduled_departure: null,
          scheduled_arrival: null,
          members: [
            {
              id: 1,
              pilot_id: previewPilot.id,
              role: "captain",
              status: "approved",
            },
          ],
        },
      ],
      pilots: [
        {
          id: previewPilot.id,
          name: previewPilot.name,
          callsign: previewPilot.callsign,
        },
      ],
      catalog: [],
      configuration: {
        liveAwardConfigured: true,
        allowUnpublishedIfStarts: true,
      },
    });
  }

  if (pathname.startsWith("/api/admin/scheduling") && method === "GET") {
    return json({
      pilotId: previewPilot.id,
      aircraft: [],
      flights: [],
      pilots: [],
      catalog: [],
      configuration: {
        liveAwardConfigured: true,
        allowUnpublishedIfStarts: true,
      },
    });
  }

  if (pathname === "/api/admin/pireps" && method === "GET") {
    return json({
      pireps: pireps.map((pirep) => ({
        ...pirep,
        pilot: {
          id: previewPilot.id,
          name: previewPilot.name,
          callsign: previewPilot.callsign,
        },
      })),
      pagination: {
        total: pireps.length,
        totalPages: 1,
        currentPage: 1,
        limit: 50,
      },
    });
  }

  if (pathname === "/api/admin/routes" && method === "GET") {
    return json({
      routes: routes.map((route) => ({
        id: route.id,
        fltnum: route.fltnum,
        dep: route.dep,
        arr: route.arr,
        duration: route.durationSeconds,
        notes: route.notes,
        aircraftCount: route.aircraft.length,
      })),
      pagination: {
        total: routes.length,
        totalPages: 1,
        currentPage: 1,
        limit: 50,
      },
    });
  }

  if (pathname === "/api/admin/ranks" && method === "GET") {
    return json({
      ranks: [
        {
          id: 1,
          name: "Trainee",
          timereq: 0,
          barcount: 0,
          bartone: "gold",
          starcount: 0,
        },
        {
          id: 2,
          name: "First Officer",
          timereq: 72000,
          barcount: 1,
          bartone: "gold",
          starcount: 0,
        },
        {
          id: 3,
          name: "Senior First Officer",
          timereq: 180000,
          barcount: 2,
          bartone: "gold",
          starcount: 0,
        },
        {
          id: 4,
          name: "Captain",
          timereq: 360000,
          barcount: 3,
          bartone: "gold",
          starcount: 1,
        },
      ],
    });
  }

  if (pathname === "/api/admin/multipliers" && method === "GET") {
    return json({
      multipliers: [
        {
          id: 1,
          name: "CEO's Award Multiplier",
          code: 130,
          multiplier: 1.3,
          minrankid: null,
          minRankName: null,
        },
        {
          id: 2,
          name: "Official Group Flight Event",
          code: 150,
          multiplier: 1.5,
          minrankid: 2,
          minRankName: "First Officer",
        },
        {
          id: 3,
          name: "Golden Week Double Hours",
          code: 200,
          multiplier: 2,
          minrankid: 1,
          minRankName: "Trainee",
        },
      ],
    });
  }

  if (pathname === "/api/admin/awards" && method === "GET") {
    return json({ awards });
  }

  if (pathname === "/api/admin/users" && method === "GET") {
    return json({
      users: [
        {
          id: previewPilot.id,
          name: previewPilot.name,
          callsign: previewPilot.callsign,
          email: previewPilot.email,
          status: 1,
          joined: previewPilot.joined,
        },
      ],
    });
  }

  if (pathname.startsWith("/api/admin/dashboard")) {
    return json({
      totals: {
        pilots: 128,
        pireps: 2048,
        routes: routes.length,
        aircraft: aircraft.length,
      },
      recent: pireps,
    });
  }

  // Safe default for unmapped preview APIs so pages do not hit MySQL.
  if (pathname.startsWith("/api/")) {
    if (method === "GET") {
      return json({ success: true, preview: true, data: [] });
    }
    return json({
      success: true,
      preview: true,
      message: "Preview mode — write ignored",
    });
  }

  return null;
}
