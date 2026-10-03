export type IfOrganization = { id: string; name: string; status?: number };
export type IfAircraft = { id: string; aircraftId: string; organizationId: string; registration: string; isFleetActiveSlot: boolean; visibility: number; status?: number };
export type IfPosition = { id: string; state: number; isOnGround: boolean; latitude: number; longitude: number; updatedAt: string; [key: string]: unknown };
export type IfCrew = { userId: string; role: 0 | 1 };
export type IfScheduleRequest = {
  callsign: string; flightType: number; originIcao: string; destinationIcao: string;
  scheduledDepartureUtc: string; scheduledArrivalUtc: string; briefing: string | null; flightPlan: string | null;
};
export type IfSchedule = IfScheduleRequest & { id: string; aircraftId: string; organizationId: string; status: number; crew: IfCrew[]; sequence?: number; updatedAt?: string };
/** App-authored fields only. Never save a fetched IF response in this type. */
export type AuthoredIfPayload = { schedule: IfScheduleRequest; crew: IfCrew[] };
