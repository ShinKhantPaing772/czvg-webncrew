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
          "flex h-8 w-full min-w-0 rounded-[8px] border-0 bg-[var(--v2-background-bg-layer-02,#eef0f3)] px-2.5 py-1 text-[13px] text-[var(--v2-text-text-base,#171717)] placeholder:text-[var(--v2-text-text-faint,#737373)] transition-[background-color,box-shadow] duration-150 outline-none hover:bg-[var(--v2-background-bg-layer-03,#e4e6ea)] focus-visible:bg-[var(--v2-background-bg-layer-02,#eef0f3)] focus-visible:shadow-[0_0_0_1px_rgba(0,82,165,0.35)] disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
