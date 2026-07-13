// Format a duration stored in seconds as HH:MM.
export function formatFlightTime(seconds: number): string {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const totalMinutes = Math.round(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}
