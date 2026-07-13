import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export const metadata: Metadata = {
  title: "Privacy Policy | China Southern Virtual Group IF",
  description:
    "How China Southern Virtual Group collects, uses, and protects information for applicants, pilots, and crew center users.",
};

const effectiveDate = "July 6, 2026";

const sections = [
  {
    title: "Who We Are",
    body: [
      "China Southern Virtual Group IF, also called CZVG in this policy, is a virtual airline community and crew center for Infinite Flight pilots. We are not a real-world airline, travel provider, flight school, or transportation service.",
      "This policy explains how we handle information when you visit the website, apply to join, sign in to the crew center, file PIREPs, use applicant tools, or interact with our staff systems.",
    ],
  },
  {
    title: "Information We Collect",
    body: [
      "Account and application information, including your preferred name, email address, password hash, assigned callsign, Infinite Flight Community username, Infinite Flight user ID, application status, entrance exam status, entrance exam score, staff notes, Discord invite status, and application timestamps.",
      "Infinite Flight and community information, including publicly available or API-returned Infinite Flight profile details such as grade, violation count, live flight data used for ACARS-style assistance, and links you provide from ShareMyInfiniteFlight.",
      "Crew activity information, including PIREPs, flight numbers, departure and arrival airports, aircraft selections, flight time, fuel used, multipliers, PIREP status, reviewer comments, ranks, awards, permissions, and related dashboard statistics.",
      "Authentication and security information, including bearer tokens stored by your browser, one-time passcodes for password reset, token expiration and revocation records, rate-limit records, and standard server logs that may include IP address, browser details, device information, pages requested, and timestamps.",
      "Communications information, including transactional emails we send about applications, password resets, exam scores, Discord invites, approvals, and staff notifications sent through configured Discord webhooks.",
    ],
  },
  {
    title: "How We Collect Information",
    body: [
      "We collect information directly from you when you apply, sign in, submit a PIREP, update application steps, reset a password, or otherwise enter information in the crew center.",
      "We collect some information from third-party services when needed to run the virtual airline, including the Infinite Flight public API, Infinite Flight Community profile pages, ShareMyInfiniteFlight links you submit, Discord invite links, and transactional email providers.",
      "We also collect limited technical information automatically through the website, authentication flow, hosting environment, database, and security logs.",
    ],
  },
  {
    title: "How We Use Information",
    body: [
      "We use information to operate the applicant portal and crew center, review applications, assign callsigns, verify basic Infinite Flight eligibility, manage ranks and permissions, process PIREPs, show pilot dashboards, detect duplicate or invalid submissions, and support staff moderation.",
      "We use contact information to send transactional messages such as password reset codes, application confirmations, examination results, Discord invite notices, and account approval messages.",
      "We use security information to authenticate users, revoke sessions, protect admin tools, investigate abuse, prevent fraud, maintain service reliability, and comply with community rules or legal obligations.",
      "We do not use applicant or pilot information for third-party targeted advertising, and we do not sell personal information.",
    ],
  },
  {
    title: "How We Share Information",
    body: [
      "CZVG staff with appropriate permissions may access applicant, pilot, PIREP, and admin information to operate the virtual airline.",
      "We share information with service providers that help us run the site, including hosting, database, email delivery, Discord webhook, and security infrastructure providers. These providers process information for us or as needed to provide their own services.",
      "We may send applicant or PIREP summaries to configured Discord channels for staff review. These summaries may include your name, callsign, Infinite Flight Community username or user ID, email address, flight route, flight time, and other details relevant to the staff workflow.",
      "When you click links or use connected services such as Infinite Flight, Infinite Flight Community, IFVARB, Discord, ShareMyInfiniteFlight, iflytics, Instagram, or community forums, those services handle information under their own policies.",
      "We may disclose information if required by law, to protect users or the service, to investigate misuse, or to enforce our Terms of Service and community rules.",
    ],
  },
  {
    title: "Browser Storage, Cookies, and Tracking",
    body: [
      "The crew center stores your authentication token in browser localStorage so you can stay signed in. You can clear it by logging out or clearing your browser site data.",
      "The current codebase does not use advertising cookies, cross-site advertising trackers, or analytics pixels for targeted advertising. If that changes, this policy should be updated before those tools are used.",
      "Because we do not currently run cross-site behavioral tracking, browser Do Not Track signals do not change how the site behaves. Third-party websites linked from CZVG may use their own cookies or tracking technologies.",
    ],
  },
  {
    title: "Retention",
    body: [
      "We keep account, application, PIREP, rank, award, and operational records for as long as needed to run CZVG, maintain virtual airline history, resolve disputes, enforce standards, and keep reliable pilot statistics.",
      "Authentication tokens expire after a limited session period and may be revoked on logout. Password reset one-time passcodes are intended for short-term use and expire after 10 minutes.",
      "Cached Infinite Flight lookup data is intended to be short lived. Server and hosting logs may be retained according to the relevant provider's operational settings.",
      "If you ask us to delete information, we will review the request and remove or anonymize information where reasonably possible. We may retain limited records when needed for security, anti-abuse, audit, legal, or legitimate virtual airline recordkeeping purposes.",
    ],
  },
  {
    title: "Security",
    body: [
      "We use reasonable technical and organizational safeguards for the size and nature of the service, including password hashing, expiring authentication tokens, permission checks for admin routes, and HTTPS when the site is served over a secure connection.",
      "No website or database can be guaranteed completely secure. You are responsible for keeping your password private, using a strong and unique password, and logging out on shared devices.",
    ],
  },
  {
    title: "Your Choices and Requests",
    body: [
      "You can review and update certain account and flight information in the crew center. Staff can help correct application or pilot records when self-service editing is not available.",
      "You may request access, correction, deletion, or restriction of your personal information by contacting CZVG through the Infinite Flight Community profile linked below. We may need to verify your identity before acting on a request.",
      "Depending on where you live, privacy laws may give you additional rights. We will handle verified requests in a reasonable way and will not discriminate against you for making a privacy request.",
    ],
  },
  {
    title: "Children and Teens",
    body: [
      "CZVG is not intended for children under 13. Applicants must be at least 13 years old, and users under the age of majority in their location should use the service only with permission from a parent or guardian.",
      "If we learn that we have collected personal information from a child under 13 without appropriate consent, we will take reasonable steps to delete it.",
    ],
  },
  {
    title: "International Users",
    body: [
      "CZVG is available to an international flight simulation community. Your information may be processed in countries where our hosting, database, email, Discord, and other service providers operate.",
      "By using the site, you understand that your information may be transferred to and processed in locations that may have privacy laws different from those in your country or region.",
    ],
  },
  {
    title: "Changes to This Policy",
    body: [
      "We may update this policy as the website, crew center, staff workflow, or legal requirements change. The effective date above will be updated when material changes are made.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-950">
      <Header />
      <main className="flex-1">
        <section className="site-section bg-slate-950 text-white">
          <div className="site-container">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase text-sky-200">
                Legal
              </p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                Privacy Policy
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Effective {effectiveDate}. This page describes the information
                CZVG collects and how we use it to run the virtual airline,
                applicant portal, and crew center.
              </p>
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="site-container">
            <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
              <aside className="rounded-md border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 lg:sticky lg:top-24">
                <p className="font-semibold text-slate-950">Quick Summary</p>
                <p className="mt-3 leading-6">
                  CZVG uses applicant, account, Infinite Flight, PIREP, and
                  security data to operate the virtual airline. We do not sell
                  personal information or run targeted advertising.
                </p>
                <Link
                  href="/terms-of-service"
                  className="mt-5 inline-flex font-semibold text-primary hover:underline"
                >
                  Read Terms of Service
                </Link>
              </aside>

              <div className="space-y-8">
                {sections.map((section) => (
                  <section
                    key={section.title}
                    className="border-b border-slate-200 pb-8 last:border-b-0 last:pb-0"
                  >
                    <h2 className="text-2xl font-bold tracking-normal text-slate-950">
                      {section.title}
                    </h2>
                    <div className="mt-4 space-y-4 text-base leading-8 text-slate-600">
                      {section.body.map((paragraph) => (
                        <p key={paragraph}>{paragraph}</p>
                      ))}
                    </div>
                  </section>
                ))}

                <section className="rounded-md border border-slate-200 bg-slate-50 p-6">
                  <h2 className="text-2xl font-bold tracking-normal text-slate-950">
                    Contact
                  </h2>
                  <p className="mt-4 text-base leading-8 text-slate-600">
                    For privacy questions or requests, contact CZVG staff through
                    our{" "}
                    <a
                      href="https://community.infiniteflight.com/u/chinasouthernvg/summary"
                      className="font-semibold text-primary hover:underline"
                    >
                      Infinite Flight Community profile
                    </a>
                    .
                  </p>
                </section>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
