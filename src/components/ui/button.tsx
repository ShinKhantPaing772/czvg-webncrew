import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * China Southern Button System — Benchmarked to Left Sidebar (`h-8 rounded-[6px] px-2.5 text-[13px]`)
 * - Tier 1 (`default`): Primary China Southern Blue (`#0052a5` background, white text, `#003a74` hover)
 * - Tier 2 (`secondary` / `outline`): Soft Aviation Blue surface (`#eef4fb` background, `#003a74` text)
 * - Tier 3 (`ghost` / `link`): Subtle row action (transparent background, `#475569` text, `hover:bg-[#0052a5]/[0.06]`)
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] font-sans text-[13px] font-medium select-none cursor-pointer outline-none transition-colors duration-100 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 shrink-0 [&_svg]:shrink-0 focus-visible:outline-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#0052a5] text-white hover:bg-[#003a74] border-0 shadow-none",
        destructive:
          "bg-[var(--v2-state-bg-danger,#fceceb)] text-[var(--v2-state-fg-danger,#c8102e)] hover:bg-[#f6d5d3] border-0 shadow-none",
        outline:
          "bg-[#eef4fb] text-[#003a74] hover:bg-[#dfeaf8] border-0 shadow-none",
        secondary:
          "bg-[#eef4fb] text-[#003a74] hover:bg-[#dfeaf8] border-0 shadow-none",
        ghost:
          "bg-transparent text-[var(--v2-text-text-muted,#475569)] hover:bg-[#0052a5]/[0.06] hover:text-[#0052a5] border-0 shadow-none",
        link: "bg-transparent text-[#0052a5] hover:text-[#003a74] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-2.5",
        sm: "h-8 px-2.5",
        lg: "h-8 px-3",
        icon: "size-8 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };
