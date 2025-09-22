import type React from "react";
import "@/app/globals.css";
import "react-day-picker/src/style.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata = {
  title: "China Southern Virtual Group IF",
  description:
    "Official website of China Southern Virtual Group - An IFVARB approved virtual airline.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
