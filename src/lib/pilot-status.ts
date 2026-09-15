const APPLICANT_PORTAL_STATUSES = new Set([0, 2, 3]);

export function usesApplicantPortal(status: number | null) {
  return status !== null && APPLICANT_PORTAL_STATUSES.has(status);
}

export function getCrewLandingPath(status: number | null) {
  return usesApplicantPortal(status) ? "/crew/application" : "/crew/home";
}
