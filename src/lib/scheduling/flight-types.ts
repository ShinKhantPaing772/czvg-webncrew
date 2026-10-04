/** Local flight purposes and their Infinite Flight PersistentFlightType values. */
export const FLIGHT_TYPES = [
  { value: "commercial", label: "Commercial", ifType: 1 },
  { value: "freight", label: "Freight", ifType: 3 },
  { value: "ferry", label: "Ferry", ifType: 12 },
  { value: "charter", label: "Charter", ifType: 2 },
  { value: "training", label: "Training", ifType: 4 },
  { value: "test_flight", label: "Test flight", ifType: 5 },
  { value: "medical_emergency", label: "Medical emergency", ifType: 6 },
  { value: "military", label: "Military", ifType: 7 },
  { value: "vip_executive", label: "VIP / Executive", ifType: 8 },
  { value: "humanitarian_relief", label: "Humanitarian relief", ifType: 9 },
  { value: "general_aviation", label: "General aviation", ifType: 10 },
  { value: "airshow", label: "Airshow", ifType: 11 },
  { value: "other", label: "Other", ifType: 12 },
] as const;

export type FlightType = (typeof FLIGHT_TYPES)[number]["value"];
export const DEFAULT_FLIGHT_TYPE: FlightType = "commercial";

export const IF_FLIGHT_TYPES = [
  { value: 0, label: "Not specified" },
  { value: 1, label: "Commercial" },
  { value: 2, label: "Charter" },
  { value: 3, label: "Freight" },
  { value: 4, label: "Training" },
  { value: 5, label: "Test flight" },
  { value: 6, label: "Medical emergency" },
  { value: 7, label: "Military" },
  { value: 8, label: "VIP / Executive" },
  { value: 9, label: "Humanitarian relief" },
  { value: 10, label: "General aviation" },
  { value: 11, label: "Airshow" },
  { value: 12, label: "Other" },
] as const;

export function isFlightType(value: unknown): value is FlightType {
  return typeof value === "string" && FLIGHT_TYPES.some(type => type.value === value);
}

export function isIfFlightType(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && IF_FLIGHT_TYPES.some(type => type.value === value);
}

export function flightTypeLabel(value: unknown): string {
  return FLIGHT_TYPES.find(type => type.value === (value ?? DEFAULT_FLIGHT_TYPE))?.label ?? "Unknown";
}

export function ifFlightTypeLabel(value: unknown): string {
  return IF_FLIGHT_TYPES.find(type => type.value === value)?.label ?? "Unknown";
}

export function toIfFlightType(value: unknown): number {
  const type = FLIGHT_TYPES.find(type => type.value === (value ?? DEFAULT_FLIGHT_TYPE));
  if (!type) throw new RangeError("Invalid local flight type");
  return type.ifType;
}
