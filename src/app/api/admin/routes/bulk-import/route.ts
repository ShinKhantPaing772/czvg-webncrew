import { NextResponse } from "next/server";
import { models } from "@/lib/models";
import { requirePermission } from "@/lib/server-auth";
// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Helper function to convert duration format
function convertDurationToSeconds(duration: string | number): number {
  if (typeof duration === "number") return duration;
  if (typeof duration === "string" && duration.includes(":")) {
    const [hours, minutes] = duration.split(":").map(Number);
    return hours * 60 * 60 + minutes * 60;
  }
  return Number(duration);
}

// Helper function to parse CSV
async function parseCSV(text: string): Promise<any[]> {
  const lines = text.trim().split("\n");
  if (lines.length < 2) {
    throw new Error("CSV must have at least a header row and one data row");
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    // Simple CSV parsing (handles basic cases, not quoted fields with commas)
    const values = line.split(",").map((v) => v.trim());

    if (values.length !== headers.length) {
      throw new Error(
        `Row ${i + 1} has ${values.length} columns but expected ${headers.length}`,
      );
    }

    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    rows.push(row);
  }

  return rows;
}

// Validate route row and extract aircraft names
function validateRouteRow(row: any, rowNumber: number): any {
  const errors = [];

  const fltnum = row.fltnum || row["flight number"];
  if (!fltnum || !fltnum.toString().trim()) {
    errors.push("flight number (fltnum) is required");
  }

  const dep = row.dep || row.departure;
  if (!dep || !dep.toString().trim()) {
    errors.push("departure airport (dep) is required");
  } else if (dep.length !== 4 || !/^[A-Z]{4}$/.test(dep)) {
    errors.push("departure must be a 4-letter ICAO code");
  }

  const arr = row.arr || row.arrival;
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
    dep: dep.toString().trim().toUpperCase(),
    arr: arr.toString().trim().toUpperCase(),
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
    const { mode, parsedData, aircraftMappings } = body;

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
      const validatedRoutes = [];
      const errors = [];
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

      const createdRoutes = [];
      const creationErrors = [];

      for (let i = 0; i < routes.length; i++) {
        try {
          const routeData = routes[i];
          const durationInSeconds = convertDurationToSeconds(
            routeData.duration,
          );

          const route = await models.Route.create({
            fltnum: routeData.fltnum,
            dep: routeData.dep,
            arr: routeData.arr,
            duration: durationInSeconds,
            notes: routeData.notes,
          });

          // Add aircraft associations
          if (routeData.aircraftNames && routeData.aircraftNames.length > 0) {
            const aircraftIds: number[] = [];

            for (const aircraftName of routeData.aircraftNames) {
              const mappedId = mappings?.[aircraftName];
              if (mappedId) {
                aircraftIds.push(mappedId);
              }
            }

            if (aircraftIds.length > 0) {
              const routeAircraftEntries = aircraftIds.map((aircraftId) => ({
                routeid: route.id,
                aircraftid: aircraftId,
              }));

              await models.RouteAircraft.bulkCreate(routeAircraftEntries);
            }
          }

          createdRoutes.push({
            id: route.id,
            fltnum: route.fltnum,
            dep: route.dep,
            arr: route.arr,
          });
        } catch (error) {
          creationErrors.push(
            `Route ${i + 1}: ${(error as Error).message || "Unknown error"}`,
          );
        }
      }

      const allSuccessful = creationErrors.length === 0;

      return NextResponse.json(
        {
          success: allSuccessful,
          message: allSuccessful
            ? `Successfully imported ${createdRoutes.length} routes`
            : `Imported ${createdRoutes.length} routes with ${creationErrors.length} errors`,
          createdCount: createdRoutes.length,
          errorCount: creationErrors.length,
          createdRoutes,
          errors: creationErrors.length > 0 ? creationErrors : undefined,
        },
        { status: allSuccessful ? 200 : 207 },
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
