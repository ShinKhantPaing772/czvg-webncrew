// Utility function to format seconds to decimal hours
export function formatFlightTime(seconds: number): string {
  const totalHours = seconds / 3600;
  const hours = Math.floor(totalHours);
  const minutes = (totalHours - hours) * 60;
  const decimalHours = (minutes / 60).toFixed(2);
  return `${hours}.${decimalHours.substring(2).padStart(2, "0")}`;
}
