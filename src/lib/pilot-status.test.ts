import { describe, expect, it } from "vitest";

import { getCrewLandingPath, usesApplicantPortal } from "./pilot-status";

describe("pilot portal routing", () => {
  it.each([
    [0, "pending"],
    [2, "rejected"],
    [3, "inactive"],
  ])("keeps status %i (%s) in the applicant portal", (status) => {
    expect(usesApplicantPortal(status)).toBe(true);
    expect(getCrewLandingPath(status)).toBe("/crew/application");
  });

  it("routes an approved pilot to the crew dashboard", () => {
    expect(usesApplicantPortal(1)).toBe(false);
    expect(getCrewLandingPath(1)).toBe("/crew/home");
  });
});
