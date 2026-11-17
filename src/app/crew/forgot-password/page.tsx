"use client";

import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { Header } from "@/components/layout/header";

export default function ForgotPassword() {
  return (
    <div className="min-h-screen bg-[var(--v2-background-bg-deep,#f3f4f6)]">
      <Header />
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center px-4 py-10">
        <div className="my-auto w-full max-w-md rounded-[16px] bg-[var(--v2-background-bg-base,#ffffff)] p-6 shadow-[var(--v2-elevation-raised)] sm:p-8">
          <div className="mb-6 space-y-1">
            <h2 className="text-[28px] font-medium text-[var(--v2-text-text-base,#171717)]">
              Reset password
            </h2>
            <p className="text-[13px] text-[var(--v2-text-text-muted,#525252)]">
              Enter the email on your CZVG account
            </p>
          </div>
          <ForgotPasswordForm />
        </div>
      </div>
    </div>
  );
}
