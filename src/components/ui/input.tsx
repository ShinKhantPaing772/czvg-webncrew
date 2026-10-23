import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onKeyDown, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) {
        return;
      }
      onKeyDown?.(e);
    };

    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-8 w-full min-w-0 rounded-[6px] border-0 bg-[#eef4fb] px-2.5 py-1 text-[13px] text-[var(--v2-text-text-base,#161616)] placeholder:text-[var(--v2-text-text-faint,#808080)] transition-[background-color,box-shadow] duration-120 outline-none hover:bg-[#dfeaf8] focus-visible:bg-[#eef4fb] focus-visible:shadow-[0_0_0_1px_rgba(0,58,116,0.25)] disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
