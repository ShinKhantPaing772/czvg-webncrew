"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
};

export function SimpleField({
  id,
  label,
  description,
  error,
  children,
  className,
}: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <Label htmlFor={id} className="text-gray-700">
          {label}
        </Label>
      ) : null}
      <div>{children}</div>
      {description ? (
        <p className="text-xs text-gray-600">{description}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export default SimpleField;
