import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export const metadata: Metadata = {
  title: "Privacy Policy | China Southern Virtual Group IF",
  description:
    "How China Southern Virtual Group collects, uses, and protects information for applicants, pilots, and crew center users.",
};

const effectiveDate = "July 26, 2026";

const sections = [
  {
    title: "Who We Are and What This Policy Covers",
    body: [
      "China Southern Virtual Group IF, also called CZVG in this policy, is a virtual airline community and crew center for Infinite Flight pilots. We are not a real-world airline, travel provider, flight school, or transportation service.",
      "This policy explains how CZVG handles information when you visit the website, apply to join, sign in, complete onboarding, use the crew center or ACARS-style tools, file or comment on a PIREP, contact staff, or use a connected feature.",
    ],
  },
  {
    title: "Information You Provide and Records We Create",
    body: [
      "Account information includes your preferred name, email address, password hash, assigned callsign, Infinite Flight Community username, Infinite Flight user ID, account status, join date, transferred hours or flights where applicable, and permissions assigned by staff. CZVG stores a bcrypt hash of your password, not the password in readable form.",
      "Application and onboarding records include your application status, Infinite Flight grade and violation count, the date those metrics were checked, examination completion status and score, related timestamps, a ShareMyInfiniteFlight replay URL when required, a Discord invite URL and delivery status, and notes entered by authorized staff.",
      "Crew activity records include PIREPs, flight number, departure and arrival airports, flight date, aircraft and livery selection, submitted or credited flight time, fuel used, multiplier, review status, pilot and staff comments, comment authors and timestamps, ranks, awards, route eligibility, and dashboard statistics.",
      "Communications records include the recipient name and email address and the content of transactional messages about applications, password resets, examination results, Discord invites, and approvals. CZVG also creates limited application and PIREP summaries for configured Discord channels.",
    ],
  },
  {
    title: "Information from Infinite Flight and Other Sources",
    body: [
      "When you enter an Infinite Flight Community username, CZVG sends that username to the Infinite Flight public API to confirm the account and obtain the associated user ID and available profile metrics such as grade and violation count. Staff tools may repeat that lookup or use the stored user ID to keep the link accurate.",
      "When you request ACARS-style assistance, CZVG uses your Infinite Flight user ID to find a current public live flight and may process returned session, flight, flight-plan, aircraft, livery, route, airport, duration, and fuel information. Infinite Flight endpoints may return other public live-session records in the same response; CZVG uses those records only to locate the requested pilot's flight and temporarily cache the API response.",
      "The entrance examination opens on Google Forms. Information entered on that form is submitted to Google and the form owner rather than through the CZVG website; CZVG stores the completion status, score entered by staff, and related timestamps in the crew center. A replay itself is hosted by ShareMyInfiniteFlight; CZVG stores the URL you submit, not the replay file.",
    ],
  },
  {
    title: "Authentication, Browser Storage, and Technical Data",
    body: [
      "After sign-in or application, the browser stores an authentication token in localStorage under the site's origin. The signed token represents your pilot ID and email address. The server accepts it for up to seven days, while the browser copy can remain until you log out or clear site data.",
      "If you save filters in the route finder, the browser stores the filter name and selected search, airport, aircraft, duration, and eligibility settings in localStorage. Those saved filters remain on that browser until you remove them or clear site data.",
      "Password-reset records include your email address, a bcrypt hash of the one-time passcode, its expiration time, and temporary request or verification counters used for rate limiting. Standard application, hosting, database, and security logs may also include IP address, browser or device details, referrer, requested page or endpoint, response status, error details, and timestamps.",
    ],
  },
  {
    title: "How We Collect and Use Information",
    body: [
      "We collect information directly from you when you apply, sign in, declare an examination complete, submit a replay URL, reset a password, file or comment on a PIREP, save a browser preference, or otherwise enter information. Authorized staff also create or update application scores, notes, status, callsigns, Discord invites, PIREP reviews, ranks, awards, and permissions.",
      "We use this information to operate the website, applicant portal, and crew center; assign callsigns; evaluate eligibility; complete onboarding; authenticate users; provide live-flight assistance; process and review PIREPs; calculate credited time, ranks, awards, and eligibility; display your dashboard; and maintain virtual airline history.",
      "We also use information to send required transactional messages, prevent duplicate or invalid submissions, rate-limit password-reset attempts, enforce permissions and community standards, investigate misuse, troubleshoot failures, protect the service, and meet legal obligations.",
      "CZVG does not sell personal information, use it for third-party targeted advertising, or send marketing email through the current codebase.",
    ],
  },
  {
    title: "When Information Is Disclosed",
    body: [
      "Authorized CZVG staff can access applicant, pilot, PIREP, comment, award, rank, and permission records according to their assigned role. A PIREP pilot can see comments attached to that pilot's own PIREPs.",
      "For a new application, the configured Discord webhook receives the applicant's preferred name, assigned callsign, Infinite Flight Community username, Infinite Flight user ID, and email address. For a new PIREP, the configured Discord webhook receives the flight number, pilot name and callsign, route, fuel used, and credited flight time. Access to those messages depends on the permissions of the destination Discord channel.",
      "Brevo receives the recipient name and email address, subject line, and transactional email content needed to deliver application, examination, Discord invite, approval, and password-reset messages. Message content can include a callsign, examination score, Discord invite URL, or one-time passcode, depending on the notice.",
      "CZVG sends Infinite Flight Community usernames or Infinite Flight user IDs to the Infinite Flight public API for identity checks and synchronization and processes public API responses for profile and live-flight features. Hosting, database, and security infrastructure providers also process information as needed to operate and protect the site.",
      "We may preserve or disclose relevant information when reasonably necessary to comply with law, respond to a valid legal request, protect users or the service, investigate misuse, enforce the Terms of Service, or communicate with an applicable platform or community partner.",
    ],
  },
  {
    title: "Third-Party Pages, Embeds, and Remote Content",
    body: [
      "Public CZVG pages embed Google Maps and a published Google Sheet, display a separately hosted live map, and load some images from third-party content hosts. When one of these resources loads, your browser connects directly to that provider and may send technical information such as your IP address, browser details, referring site or page, and existing provider cookies under that provider's own policy.",
      "When you open or use Google Forms, Infinite Flight, Infinite Flight Community, IFVARB, Discord, ShareMyInfiniteFlight, iflytics, Instagram, community forums, the live map, or another linked service, that service independently handles the information you provide and the technical data it receives under its own terms and privacy policy.",
    ],
  },
  {
    title: "Browser Storage, Cookies, and Tracking",
    body: [
      "The current CZVG codebase does not set its own advertising cookies or install dedicated advertising, behavioral analytics, or cross-site tracking pixels. It uses localStorage for the authentication token and optional saved route filters described above.",
      "Third-party embeds, remote content, and linked sites may set or read their own cookies or use similar technologies. Their behavior is controlled by those providers and your browser or provider settings, not by CZVG.",
      "Because CZVG does not currently operate cross-site behavioral tracking, browser Do Not Track signals do not change the site's own behavior. You can clear CZVG localStorage through logout, the route-filter controls, or your browser's site-data settings.",
    ],
  },
  {
    title: "Retention",
    body: [
      "The current application has no automatic deletion schedule for core account, application, PIREP, comment, rank, award, permission, or operational history. CZVG keeps those records while they are needed to run the group, maintain reliable virtual airline history and statistics, resolve disputes, enforce standards, or meet legal obligations.",
      "Authentication tokens are valid for seven days. Logging out deletes the current server token when the logout request succeeds, and a later verification request removes expired server-token records. A local browser copy may remain until logout or site data is cleared, but the server will not accept it after expiration.",
      "Password-reset passcodes expire after 10 minutes. Their hashed records are removed after a successful reset, when a later check detects expiration, or when a replacement code is requested. Temporary in-memory rate-limit counters generally reset after 15 minutes or when the relevant reset flow succeeds.",
      "Infinite Flight API responses are cached for approximately 15 seconds to one hour depending on the endpoint: live flights and flight plans use the shortest period, user lookups use about five minutes, sessions use about 10 minutes, and aircraft or livery reference data uses about one hour. Expired cache rows are removed during later cache maintenance.",
      "Saved route filters remain only in that browser until removed or site data is cleared. Hosting, database, email, Discord, Google, and other third-party providers retain information under their own operational settings and policies.",
      "If you ask us to close an account or delete information, we will review the request and remove or anonymize information where reasonably possible. We may retain limited records when needed for security, anti-abuse, audit, dispute resolution, legal obligations, or legitimate virtual airline recordkeeping.",
    ],
  },
  {
    title: "Security",
    body: [
      "We use safeguards appropriate to the size and nature of the service, including bcrypt hashing for passwords and reset passcodes, signed expiring authentication tokens, role-based checks on protected and admin routes, request validation, rate limiting for password resets, restrictive browser security headers, and HTTPS when the site is served over a secure connection.",
      "No website, browser-storage mechanism, email, webhook, or database can be guaranteed completely secure. Keep your password and one-time passcodes private, use a strong password that you do not reuse elsewhere, and log out on shared devices.",
    ],
  },
  {
    title: "Your Choices and Requests",
    body: [
      "You can review your application, account, dashboard, and PIREP information in the crew center and can update certain applicant or PIREP information through the available tools. Staff can help correct records when self-service editing is not available.",
      "You can remove saved route filters, log out, or clear the site's local browser data. You can also manage cookies and other information held by Google, Discord, and other third parties through their own controls.",
      "You may request access, correction, account closure, deletion, or restriction of your personal information by contacting CZVG through the Infinite Flight Community profile linked below. We may need to verify your identity, and closing or deleting required account data may end your ability to use the crew center.",
      "Depending on where you live, privacy law may give you additional rights. We will consider verified requests under applicable law and will not discriminate against you for making a privacy request.",
    ],
  },
  {
    title: "Children and Teens",
    body: [
      "CZVG is not intended for children under 13, and applicants must represent that they are at least 13 years old. The current signup flow does not collect a date of birth or perform automated age verification. Users under the age of majority where they live should use the service only with permission from a parent or guardian.",
      "If we learn that an applicant or account holder is under 13, we will take reasonable steps to close the account and delete or anonymize the associated personal information, subject to limited security or legal retention needs.",
    ],
  },
  {
    title: "International Users",
    body: [
      "CZVG serves an international flight-simulation community. Information may be processed in countries where CZVG staff or our hosting, database, email, Discord, Infinite Flight, Google, and other providers operate.",
      "Those locations may have privacy rules different from the rules in your country or region. Where applicable law requires additional safeguards for a transfer, CZVG will take reasonable steps to use them.",
    ],
  },
  {
    title: "Changes to This Policy",
    body: [
      "We may update this policy as the website, crew center, staff workflow, third-party services, or legal requirements change. We will post the revised policy and update the effective date when changes are made.",
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
                  CZVG uses account, application, Infinite Flight, PIREP, and
                  security data to run the virtual airline. Authorized staff can
                  access operational records, and limited notices go to Discord,
                  Brevo, and operational providers. We do not sell personal
                  information or run targeted advertising.
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
