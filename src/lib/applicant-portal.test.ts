import { describe, expect, it } from "vitest";

import {
  CZVG_IFC_PROFILE_URL,
  getApplicantPortalNotice,
} from "./applicant-portal";

describe("applicant portal status notices", () => {
  it("presents a rejected application with IFC contact guidance", () => {
    expect(getApplicantPortalNotice(2)).toMatchObject({
      badge: "Application Rejected",
      title: "Your application has been rejected",
      tone: "danger",
    });
    expect(getApplicantPortalNotice(2)?.description).toContain(
      "contact CZVG through our IFC account",
    );
  });

  it("presents an inactive account with reactivation guidance", () => {
    expect(getApplicantPortalNotice(3)).toMatchObject({
      badge: "Account Inactive",
      title: "Your pilot account is inactive",
      tone: "warning",
    });
    expect(getApplicantPortalNotice(3)?.description).toContain(
      "request reactivation",
    );
  });

  it.each([0, 1])("does not show a restricted notice for status %i", (status) => {
    expect(getApplicantPortalNotice(status)).toBeNull();
  });

  it("links to CZVG's IFC profile", () => {
    expect(CZVG_IFC_PROFILE_URL).toBe(
      "https://community.infiniteflight.com/u/chinasouthernvg/summary",
    );
  });
});
