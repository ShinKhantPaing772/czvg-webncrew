import { Op } from "sequelize";
import { models } from "@/lib/models";
import { canAccessLiveScheduling } from "./access";
import { LiveAircraft, LiveFlight, LiveFlightMember } from "./models";

export interface PilotLiveSchedulingSummary {
  eligible: boolean;
  activeAircraftCount: number;
  openSeatsCount: number;
  myFlights: Array<{
    id: number;
    callsign: string | null;
    departure: string;
    arrival: string;
    status: string;
    scheduled_departure: string | null;
    role: "captain" | "crew";
    aircraft: {
      id: number;
      registration: string;
      catalogAircraftId: number;
      name: string;
      liveryname: string | null;
      current_airport: string | null;
    } | null;
  }>;
}

export interface AdminLiveSchedulingSummary {
  activeAircraft: number;
  awaitingReview: number;
  inProgress: number;
  syncAttention: number;
}

/**
 * Returns a lightweight Live Scheduling overview for the pilot dashboard.
 * Degrades to null when Live Scheduling tables or access checks are unavailable.
 */
export async function getPilotLiveSchedulingSummary(
  pilotId: number,
  pilotStatus?: number,
): Promise<PilotLiveSchedulingSummary | null> {
  try {
    const eligible = await canAccessLiveScheduling(pilotId, pilotStatus);
    if (!eligible) {
      return {
        eligible: false,
        activeAircraftCount: 0,
        openSeatsCount: 0,
        myFlights: [],
      };
    }

    const [activeAircraft, relevantFlights, memberships] = await Promise.all([
      LiveAircraft.findAll({
        where: { active: true },
        attributes: ["id", "registration", "aircraft_id", "current_airport"],
        raw: true,
      }),
      LiveFlight.findAll({
        where: {
          status: { [Op.in]: ["pending", "approved", "in_progress", "needs_review", "completed"] },
          [Op.or]: [
            { status: { [Op.ne]: "completed" } },
            { updated_at: { [Op.gte]: new Date(Date.now() - 7 * 86400000) } },
          ],
        },
        order: [["queue_order", "ASC"], ["id", "ASC"]],
        raw: true,
      }),
      LiveFlightMember.findAll({
        where: { pilot_id: pilotId, status: { [Op.in]: ["pending", "approved"] } },
        attributes: ["flight_id", "status"],
        raw: true,
      }),
    ]);

    const catalogIds = [...new Set(activeAircraft.map((item) => item.aircraft_id))];
    const catalogRows = catalogIds.length
      ? await models.Aircraft.findAll({
          where: { id: { [Op.in]: catalogIds } },
          attributes: ["id", "name", "liveryname"],
          raw: true,
        })
      : [];
    const catalogMap = new Map(catalogRows.map((item) => [Number(item.id), item]));
    const aircraftMap = new Map(activeAircraft.map((item) => [Number(item.id), item]));

    const approvedMemberFlightIds = relevantFlights.length
      ? await LiveFlightMember.findAll({
          where: {
            flight_id: { [Op.in]: relevantFlights.filter((f) => f.status === "approved").map((f) => f.id) },
            status: "approved",
          },
          attributes: ["flight_id"],
          raw: true,
        })
      : [];

    const crewCountByFlight = new Map<number, number>();
    for (const row of approvedMemberFlightIds) {
      crewCountByFlight.set(row.flight_id, (crewCountByFlight.get(row.flight_id) ?? 0) + 1);
    }

    const openSeatsCount = relevantFlights.filter(
      (flight) => flight.status === "approved" && (crewCountByFlight.get(flight.id) ?? 0) < 2,
    ).length;

    const crewFlightIds = new Set(memberships.map((m) => Number(m.flight_id)));
    const myFlights = relevantFlights
      .filter((flight) => flight.captain_id === pilotId || crewFlightIds.has(flight.id))
      .slice(0, 5)
      .map((flight) => {
        const tail = aircraftMap.get(flight.live_aircraft_id);
        const cat = tail ? catalogMap.get(tail.aircraft_id) : undefined;
        return {
          id: flight.id,
          callsign: flight.callsign,
          departure: flight.departure,
          arrival: flight.arrival,
          status: flight.status,
          scheduled_departure: flight.scheduled_departure
            ? new Date(flight.scheduled_departure).toISOString()
            : null,
          role: (flight.captain_id === pilotId ? "captain" : "crew") as "captain" | "crew",
          aircraft: tail
            ? {
                id: tail.id,
                registration: tail.registration,
                catalogAircraftId: tail.aircraft_id,
                name: cat?.name ?? "Aircraft",
                liveryname: cat?.liveryname ?? null,
                current_airport: tail.current_airport,
              }
            : null,
        };
      });

    return {
      eligible: true,
      activeAircraftCount: activeAircraft.length,
      openSeatsCount,
      myFlights,
    };
  } catch {
    return null;
  }
}

/**
 * Returns a lightweight Live Scheduling overview for the admin analytics dashboard.
 */
export async function getAdminLiveSchedulingSummary(): Promise<AdminLiveSchedulingSummary | null> {
  try {
    const [activeAircraft, awaitingReview, inProgress, syncAttention] = await Promise.all([
      LiveAircraft.count({ where: { active: true } }),
      LiveFlight.count({ where: { status: { [Op.in]: ["pending", "needs_review"] } } }),
      LiveFlight.count({ where: { status: "in_progress" } }),
      LiveFlight.count({
        where: {
          status: "approved",
          publishing_state: { [Op.in]: ["failed", "partial", "conflict", "reconciliation"] },
        },
      }),
    ]);

    return {
      activeAircraft,
      awaitingReview,
      inProgress,
      syncAttention,
    };
  } catch {
    return null;
  }
}
