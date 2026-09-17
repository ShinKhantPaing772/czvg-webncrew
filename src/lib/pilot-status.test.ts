import { describe, expect, it } from "vitest";

import {
  canAccessCrewCenter,
  canPilotLogIn,
  getCrewLandingPath,
  usesApplicantPortal,
} from "./pilot-status";

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

  it.each([null, 99])(
    "fails closed to the applicant portal for status %s",
    (status) => {
      expect(usesApplicantPortal(status)).toBe(true);
      expect(getCrewLandingPath(status)).toBe("/crew/application");
    },
  );

  it.each([0, 1, 2, 3])("allows known pilot status %i to log in", (status) => {
    expect(canPilotLogIn(status)).toBe(true);
  });

  it("does not allow an unknown pilot status to log in", () => {
    expect(canPilotLogIn(99)).toBe(false);
  });

  it.each([0, 2, 3])(
    "denies crew-center access to pilot status %i",
    (status) => {
      expect(canAccessCrewCenter(status)).toBe(false);
    },
  );

  it("allows only approved pilots into the crew center", () => {
    expect(canAccessCrewCenter(1)).toBe(true);
  });
});
