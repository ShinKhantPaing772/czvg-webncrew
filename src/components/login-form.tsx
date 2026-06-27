"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ThemedButton from "@/components/system/ThemedButton";
import { Input } from "@/components/ui/input";
import SimpleField from "@/components/system/SimpleField";
import { setToken } from "@/lib/utils/auth";

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: id === "email" ? value.trim().toLowerCase() : value,
    }));
  };

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          ...formData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Login failed");
      }

      // Store token and user data
      if (data.token) {
        setToken(data.token);
      }

      setMessage({ type: "success", text: "Login successful" });
      router.push(data.redirectTo || "/crew/home");
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Login failed",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SimpleField id="email" label="Email Address">
        <Input
          id="email"
          type="email"
          placeholder="pilot@example.com"
          required
          className="border-blue-200 focus-visible:ring-blue-500"
          autoComplete="username"
          value={formData.email}
          onChange={handleChange}
        />
      </SimpleField>

      <SimpleField
        id="password"
        label={
          <div className="flex w-full items-center justify-between">
            <span>Password</span>
            <Link
              href="/crew/forgot-password"
              className="text-sm font-normal text-blue-600 hover:text-blue-800 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        }
      >
        <Input
          id="password"
          type="password"
          required
          className="border-blue-200 focus-visible:ring-blue-500"
          autoComplete="current-password"
          value={formData.password}
          onChange={handleChange}
        />
      </SimpleField>

      <ThemedButton
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
        disabled={isLoading}
      >
        {isLoading ? "Logging in..." : "Sign In"}
      </ThemedButton>

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
