"use client";

import type React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Loader2, XCircle } from "lucide-react";

export function SignupForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingIFC, setLoadingIFC] = useState(false);
  const [validIFC, setValidIFC] = useState(false);
  const [ifUserId, setIfUserId] = useState("");
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
    setFormData((prev) => ({ ...prev, [id]: value }));
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
        setValidIFC(isValid);
        setIfUserId(isValid ? data.result[0].userId : "");
      } catch (error) {
        setValidIFC(false);
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
        }),
      });

      console.log(ifUserId);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      // No need to store token for signup as it doesn't return one
      // User will need to login after registration

      setMessage({
        type: "success",
        text: data.message || "Registration successful",
      });

      // Redirect to login page after successful registration
      setTimeout(() => {
        window.location.reload;
      }, 6000);
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
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name" className="text-gray-700">
          Full Name
        </Label>
        <Input
          id="name"
          placeholder="John Doe"
          required
          className="border-blue-200 focus-visible:ring-blue-500"
          value={formData.name}
          onChange={handleChange}
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
          autoComplete="username"
          className="border-blue-200 focus-visible:ring-blue-500"
          value={formData.email}
          onChange={handleChange}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ifc" className="text-gray-700">
          Infinite Flight Community Profile URL
        </Label>
        <div className="flex items-center">
          <span className="inline-flex h-10 items-center rounded-l-md border border-r-0 border-blue-200 bg-blue-50 px-3 text-sm text-gray-600">
            https://community.infiniteflight.com/u/
          </span>
          <div className="relative w-full">
            <Input
              id="ifc"
              className="rounded-l-none border-blue-200 focus-visible:ring-blue-500 pr-10"
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
        <p className="text-xs text-gray-600">
          All pilots are required to have an active{" "}
          <Link
            href="https://community.infiniteflight.com"
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
          value={formData.password}
          onChange={handleChange}
          required
          autoComplete="new-password"
          className="border-blue-200 focus-visible:ring-blue-500"
        />
        <div className="flex items-center gap-1 text-xs">
          {formData.password.length >= 8 ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-blue-400" />
          )}
          <span
            className={
              formData.password.length >= 8 ? "text-green-600" : "text-gray-600"
            }
          >
            Must be at least 8 characters long
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="passwordConfirm" className="text-gray-700">
          Confirm Password
        </Label>
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
          <div className="flex items-center gap-1 text-xs text-red-500">
            <AlertCircle className="h-4 w-4" />
            <span>{passwordError}</span>
          </div>
        )}
        {formData.passwordConfirm &&
          formData.password === formData.passwordConfirm &&
          !passwordError && (
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
  );
}
