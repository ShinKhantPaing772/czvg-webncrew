"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Card>;

export function ThemedCard({ className, ...props }: Props) {
  return (
    <Card
      className={cn(
        "bg-white text-[var(--v2-text-text-base,#161616)] border-0 shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export default ThemedCard;
