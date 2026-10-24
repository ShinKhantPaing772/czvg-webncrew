import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h2 className="text-4xl font-bold tracking-tight">404</h2>
      <p className="mt-2 text-base text-muted-foreground">页面未找到 (Page Not Found)</p>
      <div className="mt-6">
        <Link href="/">
          <Button>返回首页</Button>
        </Link>
      </div>
    </div>
  );
}
