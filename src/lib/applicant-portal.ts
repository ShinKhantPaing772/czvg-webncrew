export const CZVG_IFC_PROFILE_URL =
  "https://community.infiniteflight.com/u/chinasouthernvg/summary";

export type ApplicantPortalNotice = {
  badge: string;
  title: string;
  description: string;
  actionLabel: string;
  tone: "danger" | "warning";
};

export function getApplicantPortalNotice(
  status: number,
): ApplicantPortalNotice | null {
  if (status === 2) {
    return {
      badge: "Application Rejected",
      title: "Your application has been rejected",
      description:
        "Your application to join CZVG was not approved. If you believe this was a mistake or would like more information, contact CZVG through our IFC account.",
      actionLabel: "Contact CZVG's IFC Account",
      tone: "danger",
    };
  }

  if (status === 3) {
    return {
      badge: "Account Inactive",
      title: "Your pilot account is inactive",
      description:
        "Your CZVG pilot account is currently inactive. To request reactivation or get assistance, contact CZVG through our IFC account.",
      actionLabel: "Contact CZVG's IFC Account",
      tone: "warning",
    };
  }

  return null;
}
