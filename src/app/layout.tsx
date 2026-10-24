import type React from "react";
import "@/app/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { HalloweenParticles } from "@/components/halloween-particles";
import { NavigationProgress } from "@/components/navigation-progress";

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
            __html: `(function(){try{var s=localStorage.getItem("czvg_theme");var now=new Date();var m=now.getMonth();var d=now.getDate();var isH=(m===9&&d>=24)||(m===10&&d<=5);var t=s||(isH?"halloween":"light");var r=document.documentElement;r.classList.remove("light","dark","theme-halloween");if(t==="halloween"){r.classList.add("theme-halloween");r.setAttribute("data-theme","halloween");}else{r.classList.add(t);r.setAttribute("data-theme",t);}}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>
          <NavigationProgress />
          <HalloweenParticles />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
