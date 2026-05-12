"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { SignupForm } from "@/components/signup-form";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/layout/header";

export default function Home() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    // If URL query is ?type=signup, switch to signup form
    if (type === "signup") {
      setIsLogin(false);
    } else {
      setIsLogin(true);
    }
  }, [type]);

  return (
    <div>
      <Header />
      <div className="flex space-between min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className=" max-w-5xl px-4 lg:px-0">
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
                      Apply today to be a part of CZVG!{" "}
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
                  <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
                    <div className="order-2 lg:order-1 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <SignupForm />
                    </div>
                    <div className="order-1 lg:order-2 rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700 shadow-sm">
                      <h3 className="mb-4 text-lg font-semibold text-slate-900">
                        Application requirements
                      </h3>
                      <ul className="space-y-3 list-disc pl-5">
                        <li>Must be 13 years of age or older</li>
                        <li>Must be Grade 3 or above</li>
                        <li>
                          Must have an IFC account linked to the Infinite Flight
                          App
                        </li>
                        <li>
                          Must not be on the IFVARB’s user blacklist/watchlist
                        </li>
                        <li>
                          Must have an active Infinite Flight Pro Subscription
                        </li>
                        <li>Be in good standing with the IFC</li>
                        <li>Should be able to participate actively</li>
                        <li>Must be able to use Discord</li>
                      </ul>
                    </div>
                  </div>
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
    </div>
  );
}
