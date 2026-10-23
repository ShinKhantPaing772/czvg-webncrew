import type React from "react";
import "@/app/globals.css";
import { PreviewBanner } from "@/components/preview-banner";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata = {
  title: "China Southern Virtual Group IF",
  description:
    "Official website of China Southern Virtual Group - An IFVARB approved virtual airline.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <PreviewBanner />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
