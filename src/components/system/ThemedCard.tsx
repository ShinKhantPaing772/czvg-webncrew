"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Card>;

export function ThemedCard({ className, ...props }: Props) {
  return (
    <Card
      className={cn(
        "bg-card text-card-foreground shadow-md border-transparent",
        className,
      )}
      {...props}
    />
  );
}

export default ThemedCard;
