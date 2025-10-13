"use client";

import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/header";
import Link from "next/link";

export default function ForgotPassword() {
  return (
    <div>
      <Header />
      <div className="flex space-between min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="w-full max-w-md">
          <div className="overflow-hidden rounded-xl bg-white shadow-xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="p-6"
            >
              <div className="mb-6 space-y-2">
                <h2 className="text-2xl font-semibold text-gray-900">
                  Reset Your Password
                </h2>
                <p className="text-gray-600">
                  Enter your email to receive a password reset code
                </p>
              </div>
              <ForgotPasswordForm />
              <div className="mt-6 text-center">
                <p className="text-gray-600">
                  <Link
                    href="/crew"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Back
                  </Link>
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
