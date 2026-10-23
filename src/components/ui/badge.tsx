import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[5px] border-0 px-1.5 py-0.5 text-[11px] font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors select-none",
  {
    variants: {
      variant: {
        default:
          "bg-[#e3effd] text-[#0052a5]",
        secondary:
          "bg-[#f1f5f9] text-[#475569]",
        destructive:
          "bg-[var(--v2-state-bg-danger,#fceceb)] text-[var(--v2-state-fg-danger,#c8102e)]",
        outline:
          "bg-[#eef4fb] text-[#003a74]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
