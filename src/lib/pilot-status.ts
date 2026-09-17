const LOGIN_STATUSES = new Set([0, 1, 2, 3]);

export function canPilotLogIn(status: number) {
  return LOGIN_STATUSES.has(status);
}

export function canAccessCrewCenter(status: number) {
  return status === 1;
}

export function usesApplicantPortal(status: number | null) {
  return status !== 1;
}

export function getCrewLandingPath(status: number | null) {
  return usesApplicantPortal(status) ? "/crew/application" : "/crew/home";
}
