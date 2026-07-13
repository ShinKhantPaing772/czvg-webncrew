import { formatFlightTime } from "@/lib/utils/time";

export const formatFlightTimeHM = (hours: number) => {
  return formatFlightTime((Number(hours) || 0) * 3600);
};

export const formatFlightTimewithcolon = (hours: number) => {
  return formatFlightTime((Number(hours) || 0) * 3600);
};
