export const CREW_LOGIN_DISABLED_MESSAGE =
  "The Crew Center is temporarily unavailable for maintenance. Please try again later.";

export function isCrewLoginDisabled() {
  return process.env.CREW_LOGIN_DISABLED?.trim().toLowerCase() === "true";
}
