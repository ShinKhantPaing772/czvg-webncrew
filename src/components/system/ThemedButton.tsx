"use client";

import * as React from "react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<typeof Button>;

export function ThemedButton({ className, variant, size, ...props }: Props) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn("shadow-md", className)}
      {...(props as any)}
    />
  );
}

export default ThemedButton;
