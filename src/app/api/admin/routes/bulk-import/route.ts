import { NextResponse } from "next/server";
import sequelize from "@/lib/database";
import { models } from "@/lib/models";
import { requirePermission } from "@/lib/server-auth";
import { Op } from "sequelize";
import {
  convertDurationToSeconds,
  parseCSV,
  validateRouteRow,
  type ValidatedRouteRow,
  type InvalidRouteRow,
  type RouteToImport,
  type CreatedRouteSummary,
} from "@/lib/routes/bulk-import-utils";

// Mark this route as dynamic to prevent static optimization
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const auth = await requirePermission(request, "routes");
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { mode } = body;

    // Mode 1: Parse and preview CSV
    if (mode === "preview") {
      const { csvContent } = body;

      if (!csvContent || typeof csvContent !== "string" || !csvContent.trim()) {
        return NextResponse.json(
          { success: false, message: "CSV content is empty" },
          { status: 400 },
        );
      }

      // Parse CSV
      const { rows, malformedRows } = parseCSV(csvContent);

      if (rows.length === 0 && malformedRows.length === 0) {
        return NextResponse.json(
          { success: false, message: "No data rows found in CSV" },
          { status: 400 },
        );
      }

      // Validate rows
      const validRoutes: ValidatedRouteRow[] = [];
      const invalidRoutes: InvalidRouteRow[] = [...malformedRows];
      const uniqueAircraftNames = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        const result = validateRouteRow(rows[i], i + 2);
        if (result.ok) {
          validRoutes.push(result.route);
          result.route.aircraftNames.forEach((name) => uniqueAircraftNames.add(name));
        } else {
          invalidRoutes.push(result.error);
        }
      }

      // Query current routes count to inform user in case of overwrite
      const totalExistingRoutes = await models.Route.count();

      // Get available aircraft from database
      const availableAircraft = await models.Aircraft.findAll({
        attributes: ["id", "name", "liveryname"],
        order: [["name", "ASC"]],
      });

      if (validRoutes.length === 0) {
        return NextResponse.json(
          {
            success: false,
            message: "No valid route rows found in CSV",
            preview: [],
            invalidRoutes,
            totalRows: rows.length + malformedRows.length,
            validCount: 0,
            invalidCount: invalidRoutes.length,
            aircraftNames: [],
            availableAircraft: availableAircraft.map((ac: any) => ({
              id: ac.id,
              name: ac.name,
              liveryname: ac.liveryname,
            })),
            totalExistingRoutes,
          },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        message: "CSV parsed successfully",
        preview: validRoutes,
        invalidRoutes,
        totalRows: validRoutes.length + invalidRoutes.length,
        validCount: validRoutes.length,
        invalidCount: invalidRoutes.length,
        aircraftNames: Array.from(uniqueAircraftNames),
        availableAircraft: availableAircraft.map((ac: any) => ({
          id: ac.id,
          name: ac.name,
          liveryname: ac.liveryname,
        })),
        totalExistingRoutes,
      });
    }

    // Mode 2: Import with aircraft mappings and mode (append | overwrite)
    if (mode === "import") {
      const { routes, mappings, importType = "append" } = body;

      if (!routes || !Array.isArray(routes) || routes.length === 0) {
        return NextResponse.json(
          { success: false, message: "Invalid or empty routes data" },
          { status: 400 },
        );
      }

      if (importType !== "append" && importType !== "overwrite") {
        return NextResponse.json(
          { success: false, message: "Invalid importType. Must be 'append' or 'overwrite'" },
          { status: 400 },
        );
      }

      const creationErrors: string[] = [];
      const validatedRoutes: RouteToImport[] = [];

      for (let i = 0; i < routes.length; i++) {
        const routeData = routes[i];
        const result = validateRouteRow(routeData, i + 1);

        if (!result.ok) {
          creationErrors.push(
            `Route ${i + 1}: ${result.error.errors.join(", ")}`,
          );
          continue;
        }

        const validatedRoute = result.route;
        const durationInSeconds = convertDurationToSeconds(validatedRoute.duration);
        if (!Number.isFinite(durationInSeconds)) {
          creationErrors.push(`Route ${i + 1}: Duration must be a valid HH:MM value`);
          continue;
        }

        const aircraftIds: number[] = [];
        for (const aircraftName of validatedRoute.aircraftNames) {
          const mapping = mappings?.[aircraftName];
          if (mapping === undefined || mapping === null || mapping === "" || mapping === "none") {
            continue;
          }

          const mappedId = Number(mapping);
          if (!Number.isInteger(mappedId) || mappedId <= 0) {
            creationErrors.push(`Route ${i + 1}: Invalid aircraft mapping for "${aircraftName}"`);
            continue;
          }
          aircraftIds.push(mappedId);
        }

        validatedRoutes.push({
          ...validatedRoute,
          durationInSeconds,
          aircraftIds,
        });
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

      const result = await sequelize.transaction(async (transaction) => {
        let clearedCount = 0;

        // If overwrite mode, purge all existing route aircraft associations and routes
        if (importType === "overwrite") {
          clearedCount = await models.Route.count({ transaction });
          await models.RouteAircraft.destroy({
            where: { id: { [Op.gt]: 0 } },
            transaction,
          });
          await models.Route.destroy({
            where: { id: { [Op.gt]: 0 } },
            transaction,
          });
        }

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

        return { created, clearedCount };
      });

      return NextResponse.json(
        {
          success: true,
          message:
            importType === "overwrite"
              ? `Successfully cleared ${result.clearedCount} existing routes and imported ${result.created.length} new routes`
              : `Successfully imported ${result.created.length} routes`,
          createdCount: result.created.length,
          clearedCount: result.clearedCount,
          importType,
          errorCount: 0,
          createdRoutes: result.created,
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
