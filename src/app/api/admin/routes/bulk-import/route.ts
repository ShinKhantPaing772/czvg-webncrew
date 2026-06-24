import { NextResponse } from "next/server";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { requirePermission } from "@/lib/server-auth";
// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ParsedCsvRow = Record<string, string>;

type ValidatedRouteRow = {
  fltnum: string;
  dep: string;
  arr: string;
  duration: string;
  notes: string;
  aircraftNames: string[];
};

type RouteToImport = ValidatedRouteRow & {
  durationInSeconds: number;
  aircraftIds: number[];
};

type CreatedRouteSummary = {
  id: number;
  fltnum: string;
  dep: string;
  arr: string;
};

// Helper function to convert duration format
function convertDurationToSeconds(duration: string | number): number {
  if (typeof duration === "number") return duration;
  if (typeof duration === "string" && duration.includes(":")) {
    const [hours, minutes] = duration.split(":").map(Number);
    if (
      Number.isInteger(hours) &&
      Number.isInteger(minutes) &&
      hours >= 0 &&
      minutes >= 0 &&
      minutes < 60
    ) {
      return hours * 60 * 60 + minutes * 60;
    }
  }

  const seconds = Number(duration);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : NaN;
}

// Helper function to parse CSV
async function parseCSV(text: string): Promise<ParsedCsvRow[]> {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentField += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i += 1;
      currentRow.push(currentField.trim());
      if (currentRow.some((value) => value)) rows.push(currentRow);
      currentRow = [];
      currentField = "";
      continue;
    }

    currentField += char;
  }

  currentRow.push(currentField.trim());
  if (currentRow.some((value) => value)) rows.push(currentRow);

  if (inQuotes) {
    throw new Error("CSV contains an unterminated quoted field");
  }

  if (rows.length < 2) {
    throw new Error("CSV must have at least a header row and one data row");
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const parsedRows: ParsedCsvRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const values = rows[i];
    if (values.length !== headers.length) {
      throw new Error(
        `Row ${i + 1} has ${values.length} columns but expected ${headers.length}`,
      );
    }

    const row: ParsedCsvRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    parsedRows.push(row);
  }

  return parsedRows;
}

