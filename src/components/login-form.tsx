"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
    }, 1000)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-gray-700">
            Password
          </Label>
          <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input id="password" type="password" required className="border-blue-200 focus-visible:ring-blue-500" />
      </div>
      <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
        {isLoading ? "Logging in..." : "Sign In"}
      </Button>
    </form>
  )
}

