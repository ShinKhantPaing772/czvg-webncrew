"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  LinkIcon,
  Loader2,
  Mail,
  MessageCircle,
  Plane,
  Trophy,
  User,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { authFetch } from "@/lib/utils/api";

const QUIZ_URL = "https://forms.gle/cMGzZyjUidzAnF5E9";
const ACCESS_KEY = "34820245";

type ApplicantStatus = {
  id: number;
  name: string;
  callsign: string;
  email: string;
  status: number;
  statusLabel: string;
  examStatus: number;
  examDeclared: boolean;
  examScore: number | null;
  flightReplayUrl: string | null;
  discordInviteUrl: string | null;
};

export default function ApplicationStatusPage() {
  const [applicant, setApplicant] = useState<ApplicantStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingReplay, setSavingReplay] = useState(false);
  const [flightReplayUrl, setFlightReplayUrl] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadApplicant() {
      try {
        const response = await authFetch("/api/applicant/status");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load application status");
        }

        if (mounted) {
          setApplicant(data);
          setFlightReplayUrl(data.flightReplayUrl || "");
        }
      } catch (error) {
        if (mounted) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Failed to load application status",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadApplicant();

    return () => {
      mounted = false;
    };
  }, []);

  async function declareExamDone() {
    setSaving(true);
    setMessage("");

    try {
      const response = await authFetch("/api/applicant/status", {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update examination status");
      }

      setApplicant((current) =>
        current
          ? { ...current, examDeclared: true, examStatus: Math.max(current.examStatus, 1) }
          : current,
      );
      setMessage("Examination completion recorded.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to update examination status",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveFlightReplay() {
    setSavingReplay(true);
    setMessage("");

    try {
      const response = await authFetch("/api/applicant/status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "flightReplay",
          flightReplayUrl,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save flight replay link");
      }

      setApplicant((current) =>
        current
          ? { ...current, flightReplayUrl: data.flightReplayUrl }
          : current,
      );
      setFlightReplayUrl(data.flightReplayUrl);
      setMessage("Flight replay link saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to save flight replay link",
      );
    } finally {
      setSavingReplay(false);
    }
  }

  const examScoreReceived =
    applicant?.examScore !== null && applicant?.examScore !== undefined;
  const needsFlightReplay =
    applicant?.examScore !== null &&
    applicant?.examScore !== undefined &&
    applicant.examScore < 80;
  const progressSteps = [
    { label: "Application submitted", complete: true },
    { label: "Exam declared done", complete: Boolean(applicant?.examDeclared) },
    { label: "Score received", complete: examScoreReceived },
    ...(needsFlightReplay
      ? [
          {
            label: "Flight replay",
            complete: Boolean(applicant?.flightReplayUrl),
          },
        ]
      : []),
    { label: "Discord invite", complete: Boolean(applicant?.discordInviteUrl) },
  ];
  const completedProgressSteps = progressSteps.filter(
    (step) => step.complete,
  ).length;
  const progressValue = Math.round(
    (completedProgressSteps / progressSteps.length) * 100,
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="space-y-2">
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-50 text-blue-700"
          >
            Applicant Portal
          </Badge>
          <h1 className="text-3xl font-semibold tracking-normal text-slate-950">
            Application Status
          </h1>
        </section>

        {loading && (
          <div className="flex min-h-64 items-center justify-center rounded-lg border bg-white">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
            <span className="text-sm text-slate-600">Loading application...</span>
          </div>
        )}

        {!loading && applicant && (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Application Progress</CardTitle>
                    <CardDescription>
                      Track your application through examination and onboarding.
                    </CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 text-blue-700"
                  >
                    {progressValue}% Complete
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progressValue} className="h-3 bg-slate-200" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {progressSteps.map((step) => (
                    <div
                      key={step.label}
                      className="flex items-center gap-2 text-sm text-slate-600"
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                          step.complete
                            ? "border-green-200 bg-green-100 text-green-700"
                            : "border-slate-200 bg-white text-slate-400"
                        }`}
                      >
                        {step.complete && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </span>
                      <span className={step.complete ? "font-medium text-slate-900" : ""}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {applicant.discordInviteUrl && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-900">
                    <MessageCircle className="h-5 w-5" />
                    Discord Invite
                  </CardTitle>
                  <CardDescription className="text-green-800">
                    Join the crew Discord server to continue onboarding.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="bg-green-700 hover:bg-green-800">
                    <a
                      href={applicant.discordInviteUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Discord Invite
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Your Information</CardTitle>
                <CardDescription>
                  Review the details attached to your submitted application.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <InfoItem icon={User} label="Name" value={applicant.name} />
                <InfoItem
                  icon={User}
                  label="Callsign"
                  value={applicant.callsign}
                />
                <InfoItem icon={Mail} label="Email" value={applicant.email} />
                <InfoItem
                  icon={Trophy}
                  label="Exam Score"
                  value={
                    applicant.examScore === null
                      ? "Not received yet"
                      : `${applicant.examScore}/100`
                  }
                />
              </CardContent>
            </Card>

            {needsFlightReplay && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plane className="h-5 w-5 text-blue-700" />
                    Flight Replay Review
                  </CardTitle>
                  <CardDescription>
                    Upload a replay with full ATC coverage from departure to
                    arrival, then paste the ShareMyInfiniteFlight link here.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
                    Required ATC coverage: Ground, Tower, Departure when
                    available, and Approach.
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <Input
                      type="url"
                      placeholder="https://sharemyinfiniteflight.com/..."
                      value={flightReplayUrl}
                      onChange={(event) =>
                        setFlightReplayUrl(event.target.value)
                      }
                    />
                    <Button
                      onClick={saveFlightReplay}
                      disabled={savingReplay}
                      className="w-full sm:w-auto"
                    >
                      {savingReplay ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LinkIcon className="h-4 w-4" />
                      )}
                      Save Replay
                    </Button>
                  </div>
                  <Button asChild variant="outline">
                    <a
                      href="https://sharemyinfiniteflight.com/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open ShareMyInfiniteFlight
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Entrance Examination</CardTitle>
                <CardDescription>
                  Use the access key below when opening the Google Forms quiz.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-col gap-3 rounded-lg border bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500">
                        Access Key
                      </p>
                      <p className="font-mono text-xl font-semibold text-slate-950">
                        {ACCESS_KEY}
                      </p>
                    </div>
                  </div>
                  <Button asChild>
                    <a href={QUIZ_URL} target="_blank" rel="noreferrer">
                      Open Quiz
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>

                <Button
                  className="w-full sm:w-auto"
                  onClick={declareExamDone}
                  disabled={saving || applicant.examDeclared}
                  variant={applicant.examDeclared ? "secondary" : "default"}
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {applicant.examDeclared && <CheckCircle2 className="h-4 w-4" />}
                  {applicant.examDeclared
                    ? "Examination Declared Done"
                    : "Declare Examination Done"}
                </Button>
              </CardContent>
            </Card>

          </>
        )}

        {message && (
          <p className="rounded-md border bg-white px-4 py-3 text-sm text-slate-700">
            {message}
          </p>
        )}
      </main>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-slate-50 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="break-words text-base font-semibold text-slate-950">
        {value}
      </p>
    </div>
  );
}
