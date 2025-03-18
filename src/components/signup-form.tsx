"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");

  function validatePassword() {
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return false;
    }

    if (password !== passwordConfirm) {
      setPasswordError("Passwords do not match");
      return false;
    }

    setPasswordError("");
    return true;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validatePassword()) {
      return;
    }

    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fullName" className="text-gray-700">
          Full Name
        </Label>
        <Input
          id="fullName"
          placeholder="John Doe"
          required
          className="border-blue-200 focus-visible:ring-blue-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-gray-700">
          Email Address
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="pilot@example.com"
          required
          className="border-blue-200 focus-visible:ring-blue-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profileUrl" className="text-gray-700">
          Infinite Flight Community Profile URL
        </Label>
        <div className="flex items-center">
          <span className="inline-flex h-10 items-center rounded-l-md border border-r-0 border-blue-200 bg-blue-50 px-3 text-sm text-gray-600">
            https://community.infinitefllight.com/u/
          </span>
          <Input
            id="profileUrl"
            className="rounded-l-none border-blue-200 focus-visible:ring-blue-500"
            placeholder="username"
            required
          />
        </div>
        <p className="text-xs text-gray-600">
          All pilots are required to have an active{" "}
          <Link
            href="https://community.infinitefllight.com"
            className="font-medium text-blue-600 hover:underline"
          >
            Infinite Flight Community
          </Link>{" "}
          Account
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-gray-700">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="border-blue-200 focus-visible:ring-blue-500"
        />
        <div className="flex items-center gap-1 text-xs">
          {password.length >= 8 ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-blue-400" />
          )}
          <span
            className={
              password.length >= 8 ? "text-green-600" : "text-gray-600"
            }
          >
            Must be at least 8 characters long
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="passwordConfirm" className="text-gray-700">
          Password Again
        </Label>
        <Input
          id="passwordConfirm"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          required
          className="border-blue-200 focus-visible:ring-blue-500"
        />
        {passwordError && (
          <div className="flex items-center gap-1 text-xs text-red-500">
            <AlertCircle className="h-4 w-4" />
            <span>{passwordError}</span>
          </div>
        )}
        {passwordConfirm && password === passwordConfirm && !passwordError && (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            <span>Passwords match</span>
          </div>
        )}
      </div>

      <Button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        disabled={isLoading}
      >
        {isLoading ? "Sending application..." : "Apply"}
      </Button>
    </form>
  );
}
