import type { FlightType } from "@/lib/scheduling/flight-types";

export type FlightStatus = "pending" | "approved" | "in_progress" | "completed" | "rejected" | "cancelled" | "needs_review";

export type SchedulingPilot = {
  id: number;
  name: string;
  callsign: string;
  eligible?: boolean;
  ifuserid?: string | null;
};

export type LiveAircraft = {
  id: number;
  registration: string;
  aircraft_id: number;
  current_airport: string | null;
  projected_airport?: string | null;
  active: boolean | number;
  if_aircraft_id?: string | null;
  name: string;
  liveryname?: string | null;
};

export type FlightMember = {
  id: number;
  flight_id: number;
  pilot_id: number;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  pilot: SchedulingPilot;
  review_reason?: string | null;
};

export type ScheduledFlight = {
  id: number;
  public_id: string;
  live_aircraft_id: number;
  captain_id: number;
  callsign?: string | null;
  flight_type?: FlightType;
  departure: string;
  arrival: string;
  queue_order?: number | null;
  scheduled_departure: string | null;
  scheduled_arrival: string | null;
  status: FlightStatus;
  notes?: string | null;
  review_reason?: string | null;
  revision: number;
  published_revision?: number | null;
  if_schedule_id?: string | null;
  publishing_state?: string | null;
  error?: string | null;
  actual_arrival?: string | null;
  captain: SchedulingPilot;
  members: FlightMember[];
  eligibility_issues?: string[];
};

export type SchedulingData = {
  aircraft: LiveAircraft[];
  flights: ScheduledFlight[];
  pilotId: number;
  canAdmin: boolean;
  pilots?: SchedulingPilot[];
  catalog?: Array<{ id: number; name: string; liveryname?: string | null }>;
  configuration?: { liveAwardConfigured: boolean };
};

export type FlightInput = {
  live_aircraft_id: number;
  callsign: string;
  flight_type: FlightType;
  departure: string;
  arrival: string;
  scheduled_departure: string | null;
  scheduled_arrival: string | null;
  notes: string;
};
