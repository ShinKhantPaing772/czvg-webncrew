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
        "flex field-sizing-content min-h-16 w-full rounded-[8px] border-0 bg-[var(--v2-background-bg-layer-02,#eef0f3)] px-2.5 py-2 text-[13px] text-[var(--v2-text-text-base,#171717)] placeholder:text-[var(--v2-text-text-faint,#737373)] transition-[background-color,box-shadow] duration-150 outline-none hover:bg-[var(--v2-background-bg-layer-03,#e4e6ea)] focus-visible:bg-[var(--v2-background-bg-layer-02,#eef0f3)] focus-visible:shadow-[0_0_0_1px_rgba(0,82,165,0.35)] disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
