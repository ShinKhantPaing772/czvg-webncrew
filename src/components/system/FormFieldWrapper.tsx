"use client";

import * as React from "react";
import {
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";

type Props = {
  label?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
};

export function FormFieldWrapper({ label, description, children }: Props) {
  return (
    <FormItem>
      {label ? <FormLabel>{label}</FormLabel> : null}
      <FormControl>{children}</FormControl>
      {description ? <FormDescription>{description}</FormDescription> : null}
      <FormMessage />
    </FormItem>
  );
}

export default FormFieldWrapper;
