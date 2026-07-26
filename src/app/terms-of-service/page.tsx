import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export const metadata: Metadata = {
  title: "Terms of Service | China Southern Virtual Group IF",
  description:
    "Terms for using the China Southern Virtual Group website, applicant portal, and crew center.",
};

const effectiveDate = "July 26, 2026";

const sections = [
  {
    title: "Overview and Agreement",
    body: [
      "These Terms of Service govern your use of the China Southern Virtual Group IF website, applicant portal, crew center, routes, dashboards, PIREP tools, admin workflows, and related virtual airline services.",
      "CZVG is a virtual airline community for the Infinite Flight platform. We do not provide real-world airline, transportation, aviation training, dispatch, travel booking, employment, or safety services.",
      "By applying, creating an account, signing in, or using an authenticated CZVG feature, you agree to these terms, the Privacy Policy, and applicable CZVG rules and staff instructions. If you do not agree, do not apply for or use a CZVG account.",
    ],
  },
  {
    title: "Eligibility and Applications",
    body: [
      "You must be at least 13 years old to apply or use an account. If you are under the age of majority where you live, you must have permission from a parent or guardian. The signup flow does not independently verify age, so you are responsible for giving an accurate representation.",
      "Application requirements currently include an active Infinite Flight Pro subscription, an Infinite Flight Community account linked to Infinite Flight, Grade 3 or above, good community standing, no applicable IFVARB blacklist or watchlist issue, the ability to use Discord, and reasonable active participation. Requirements may change with notice on the application page or through staff instructions.",
      "CZVG uses the Infinite Flight public API to verify the submitted Infinite Flight Community username and obtain the linked user ID and available grade or violation metrics. You authorize those checks when you apply and while staff review or maintain your account.",
      "CZVG staff may approve, reject, pause, or close an application based on the stated requirements, submitted records, community standing, safety or security concerns, available capacity, or reasonable operational judgment. An application does not guarantee membership, rank, staff access, or any real-world benefit.",
    ],
  },
  {
    title: "Accounts and Security",
    body: [
      "You must provide an accurate preferred name, email address, and Infinite Flight Community username and keep information reasonably current. Passwords must meet the minimum shown by the signup or reset flow, and you are responsible for keeping your password, reset codes, and authentication token confidential.",
      "CZVG stores its authentication token in your browser's local storage, and the server accepts a valid token for up to seven days. Log out on shared devices and notify staff promptly if you believe an account or token has been compromised.",
      "You may not share, sell, transfer, impersonate, or create a misleading or duplicate account; use another person's email or Infinite Flight identity; or attempt to access another pilot's account, protected API, admin page, token, database record, or staff-only tool.",
      "We may expire or delete tokens, reset access, require re-verification, restrict features, or disable an account if we reasonably suspect misuse, inaccurate information, a security issue, inactivity, or a violation of these terms.",
    ],
  },
  {
    title: "Examination and Onboarding",
    body: [
      "Onboarding can include an assigned callsign, a Google Forms entrance examination, your declaration that the examination is complete, staff entry and review of the score, an additional replay, a Discord invite, and final staff approval.",
      "A score below 80 currently requires an additional ShareMyInfiniteFlight replay with the requested ATC coverage. Any replay URL must use the supported ShareMyInfiniteFlight domain, remain available for review, relate to your own requested assessment, and not be false, misleading, or unrelated.",
      "Do not falsely declare an examination complete, interfere with the form, share restricted examination material or access credentials, manipulate a score, or submit another person's work. CZVG may require a retake, additional evidence, or staff review when results are incomplete or questionable.",
      "Discord access is part of CZVG onboarding and community participation. An invite is personal to the onboarding process and must not be published, sold, or used to bypass Discord or CZVG moderation.",
    ],
  },
  {
    title: "PIREPs and Flight Records",
    body: [
      "A PIREP must describe a virtual flight you actually completed in a truthful and reasonably accurate way, including the flight number, route, aircraft, date, flight time, fuel used, and any requested multiplier.",
      "Do not submit a duplicate, fabricated, manipulated, or misleading PIREP or claim credited time, rank progress, event participation, aircraft eligibility, a multiplier, or an award you did not earn. A multiplier can change credited time, so it may differ from the raw duration.",
      "The live-flight and ACARS-style tools are convenience features that use public Infinite Flight API data to prefill available fields. That data can be incomplete, delayed, unavailable, or matched incorrectly. You remain responsible for checking every field before submitting the PIREP.",
      "PIREPs may include a discussion between the pilot and permitted staff. Comments must be relevant, truthful, and respectful and must not contain secrets, credentials, unnecessary personal information, harassment, or unlawful material.",
      "Authorized staff may review, approve, reject, correct PIREP fields, add or remove review comments, and adjust related statistics when reasonably necessary to keep records accurate and progression fair. CZVG may also remove or exclude invalid records through administrative maintenance.",
    ],
  },
  {
    title: "Acceptable Use",
    body: [
      "Use CZVG in a respectful, lawful, and community-minded way. Do not harass others, evade moderation, exploit or conceal a bug, interfere with the website, overload an endpoint or third-party API, scrape protected areas, inject malicious content, automate submissions without permission, or bypass access controls.",
      "Do not use CZVG to coordinate real-world aviation activity, emergency services, unlawful activity, spam, phishing, credential theft, or commercial activity not approved by CZVG staff.",
      "Do not misrepresent CZVG as being affiliated with, endorsed by, or operated by China Southern Group, Infinite Flight, IFVARB, Discord, or any real-world airline or organization.",
      "Do not collect, expose, or misuse another applicant's, pilot's, or staff member's personal information. If you discover a vulnerability or private information exposed in error, stop accessing it and report it privately to CZVG staff.",
    ],
  },
  {
    title: "Third-Party Services",
    body: [
      "CZVG depends on or links to services including Infinite Flight and its public API, Infinite Flight Community, IFVARB, Discord, ShareMyInfiniteFlight, Google Forms, Google Maps, Google Sheets, Brevo email delivery, iflytics, Instagram, third-party image hosts, community forums, and the separately hosted live map.",
      "Third-party services are not controlled by CZVG. Their availability, content, data handling, cookies, moderation, account decisions, security, and terms are governed by their operators. Embeds and remote content can contact a provider as soon as the relevant CZVG page loads, while a link contacts the provider when you open it.",
      "You must follow any applicable third-party rules when using a service with CZVG. Losing access to Infinite Flight, Infinite Flight Community, Discord, or another required service can affect your eligibility or ability to use related CZVG features.",
      "CZVG is not responsible for a third-party outage, data error, account action, content change, or loss, except where applicable law does not allow that responsibility to be excluded.",
    ],
  },
  {
    title: "Your Submissions",
    body: [
      "You keep any rights you have in comments, replay links, and other original material you submit. You give CZVG a non-exclusive, worldwide, royalty-free license to host, store, copy, format, transmit, display, and use that material only as reasonably needed to operate, review, moderate, secure, and preserve the virtual airline and its records.",
      "That operational license includes showing a submission to authorized staff or the relevant pilot, including limited application or PIREP details in configured Discord notices, and preserving an appropriate historical or audit record. It ends when the material is deleted except for copies that must reasonably remain for security, legal, dispute, backup, or historical-record purposes.",
      "You must have the right to submit the material and must not include another person's confidential information, personal data, or copyrighted content unless you have permission or another lawful basis to do so.",
    ],
  },
  {
    title: "Intellectual Property and Branding",
    body: [
      "The CZVG website, crew center layout, written content, records, route organization, and original community materials are provided for CZVG use unless otherwise stated.",
      "Airline names, aircraft names, platform names, logos, and trademarks belong to their respective owners. CZVG uses them for virtual airline, simulation, identification, community, or descriptive purposes only.",
      "You may not copy, misuse, impersonate, or commercially exploit CZVG branding, staff materials, private crew center data, or third-party marks displayed through the site.",
    ],
  },
  {
    title: "Service Availability and Changes",
    body: [
      "CZVG is maintained as a virtual community service. We may update, limit, pause, remove, or discontinue any part of the website, crew center, route database, admin tools, or integrations at any time.",
      "We do not guarantee that the site will always be available, uninterrupted, error-free, secure, compatible with every browser, or that data from Infinite Flight or another third party will be current or complete. Features, eligibility rules, routes, fleet data, ranks, awards, multipliers, and integrations can change as the group evolves.",
    ],
  },
  {
    title: "Enforcement and Account Closure",
    body: [
      "CZVG staff may warn, restrict, suspend, reject, remove, or terminate access for violations of these terms, application requirements, crew center rules, Discord rules, Infinite Flight community standards, or staff instructions.",
      "When practical, the response will reflect the seriousness and history of the issue, but CZVG may act immediately when needed to protect users, data, systems, community partners, or the group.",
      "You may ask staff to close your account. Account closure does not automatically erase PIREPs, comments, awards, security records, or other history that CZVG reasonably needs for accurate virtual-airline records, dispute resolution, abuse prevention, or legal obligations. Privacy requests are handled under the Privacy Policy and applicable law.",
      "We may preserve, review, or disclose relevant information when reasonably necessary to investigate abuse, protect the service, enforce these terms, comply with law, or communicate with an applicable platform or community partner.",
    ],
  },
  {
    title: "Disclaimers",
    body: [
      "The site and services are provided on an as-is and as-available basis for flight simulation and community purposes. To the maximum extent permitted by law, CZVG disclaims warranties of accuracy, availability, fitness for a particular purpose, and non-infringement.",
      "Virtual flight data, route information, aircraft information, dashboards, ranks, ACARS-style data, and operational content are for entertainment and community recordkeeping only. They must not be used for real-world aviation, navigation, dispatch, safety, travel, or training decisions.",
    ],
  },
  {
    title: "Limitation of Liability",
    body: [
      "To the maximum extent permitted by law, CZVG, its staff, contributors, and community operators will not be liable for indirect, incidental, consequential, special, punitive, or lost-data damages arising from your use of the website or crew center.",
      "Some jurisdictions do not allow certain limitations. In those places, the limitation applies only to the extent permitted by law.",
    ],
  },
  {
    title: "Privacy",
    body: [
      "Our Privacy Policy explains how CZVG collects, uses, stores, and discloses information for accounts, applications, the Google Forms examination workflow, the crew center, PIREPs, browser storage, Brevo email, Discord notices, third-party embeds, and Infinite Flight integrations.",
      "Transactional application, password-reset, examination, Discord invite, approval, security, and service messages are part of operating an account and are not marketing subscriptions.",
    ],
    link: {
      href: "/privacy-policy",
      label: "Read the Privacy Policy",
    },
  },
  {
    title: "Changes to These Terms",
    body: [
      "We may update these terms as CZVG features, staff practices, community standards, third-party integrations, or legal requirements change. The effective date above will be updated when material changes are made.",
      "Updated terms apply from the posted effective date. Continuing to use an authenticated CZVG service after that date means you accept the updated terms; if you do not agree, stop using the account and ask staff to close it.",
    ],
  },
];

export default function TermsOfServicePage() {
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
                Terms of Service
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-300">
                Effective {effectiveDate}. These terms cover use of the CZVG
                website, applicant portal, crew center, PIREP tools, and related
                virtual airline services.
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
                  CZVG is a virtual airline community. Be eligible, protect your
                  account, complete onboarding honestly, file accurate PIREPs,
                  follow staff and platform rules, and never use CZVG data for
                  real-world aviation.
                </p>
                <Link
                  href="/privacy-policy"
                  className="mt-5 inline-flex font-semibold text-primary hover:underline"
                >
                  Read Privacy Policy
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
                    {"link" in section && section.link ? (
                      <Link
                        href={section.link.href}
                        className="mt-4 inline-flex font-semibold text-primary hover:underline"
                      >
                        {section.link.label}
                      </Link>
                    ) : null}
                  </section>
                ))}

                <section className="rounded-md border border-slate-200 bg-slate-50 p-6">
                  <h2 className="text-2xl font-bold tracking-normal text-slate-950">
                    Contact
                  </h2>
                  <p className="mt-4 text-base leading-8 text-slate-600">
                    For questions about these terms, contact CZVG staff through
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
