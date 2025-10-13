import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";

interface OtpInputProps {
  length?: number;
  onChange: (value: string) => void;
}

export function OtpInput({ length = 6, onChange }: OtpInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const focusNext = (index: number) => {
    if (index < length - 1) inputsRef.current[index + 1]?.focus();
  };

  const focusPrev = (index: number) => {
    if (index > 0) inputsRef.current[index - 1]?.focus();
  };

  const handleChange = (index: number, value: string) => {
    // Allow only digits
    if (/[^0-9]/.test(value)) return;

    const newValues = [...values];
    newValues[index] = value.slice(-1); // take last digit
    setValues(newValues);
    onChange(newValues.join(""));

    if (value) focusNext(index);
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !values[index]) {
      focusPrev(index);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const paste = e.clipboardData.getData("text").replace(/\D/g, ""); // digits only
    if (!paste) return;

    const newValues = paste.split("").slice(0, length);
    for (let i = 0; i < length; i++) {
      newValues[i] = newValues[i] || "";
    }

    setValues(newValues);
    onChange(newValues.join(""));

    // focus the last filled input
    const nextIndex = Math.min(paste.length - 1, length - 1);
    inputsRef.current[nextIndex]?.focus();
  };

  return (
    <div className="flex justify-center gap-3">
      {values.map((val, idx) => (
        <Input
          key={idx}
          ref={(el) => {
            inputsRef.current[idx] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={val}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          onPaste={handlePaste}
          className="w-12 h-14 text-center text-xl border border-gray-300 rounded-lg focus-visible:ring-blue-500"
        />
      ))}
    </div>
  );
}
