import type React from "react";
import "@/app/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { NavigationProgress } from "@/components/navigation-progress";
import { MaintenanceNotice } from "@/components/maintenance-notice";

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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("czvg_theme");var t=s==="dark"?"dark":"light";var r=document.documentElement;r.classList.remove("light","dark","theme-halloween");r.classList.add(t);r.setAttribute("data-theme",t);}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <NavigationProgress />
          <MaintenanceNotice />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
