import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const destroy = vi.fn().mockResolvedValue(1);
  const bulkCreate = vi.fn().mockResolvedValue([]);
  const create = vi.fn();
  const count = vi.fn();
  const findAll = vi.fn();
  const transaction = vi.fn(async (cb: (t: any) => Promise<any>) => cb({}));

  return {
    authorize: vi.fn(),
    Route: {
      create,
      count,
      destroy,
    },
    RouteAircraft: {
      bulkCreate,
      destroy,
    },
    Aircraft: {
      findAll,
    },
    transaction,
  };
});

vi.mock("@/lib/server-auth", () => ({
  requirePermission: mocks.authorize,
}));

vi.mock("@/lib/database", () => ({
  default: {
    transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/models", () => ({
  models: {
    Route: mocks.Route,
    RouteAircraft: mocks.RouteAircraft,
    Aircraft: mocks.Aircraft,
  },
}));

import { POST } from "./route";
import {
  convertDurationToSeconds,
  parseCSV,
  validateRouteRow,
} from "@/lib/routes/bulk-import-utils";

describe("Route Bulk Import API & Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockResolvedValue({ ok: true, user: { id: 1 } });
    mocks.Aircraft.findAll.mockResolvedValue([
      { id: 10, name: "Boeing 787-9", liveryname: "China Southern" },
      { id: 20, name: "Airbus A350-900", liveryname: "Generic" },
    ]);
    mocks.Route.count.mockResolvedValue(42);
    mocks.Route.create.mockImplementation(async (data: any) => ({
      id: Math.floor(Math.random() * 1000) + 1,
      ...data,
    }));
  });

  describe("convertDurationToSeconds", () => {
    it("converts HH:MM and H:MM correctly", () => {
      expect(convertDurationToSeconds("5:30")).toBe(19800);
      expect(convertDurationToSeconds("01:15")).toBe(4500);
      expect(convertDurationToSeconds("0:45")).toBe(2700);
    });

    it("handles numeric input", () => {
      expect(convertDurationToSeconds(3600)).toBe(3600);
    });

    it("returns NaN for invalid durations", () => {
      expect(convertDurationToSeconds("invalid")).toBeNaN();
      expect(convertDurationToSeconds("5:60")).toBeNaN();
      expect(convertDurationToSeconds("-1:20")).toBeNaN();
    });
  });

  describe("parseCSV", () => {
    it("handles UTF-8 BOM and quoted strings properly", () => {
      const csvWithBom =
        "\uFEFFfltnum,dep,arr,duration,notes,aircraft\n" +
        'CZ3001,ZGGG,ZBAA,3:15,"Guangzhou to Beijing",B787\n';

      const { rows, malformedRows } = parseCSV(csvWithBom);
      expect(malformedRows).toHaveLength(0);
      expect(rows).toHaveLength(1);
      expect(rows[0].fltnum).toBe("CZ3001");
      expect(rows[0].notes).toBe("Guangzhou to Beijing");
    });

    it("flags row column count mismatches without failing the entire file", () => {
      const csv =
        "fltnum,dep,arr,duration,notes,aircraft\n" +
        "CZ1,ZGGG,ZBAA,3:15,Notes,B787\n" +
        "CZ2,ZGGG,ZBAA\n" + // Column count mismatch
        "CZ3,ZGGG,ZBAA,3:15,Notes,A350\n";

      const { rows, malformedRows } = parseCSV(csv);
      expect(rows).toHaveLength(2);
      expect(malformedRows).toHaveLength(1);
      expect(malformedRows[0].rowNumber).toBe(3);
    });
  });

  describe("validateRouteRow", () => {
    it("validates a correct row", () => {
      const result = validateRouteRow(
        {
          fltnum: "CZ3001",
          dep: "zggg",
          arr: "zbaa",
          duration: "3:10",
          notes: "Daily flight",
          aircraft: "Boeing 787; Airbus A350",
        },
        2,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.route.fltnum).toBe("CZ3001");
        expect(result.route.dep).toBe("ZGGG");
        expect(result.route.arr).toBe("ZBAA");
        expect(result.route.aircraftNames).toEqual([
          "Boeing 787",
          "Airbus A350",
        ]);
      }
    });

    it("catches errors in invalid fields", () => {
      const result = validateRouteRow(
        {
          fltnum: "",
          dep: "CAN", // Non 4-letter ICAO
          arr: "PEK", // Non 4-letter ICAO
          duration: "bad-time",
        },
        5,
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.errors).toContain(
          "flight number (fltnum) is required",
        );
        expect(result.error.errors).toContain(
          "departure must be a 4-letter ICAO code",
        );
        expect(result.error.errors).toContain(
          "arrival must be a 4-letter ICAO code",
        );
        expect(result.error.errors).toContain(
          "duration must be in HH:MM format",
        );
      }
    });
  });

  describe("POST handler", () => {
    it("enforces permission check", async () => {
      mocks.authorize.mockResolvedValue({
        ok: false,
        response: new Response("Forbidden", { status: 403 }),
      });

      const res = await POST(
        new Request("http://localhost/api/admin/routes/bulk-import", {
          method: "POST",
          body: JSON.stringify({ mode: "preview" }),
        }),
      );

      expect(res.status).toBe(403);
    });

    it("previews CSV with tolerance for invalid rows and returns totalExistingRoutes", async () => {
      const csv =
        "fltnum,dep,arr,duration,notes,aircraft\n" +
        "CZ3001,ZGGG,ZBAA,3:15,Normal,B787\n" +
        "CZ3002,CAN,ZBAA,3:15,Bad Dep,A350\n"; // Bad row

      const req = new Request("http://localhost/api/admin/routes/bulk-import", {
        method: "POST",
        body: JSON.stringify({ mode: "preview", csvContent: csv }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.validCount).toBe(1);
      expect(data.invalidCount).toBe(1);
      expect(data.preview).toHaveLength(1);
      expect(data.preview[0].fltnum).toBe("CZ3001");
      expect(data.invalidRoutes).toHaveLength(1);
      expect(data.totalExistingRoutes).toBe(42);
      expect(data.aircraftNames).toEqual(["B787"]);
    });

    it("imports in append mode without deleting existing routes", async () => {
      const req = new Request("http://localhost/api/admin/routes/bulk-import", {
        method: "POST",
        body: JSON.stringify({
          mode: "import",
          importType: "append",
          routes: [
            {
              fltnum: "CZ101",
              dep: "ZGGG",
              arr: "ZBAA",
              duration: "3:00",
              aircraftNames: ["B787"],
            },
          ],
          mappings: { B787: 10 },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.createdCount).toBe(1);
      expect(data.clearedCount).toBe(0);
      expect(mocks.Route.destroy).not.toHaveBeenCalled();
      expect(mocks.RouteAircraft.destroy).not.toHaveBeenCalled();
      expect(mocks.Route.create).toHaveBeenCalledTimes(1);
      expect(mocks.RouteAircraft.bulkCreate).toHaveBeenCalledWith(
        expect.arrayContaining([{ routeid: expect.any(Number), aircraftid: 10 }]),
        expect.any(Object),
      );
    });

    it("imports in overwrite mode by purging existing routes first", async () => {
      mocks.Route.count.mockResolvedValueOnce(50);

      const req = new Request("http://localhost/api/admin/routes/bulk-import", {
        method: "POST",
        body: JSON.stringify({
          mode: "import",
          importType: "overwrite",
          routes: [
            {
              fltnum: "CZ201",
              dep: "ZGGG",
              arr: "VHHH",
              duration: "1:00",
              aircraftNames: ["A350"],
            },
          ],
          mappings: { A350: 20 },
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.createdCount).toBe(1);
      expect(data.clearedCount).toBe(50);
      expect(data.importType).toBe("overwrite");
      expect(mocks.RouteAircraft.destroy).toHaveBeenCalled();
      expect(mocks.Route.destroy).toHaveBeenCalled();
      expect(mocks.Route.create).toHaveBeenCalledTimes(1);
    });
  });
});