// Validate route row and extract aircraft names
function validateRouteRow(
  row: ParsedCsvRow,
  rowNumber: number,
): ValidatedRouteRow {
  const errors: string[] = [];

  const fltnum = row.fltnum || row["flight number"];
  if (!fltnum || !fltnum.toString().trim()) {
    errors.push("flight number (fltnum) is required");
  }

  const dep = (row.dep || row.departure)?.toString().trim().toUpperCase();
  if (!dep || !dep.toString().trim()) {
    errors.push("departure airport (dep) is required");
  } else if (dep.length !== 4 || !/^[A-Z]{4}$/.test(dep)) {
    errors.push("departure must be a 4-letter ICAO code");
  }

  const arr = (row.arr || row.arrival)?.toString().trim().toUpperCase();
  if (!arr || !arr.toString().trim()) {
    errors.push("arrival airport (arr) is required");
  } else if (arr.length !== 4 || !/^[A-Z]{4}$/.test(arr)) {
    errors.push("arrival must be a 4-letter ICAO code");
  }

  const duration = row.duration;
  if (!duration || !duration.toString().trim()) {
    errors.push("duration is required");
  } else if (!duration.toString().includes(":")) {
    errors.push("duration must be in HH:MM format");
  } else if (!Number.isFinite(convertDurationToSeconds(duration))) {
    errors.push("duration must be a valid HH:MM value");
  }

  if (errors.length > 0) {
    throw new Error(`Row ${rowNumber}: ${errors.join(", ")}`);
  }

  // Parse aircraft names (semicolon or pipe separated list)
  const aircraftStr = (row.aircraft || "").toString().trim();
  const aircraftNames: string[] = [];

  if (aircraftStr) {
    // Split by semicolon or pipe
    const names = aircraftStr.split(/[;|]/).map((name: string) => name.trim());
    for (const name of names) {
      if (name) {
        aircraftNames.push(name);
      }
    }
  }

  return {
    fltnum: fltnum.toString().trim(),
    dep,
    arr,
    duration: duration.toString().trim(),
    notes: (row.notes || "").toString().trim(),
    aircraftNames,
  };
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "routes");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { mode } = body;

    // Mode 1: Parse and preview CSV
    if (mode === "preview") {
      const { csvContent } = body;

      // Parse CSV
      const rows = await parseCSV(csvContent);

      if (rows.length === 0) {
        return NextResponse.json(
          { success: false, message: "No data rows found in CSV" },
          { status: 400 },
        );
      }

      // Validate and collect aircraft names
      const validatedRoutes: ValidatedRouteRow[] = [];
      const errors: string[] = [];
      const uniqueAircraftNames = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        try {
          const validatedRoute = validateRouteRow(rows[i], i + 2);
          validatedRoutes.push(validatedRoute);
          validatedRoute.aircraftNames.forEach((name: string) => {
            uniqueAircraftNames.add(name);
          });
        } catch (error) {
          errors.push((error as Error).message);
        }
      }

      if (errors.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Validation errors found",
            errors,
          },
          { status: 400 },
        );
      }

      // Get available aircraft from database
      const availableAircraft = await models.Aircraft.findAll({
        attributes: ["id", "name", "liveryname"],
        order: [["name", "ASC"]],
      });

      return NextResponse.json({
        success: true,
        message: "CSV parsed successfully",
        preview: validatedRoutes,
        aircraftNames: Array.from(uniqueAircraftNames),
        availableAircraft: availableAircraft.map((ac: any) => ({
          id: ac.id,
          name: ac.name,
          liveryname: ac.liveryname,
        })),
      });
    }

    // Mode 2: Import with aircraft mappings
    if (mode === "import") {
      const { routes, mappings } = body;

      if (!routes || !Array.isArray(routes)) {
        return NextResponse.json(
          { success: false, message: "Invalid routes data" },
          { status: 400 },
        );
      }

      const creationErrors: string[] = [];
      const validatedRoutes: RouteToImport[] = [];

      for (let i = 0; i < routes.length; i++) {
        try {
          const routeData = routes[i];
          const validatedRoute = validateRouteRow(routeData, i + 1);
          const durationInSeconds = convertDurationToSeconds(
            validatedRoute.duration,
          );
          if (!Number.isFinite(durationInSeconds)) {
            throw new Error("Duration must be a valid HH:MM value");
          }

          const aircraftIds: number[] = [];
          for (const aircraftName of validatedRoute.aircraftNames) {
            const mappedId = Number(mappings?.[aircraftName]);
            if (!Number.isInteger(mappedId) || mappedId <= 0) {
              throw new Error(`Missing aircraft mapping for "${aircraftName}"`);
            }
            aircraftIds.push(mappedId);
          }

          validatedRoutes.push({
            ...validatedRoute,
            durationInSeconds,
            aircraftIds,
          });
        } catch (error) {
          creationErrors.push(
            `Route ${i + 1}: ${(error as Error).message || "Unknown error"}`,
          );
        }
      }

      if (creationErrors.length > 0) {
        return NextResponse.json(
          {
            success: false,
            message: "Import validation failed",
            errorCount: creationErrors.length,
            errors: creationErrors,
          },
          { status: 400 },
        );
      }

      const createdRoutes = await sequelize.transaction(async (transaction) => {
        const created: CreatedRouteSummary[] = [];

        for (const routeData of validatedRoutes) {
          const route = await models.Route.create(
            {
              fltnum: routeData.fltnum,
              dep: routeData.dep,
              arr: routeData.arr,
              duration: routeData.durationInSeconds,
              notes: routeData.notes,
            },
            { transaction },
          );

          if (routeData.aircraftIds.length > 0) {
            await models.RouteAircraft.bulkCreate(
              routeData.aircraftIds.map((aircraftId: number) => ({
                routeid: route.id,
                aircraftid: aircraftId,
              })),
              { transaction },
            );
          }

          created.push({
            id: route.id,
            fltnum: route.fltnum,
            dep: route.dep,
            arr: route.arr,
          });
        }

        return created;
      });

      return NextResponse.json(
        {
          success: true,
          message: `Successfully imported ${createdRoutes.length} routes`,
          createdCount: createdRoutes.length,
          errorCount: 0,
          createdRoutes,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { success: false, message: "Invalid mode specified" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error in bulk import:", error);
    return NextResponse.json(
      {
        success: false,
        message: `Failed to process bulk import: ${(error as Error).message}`,
      },
      { status: 500 },
    );
  }
}
