import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export const metadata: Metadata = {
  title: "Terms of Service | China Southern Virtual Group IF",
  description:
    "Terms for using the China Southern Virtual Group website, applicant portal, and crew center.",
};

const effectiveDate = "July 6, 2026";

const sections = [
  {
    title: "Overview",
    body: [
      "These Terms of Service govern your use of the China Southern Virtual Group IF website, applicant portal, crew center, routes, dashboards, PIREP tools, admin workflows, and related virtual airline services.",
      "CZVG is a virtual airline community for the Infinite Flight platform. We do not provide real-world airline, transportation, aviation training, dispatch, travel booking, employment, or safety services.",
      "By accessing the site, creating an account, applying to join, or using the crew center, you agree to these terms and to any applicable CZVG staff instructions, community standards, and virtual airline rules.",
    ],
  },
  {
    title: "Eligibility",
    body: [
      "You must be at least 13 years old to apply or use an account. If you are under the age of majority where you live, you should have permission from a parent or guardian.",
      "Applicants must meet CZVG application requirements, which may include having an active Infinite Flight Pro subscription, an Infinite Flight Community account linked to Infinite Flight, good standing in the community, the required Infinite Flight grade, no relevant blacklist or watchlist issues, the ability to use Discord, and active participation.",
      "CZVG staff may approve, reject, pause, or close applications at their discretion when needed to protect the group, enforce standards, or comply with partner community requirements.",
    ],
  },
  {
    title: "Accounts and Security",
    body: [
      "You are responsible for the accuracy of the information you submit, keeping your password secure, and all activity that occurs under your account.",
      "You may not share, sell, transfer, impersonate, or create misleading accounts. You may not attempt to access another pilot's account, admin pages, tokens, database records, or staff-only tools.",
      "We may suspend or revoke tokens, reset access, require re-verification, or disable accounts if we suspect misuse, inaccurate information, security issues, inactivity, or violations of these terms.",
    ],
  },
  {
    title: "Applicant and Onboarding Rules",
    body: [
      "Applications may require Infinite Flight profile checks, an assigned callsign, entrance examination steps, score review, replay submission, Discord onboarding, and staff approval.",
      "If a flight replay is required, the link you submit must be valid and relevant to the requested assessment. Staff may reject incomplete, misleading, unavailable, or unrelated replay links.",
      "Discord invite links are provided for onboarding and community participation. Discord is a separate service with its own terms, policies, moderation tools, and account requirements.",
    ],
  },
  {
    title: "PIREPs and Flight Records",
    body: [
      "PIREPs must describe virtual flights you actually completed in a truthful and reasonably accurate way, including route, flight number, aircraft, date, flight time, fuel used, and any multiplier code.",
      "Do not submit duplicate, fabricated, manipulated, or misleading PIREPs. Do not claim time, rank progress, events, aircraft, multipliers, or awards that you did not earn under CZVG rules.",
      "CZVG staff may review, approve, reject, edit, comment on, or remove PIREPs and related pilot statistics to maintain accurate records and fair progression.",
      "Live flight lookup and ACARS-style tools are convenience features. They depend on Infinite Flight data availability and may be incomplete, delayed, unavailable, or mismatched. You remain responsible for reviewing a PIREP before submission.",
    ],
  },
  {
    title: "Acceptable Use",
    body: [
      "Use CZVG in a respectful, lawful, and community-minded way. Do not harass others, evade moderation, exploit bugs, interfere with the website, overload APIs, scrape protected areas, upload malicious content, or attempt to bypass permissions.",
      "Do not use CZVG to coordinate real-world aviation activity, emergency services, unlawful activity, spam, phishing, credential theft, or commercial activity not approved by CZVG staff.",
      "Do not misrepresent CZVG as being affiliated with, endorsed by, or operated by China Southern Group, Infinite Flight, IFVARB, Discord, or any real-world airline or organization.",
    ],
  },
  {
    title: "Third-Party Services",
    body: [
      "CZVG links to and interacts with third-party services, including Infinite Flight, Infinite Flight Community, IFVARB, Discord, ShareMyInfiniteFlight, iflytics, Brevo email delivery, Instagram, and other community resources.",
      "Third-party services are not controlled by CZVG. Their availability, content, moderation, privacy practices, account actions, and terms are their own responsibility.",
      "You must follow any applicable third-party rules when using those services with CZVG, including Infinite Flight, Infinite Flight Community, IFVARB, and Discord rules.",
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
      "We do not guarantee that the site will always be available, error-free, secure, compatible with every browser, or that all data from Infinite Flight or other third-party services will be current or complete.",
    ],
  },
  {
    title: "Enforcement",
    body: [
      "CZVG staff may warn, restrict, suspend, reject, remove, or terminate access for violations of these terms, application requirements, crew center rules, Discord rules, Infinite Flight community standards, or staff instructions.",
      "We may also preserve, review, or disclose relevant information when reasonably necessary to investigate abuse, protect the service, comply with law, or communicate with platform or community partners.",
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
      "Our Privacy Policy explains how we collect, use, store, and share information for the applicant portal, crew center, PIREPs, email notices, Discord staff workflows, and Infinite Flight integrations.",
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
      "Continuing to use the website or crew center after updated terms are posted means you accept the updated terms.",
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
                  CZVG is a virtual airline community. Keep account information
                  accurate, file truthful PIREPs, follow staff and platform
                  rules, and do not use the site for real-world aviation.
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
