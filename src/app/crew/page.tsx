"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { SignupForm } from "@/components/signup-form";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    if (type === "signup") {
      setIsLogin(false);
    } else {
      setIsLogin(true);
    }
  }, [type]);

  return (
    <div className="min-h-screen bg-[var(--v2-background-bg-deep,#f3f3f3)]">
      <Header />
      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center px-4 py-10">
        <div
          className={cn(
            "my-auto w-full rounded-[16px] bg-[var(--v2-background-bg-base,#ffffff)] p-6 sm:p-8 shadow-[var(--v2-elevation-raised)]",
            isLogin ? "max-w-md" : "max-w-4xl",
          )}
        >
          {isLogin ? (
            <div className="w-full space-y-6">
              <div className="space-y-1">
                <h2 className="text-[28px] font-medium text-[var(--v2-text-text-base,#171717)]">
                  Sign in
                </h2>
                <p className="text-[13px] text-[var(--v2-text-text-muted,#525252)]">
                  Access your CZVG crew dashboard
                </p>
              </div>
              <LoginForm />
              <div className="flex items-center justify-center gap-2 text-center text-[13px] text-[var(--v2-text-text-muted,#525252)]">
                <span>New to CZVG</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsLogin(false)}
                >
                  Apply
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-[28px] font-medium text-[var(--v2-text-text-base,#171717)]">
                  Apply to CZVG
                </h2>
                <p className="text-[13px] text-[var(--v2-text-text-muted,#525252)]">
                  Submit your Infinite Flight application
                </p>
              </div>
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
                <div className="order-2 lg:order-1">
                  <SignupForm />
                </div>
                <aside className="order-1 rounded-[8px] bg-[var(--v2-background-bg-layer-01,#fafafa)] p-5 text-[13px] text-[var(--v2-text-text-muted,#5c5c5c)] lg:order-2">
                  <h3 className="mb-3 text-[13px] font-medium text-[var(--v2-text-text-base,#161616)]">
                    Application requirements
                  </h3>
                  <ul className="space-y-2.5 list-disc pl-4">
                    <li>Must be 13 years of age or older</li>
                    <li>Must be Grade 3 or above</li>
                    <li>
                      Must have an IFC account linked to the Infinite Flight App
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
                </aside>
              </div>
              <div className="flex items-center justify-center gap-2 text-center text-[13px] text-[var(--v2-text-text-muted,#5c5c5c)]">
                <span>Already have an account?</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsLogin(true)}
                >
                  Sign in
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
