"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { I18nProvider } from "@/lib/i18n";

export type Theme = "dark" | "light" | "halloween" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  attribute?: string;
};

export type ThemeProviderState = {
  theme: Theme;
  isHalloween: boolean;
  setTheme: (theme: Theme) => void;
  toggleHalloween: () => void;
};

const initialState: ThemeProviderState = {
  theme: "light",
  isHalloween: false,
  setTheme: () => null,
  toggleHalloween: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function isHalloweenSeasonDate(): boolean {
  const now = new Date();
  const m = now.getMonth(); // 9 = Oct, 10 = Nov
  const d = now.getDate();
  return (m === 9 && d >= 24) || (m === 10 && d <= 5);
}

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
    if (saved && (saved === "light" || saved === "dark" || saved === "halloween")) {
      setThemeState(saved);
      return;
    }
    if (isHalloweenSeasonDate()) {
      setThemeState("halloween");
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = window.document.documentElement;
    root.classList.remove("light", "dark", "theme-halloween");

    if (theme === "halloween") {
      root.classList.add("theme-halloween");
      root.setAttribute("data-theme", "halloween");
    } else {
      root.classList.add(theme);
      root.setAttribute("data-theme", theme);
    }

    try {
      localStorage.setItem("czvg_theme", theme);
    } catch {
      // Storage unavailable or quota exceeded
    }
  }, [theme, mounted]);

  const toggleHalloween = () => {
    setThemeState((current) => (current === "halloween" ? "light" : "halloween"));
  };

  const value: ThemeProviderState = {
    theme,
    isHalloween: mounted && theme === "halloween",
    setTheme: (newTheme: Theme) => setThemeState(newTheme),
    toggleHalloween,
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
