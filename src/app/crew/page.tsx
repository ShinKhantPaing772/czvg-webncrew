"use client";

import { useState } from "react";
import { LoginForm } from "@/components/login-form";
import { SignupForm } from "@/components/signup-form";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-xl bg-white shadow-xl">
          <AnimatePresence mode="wait">
            {isLogin ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="p-6"
              >
                <div className="mb-6 space-y-2">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    Welcome Back
                  </h2>
                  <p className="text-gray-600">
                    Sign in to access your dashboard
                  </p>
                </div>
                <LoginForm />
                <div className="mt-6 text-center">
                  <p className="text-gray-600">
                    Register today to be a part of CZVG:{" "}
                    <button
                      onClick={() => setIsLogin(false)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      Sign Up
                    </button>
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="p-6"
              >
                <div className="mb-6 space-y-2">
                  <h2 className="text-2xl font-semibold text-gray-900">
                    Join CZVG Today!
                  </h2>
                  <p className="text-gray-600">
                    Fill in the application form to get started
                  </p>
                </div>
                <SignupForm />
                <div className="mt-6 text-center">
                  <p className="text-gray-600">
                    Already have an account?{" "}
                    <button
                      onClick={() => setIsLogin(true)}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      Sign in
                    </button>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
