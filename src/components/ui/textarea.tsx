import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentPropsWithoutRef<"textarea">
>(({ className, onKeyDown, ...props }, ref) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    onKeyDown?.(e);
  };

  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      onKeyDown={handleKeyDown}
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-[6px] border-0 bg-[var(--v2-background-bg-layer-02,#f2f2f2)]/75 px-2.5 py-2 text-[13px] text-[var(--v2-text-text-base,#161616)] placeholder:text-[var(--v2-text-text-faint,#808080)] transition-[background-color,box-shadow] duration-120 outline-none hover:bg-[var(--v2-background-bg-layer-02,#f2f2f2)] focus-visible:bg-[var(--v2-background-bg-layer-02,#f2f2f2)] focus-visible:shadow-[0_0_0_1px_rgba(0,0,0,0.2)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
