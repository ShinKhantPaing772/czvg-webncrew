"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Radar } from "lucide-react";

type FeaturedRoute = {
  from: string;
  to: string;
  city: string;
  aircraft: string;
};

type FeaturedRouteRotatorProps = {
  routes: FeaturedRoute[];
};

const visibleRouteCount = 3;
const rotationDelay = 3500;

export function FeaturedRouteRotator({ routes }: FeaturedRouteRotatorProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const routeGroups = Math.max(routes.length, 1);

  const visibleRoutes = useMemo(() => {
    if (routes.length <= visibleRouteCount) {
      return routes;
    }

    return Array.from({ length: visibleRouteCount }, (_, offset) => {
      const routeIndex = (activeIndex + offset) % routes.length;
      return routes[routeIndex];
    });
  }, [activeIndex, routes]);

  useEffect(() => {
    if (routes.length <= visibleRouteCount) {
      return;
    }

    const interval = window.setInterval(() => {
      setActiveIndex((currentIndex) => (currentIndex + 1) % routes.length);
    }, rotationDelay);

    return () => window.clearInterval(interval);
  }, [routes.length]);

  const goToPreviousRoute = () => {
    setActiveIndex((currentIndex) =>
      currentIndex === 0 ? routes.length - 1 : currentIndex - 1,
    );
  };

  const goToNextRoute = () => {
    setActiveIndex((currentIndex) => (currentIndex + 1) % routes.length);
  };

  return (
    <div className="space-y-4">
      <div className="grid min-h-[472px] gap-4 md:min-h-[432px]">
        {visibleRoutes.map((route, index) => (
          <div
            key={`${route.from}-${route.to}`}
            className="site-card p-5 transition duration-500 ease-out"
            style={{
              opacity: 1 - index * 0.08,
              transform: `translateY(${index * 2}px)`,
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-slate-100 px-3 py-2 font-mono text-sm font-bold text-slate-800">
                  {route.from}
                </div>
                <Radar className="h-5 w-5 text-primary" />
                <div className="rounded-md bg-slate-100 px-3 py-2 font-mono text-sm font-bold text-slate-800">
                  {route.to}
                </div>
              </div>
              <span className="site-badge">{route.aircraft}</span>
            </div>
            <p className="mt-4 font-semibold text-slate-950">{route.city}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
