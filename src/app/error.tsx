"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App Router Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-bold tracking-tight">页面加载遇到问题</h2>
      <p className="mt-2 text-sm text-muted-foreground">{error?.message || "An unexpected error occurred."}</p>
      <div className="mt-6 flex gap-3">
        <Button onClick={() => reset()}>重试</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          返回首页
        </Button>
      </div>
    </div>
  );
}
