"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function ForgotPasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [step, setStep] = useState<"email" | "otp" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [formData, setFormData] = useState({
    password: "",
    passwordConfirm: "",
  });
  const [passwordError, setPasswordError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (id === "email") {
      setEmail(value.trim().toLowerCase());
    } else if (id === "otp") {
      setOtp(value.trim());
    } else {
      setFormData((prev) => ({ ...prev, [id]: value }));
    }
  };

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

  async function requestOTP(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request",
          email: email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setMessage({
        type: "success",
        text: data.message || "OTP sent to your email",
      });
      setStep("otp");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to send OTP",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyOTP(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          email: email,
          otp: otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Invalid OTP");
      }

      setMessage({
        type: "success",
        text: data.message || "OTP verified successfully",
      });
      setStep("reset");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Invalid OTP",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!validatePassword()) {
      return;
    }

    setIsLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset",
          email: email,
          otp: otp,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      setMessage({
        type: "success",
        text: data.message || "Password reset successfully",
      });

      // Redirect to login page after successful reset
      setTimeout(() => {
        window.location.href = "/crew";
      }, 2000);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Failed to reset password",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {step === "email" && (
        <form onSubmit={requestOTP} className="space-y-4">
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
              value={email}
              onChange={handleChange}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              "Send Reset Code"
            )}
          </Button>
          {message.text && (
            <div
              className={`mt-2 text-sm ${
                message.type === "error" ? "text-red-600" : "text-green-600"
              }`}
            >
              {message.text}
            </div>
          )}
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={verifyOTP} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp" className="text-gray-700">
              Enter OTP Code
            </Label>
            <Input
              id="otp"
              placeholder="Enter the 6-digit code sent to your email"
              required
              className="border-blue-200 focus-visible:ring-blue-500"
              value={otp}
              onChange={handleChange}
            />
            <p className="text-xs text-gray-600">
              Please check your email for a 6-digit code
            </p>
          </div>
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Code"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setStep("email")}
          >
            Back
          </Button>
          {message.text && (
            <div
              className={`mt-2 text-sm ${
                message.type === "error" ? "text-red-600" : "text-green-600"
              }`}
            >
              {message.text}
            </div>
          )}
        </form>
      )}

      {step === "reset" && (
        <form onSubmit={resetPassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-700">
              New Password
            </Label>
            <Input
              id="password"
              type="password"
              required
              className="border-blue-200 focus-visible:ring-blue-500"
              value={formData.password}
              onChange={handleChange}
            />
            <p className="text-xs text-gray-600">
              Password must be at least 8 characters long
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="passwordConfirm" className="text-gray-700">
              Confirm New Password
            </Label>
            <Input
              id="passwordConfirm"
              type="password"
              required
              className="border-blue-200 focus-visible:ring-blue-500"
              value={formData.passwordConfirm}
              onChange={handleChange}
            />
            {passwordError && (
              <p className="text-xs text-red-600">{passwordError}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset Password"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setStep("otp")}
          >
            Back
          </Button>
          {message.text && (
            <div
              className={`mt-2 text-sm ${
                message.type === "error" ? "text-red-600" : "text-green-600"
              }`}
            >
              {message.text}
            </div>
          )}
        </form>
      )}
    </>
  );
}
