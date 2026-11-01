"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { I18nProvider } from "@/lib/i18n";

export type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  attribute?: string;
};

export type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "light",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "light",
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("czvg_theme") as Theme | null;
    if (saved && (saved === "light" || saved === "dark")) {
      setThemeState(saved);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = window.document.documentElement;
    root.classList.remove("light", "dark", "theme-halloween");
    root.classList.add(theme);
    root.setAttribute("data-theme", theme);

    try {
      localStorage.setItem("czvg_theme", theme);
    } catch {
      // Storage unavailable or quota exceeded
    }

    // Broadcast theme to child iframes (such as the embedded live radar map)
    try {
      document.querySelectorAll("iframe").forEach((frame) => {
        frame.contentWindow?.postMessage({ type: "czvg:theme", theme }, "*");
      });
    } catch {
      // Ignore cross-origin errors
    }
  }, [theme, mounted]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "czvg:ready") {
        document.querySelectorAll("iframe").forEach((frame) => {
          frame.contentWindow?.postMessage({ type: "czvg:theme", theme }, "*");
        });
      } else if (
        event.data?.type === "czvg:theme" &&
        (event.data.theme === "light" || event.data.theme === "dark")
      ) {
        setThemeState(event.data.theme);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [theme]);

  const value: ThemeProviderState = {
    theme,
    setTheme: (newTheme: Theme) => setThemeState(newTheme),
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      <I18nProvider>{children}</I18nProvider>
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
