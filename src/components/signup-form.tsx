"use client";

import type React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ThemedButton from "@/components/system/ThemedButton";
import { Input } from "@/components/ui/input";
import SimpleField from "@/components/system/SimpleField";
import { CheckCircle2, AlertCircle, Loader2, XCircle } from "lucide-react";
import { setToken } from "@/lib/utils/auth";
import {
  isValidSignupName,
  sanitizeSignupName,
  SIGNUP_NAME_INPUT_PATTERN,
} from "@/lib/utils/signup-name";

export function SignupForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIFC, setLoadingIFC] = useState(false);
  const [validIFC, setValidIFC] = useState(false);
  const [ifUserId, setIfUserId] = useState("");
  const [ifMetrics, setIfMetrics] = useState<{
    grade: number | null;
    violations: number | null;
  }>({ grade: null, violations: null });
  const [message, setMessage] = useState({ type: "", text: "" });
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    name: "",
    ifc: "",
  });
  const [passwordError, setPasswordError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: id === "name" ? sanitizeSignupName(value) : value,
    }));
  };

  useEffect(() => {
    if (!formData.ifc) return;

    const timeout = setTimeout(async () => {
      try {
        setLoadingIFC(true);
        setMessage({ type: "", text: "" });

        const response = await fetch(`/api/auth/ifc/${formData.ifc}`);
        if (!response.ok) throw new Error("IFC check failed");

        const data = await response.json();
        const isValid = data.result && data.result.length > 0;
        const ifUser = isValid ? data.result[0] : null;
        setValidIFC(isValid);
        setIfUserId(isValid ? ifUser.userId : "");
        setIfMetrics(
          isValid
            ? {
                grade: normalizeInteger(
                  getNestedValue(ifUser, [
                    ["grade"],
                    ["userGrade"],
                    ["statistics", "grade"],
                    ["stats", "grade"],
                  ]),
                ),
                violations: normalizeViolations(
                  getNestedValue(ifUser, [
                    ["violations"],
                    ["violationCount"],
                    ["totalViolations"],
                    ["statistics", "violations"],
                    ["statistics", "violationCount"],
                    ["stats", "violations"],
                    ["stats", "violationCount"],
                  ]),
                ),
              }
            : { grade: null, violations: null },
        );
      } catch (error) {
        setValidIFC(false);
        setIfMetrics({ grade: null, violations: null });
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "IFC check failed",
        });
      } finally {
        setLoadingIFC(false);
      }
    }, 600); // debounce delay in ms

    return () => clearTimeout(timeout);
  }, [formData.ifc]);

  function validatePassword() {
    if (formData.password.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return false;
    }

    if (formData.password !== formData.passwordConfirm) {
      setPasswordError("Passwords do not match");
      return false;
    }

    setPasswordError("");
    return true;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidSignupName(formData.name)) {
      setMessage({
        type: "error",
        text: "Name can only contain English letters, numbers, and spaces.",
      });
      return;
    }

    if (!validatePassword()) {
      setMessage({
        type: "error",
        text: "Please check the password field.",
      });
      return;
    }
    if (!validIFC) {
      setMessage({
        type: "error",
        text: "IFC username entered is not valid, please enter a valid IFC username.",
      });
      return;
    }

    setIsLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "signup",
          email: formData.email,
          password: formData.password,
          name: formData.name,
          ifc: formData.ifc,
          ifUserId: ifUserId,
          ifGrade: ifMetrics.grade,
          ifViolations: ifMetrics.violations,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      if (data.token) {
        setToken(data.token);
      }

      setMessage({
        type: "success",
        text: data.message || "Registration successful",
      });

      router.push(data.redirectTo || "/crew/application");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Registration failed",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SimpleField
        id="name"
        label="Preferred Name"
        description="Use English letters, numbers, and spaces only."
      >
        <Input
          id="name"
          placeholder="John Doe"
          required
          autoComplete="name"
          pattern={SIGNUP_NAME_INPUT_PATTERN}
          title="Use English letters, numbers, and spaces only."
          className="border-blue-200 focus-visible:ring-blue-500"
          value={formData.name}
          onChange={handleChange}
        />
      </SimpleField>

      <SimpleField id="email" label="Email Address">
        <Input
          id="email"
          type="email"
          placeholder="pilot@example.com"
          required
          autoComplete="username"
          className="border-blue-200 focus-visible:ring-blue-500"
          value={formData.email}
          onChange={handleChange}
        />
      </SimpleField>

      <SimpleField
        id="ifc"
        label="Infinite Flight Community Profile URL"
        description={
          <span className="text-xs text-gray-600">
            All pilots are required to have an active{" "}
            <Link
              href="https://community.infiniteflight.com"
              className="font-medium text-blue-600 hover:underline"
            >
              Infinite Flight Community
            </Link>{" "}
            Account
          </span>
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
          <span className="inline-flex h-9 shrink-0 items-center rounded-md border border-blue-200 bg-blue-50 px-3 text-sm text-gray-600 sm:rounded-r-none sm:border-r-0">
            https://community.infiniteflight.com/u/
          </span>
          <div className="relative w-full min-w-0">
            <Input
              id="ifc"
              className="border-blue-200 pr-10 focus-visible:ring-blue-500 sm:rounded-l-none"
              placeholder="username"
              required
              value={formData.ifc}
              onChange={handleChange}
            />
            <span className="absolute inset-y-0 right-2 flex items-center">
              {loadingIFC && (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              )}
              {!loadingIFC && formData.ifc && validIFC && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              {!loadingIFC && formData.ifc && !validIFC && (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </span>
          </div>
        </div>
      </SimpleField>

      <SimpleField id="password" label="Password">
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          required
          autoComplete="new-password"
          className="border-blue-200 focus-visible:ring-blue-500"
        />
        <div className="flex items-center gap-1.5 text-xs">
          {formData.password.length >= 8 ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-blue-400" />
          )}
          <span
            className={
              formData.password.length >= 8 ? "text-green-600" : "text-gray-600"
            }
          >
            Must be at least 8 characters long
          </span>
        </div>
      </SimpleField>

      <SimpleField id="passwordConfirm" label="Confirm Password">
        <Input
          id="passwordConfirm"
          type="password"
          value={formData.passwordConfirm}
          onChange={handleChange}
          required
          autoComplete="new-password"
          className="border-blue-200 focus-visible:ring-blue-500"
        />
        {passwordError && (
          <div className="flex items-center gap-1.5 text-xs text-red-500">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}
        {formData.passwordConfirm &&
          formData.password === formData.passwordConfirm &&
          !passwordError && (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Passwords match</span>
            </div>
          )}
      </SimpleField>

      <ThemedButton
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        disabled={isLoading}
      >
        {isLoading ? "Sending application..." : "Apply"}
      </ThemedButton>

      <p className="text-center text-xs leading-5 text-slate-500">
        By applying, you agree to the{" "}
        <Link
          href="/terms-of-service"
          className="font-medium text-blue-600 hover:underline"
        >
          Terms of Service
        </Link>{" "}
        and acknowledge the{" "}
        <Link
          href="/privacy-policy"
          className="font-medium text-blue-600 hover:underline"
        >
          Privacy Policy
        </Link>
        .
      </p>

      {message.text && (
        <p
          className={`text-sm ${
            message.type === "error" ? "text-red-600" : "text-green-600"
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}

type UnknownRecord = Record<string, unknown>;

function getNestedValue(record: unknown, paths: string[][]) {
  if (!record || typeof record !== "object") return null;

  for (const path of paths) {
    let current: unknown = record;

    for (const part of path) {
      if (!current || typeof current !== "object" || !(part in current)) {
        current = undefined;
        break;
      }

      current = (current as UnknownRecord)[part];
    }

    if (current !== undefined && current !== null) return current;
  }

  return null;
}

function normalizeInteger(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const numberValue =
    typeof value === "number" ? value : Number(String(value).trim());

  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : null;
}

function normalizeViolations(value: unknown) {
  return Array.isArray(value) ? value.length : normalizeInteger(value);
}
