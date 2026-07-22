import { format } from "date-fns";

export type CountPoint = {
  label: string;
  value: number;
};

export type TrendPoint = {
  label: string;
  flights?: number;
  hours?: number;
  pilots?: number;
};

export type AnalyticsResponse = {
  success: boolean;
  message?: string;
  permissions: string[];
  range: {
    startDate: string;
    endDate: string;
  };
  sections: {
    overview?: {
      totalPilots: number;
      totalFlights: number;
      pendingPireps: number;
      totalHours: number;
      totalRoutes: number;
      activeAircraft: number;
      liveMapUrl: string;
      range: {
        approvedPireps: number;
        flightHours: number;
        newPilots: number;
      };
    };
    pireps?: {
      statusCounts: {
        pending: number;
        approved: number;
        rejected: number;
      };
      trends: TrendPoint[];
      topDepartures: CountPoint[];
      topArrivals: CountPoint[];
    };
    users?: {
      pilotStatusCounts: {
        applicants: number;
        active: number;
        rejected: number;
        suspended: number;
      };
      applicationPipeline: CountPoint[];
      growth: TrendPoint[];
      activity: {
        recentlyActive: number;
        inactive: number;
      };
    };
    routes?: {
      totalRoutes: number;
      topDepartures: CountPoint[];
      topArrivals: CountPoint[];
      durationBuckets: CountPoint[];
    };
    aircrafts?: {
      activeAircraft: number;
      liveryBreakdown: CountPoint[];
      usage: CountPoint[];
    };
    permissions?: {
      adminCount: number;
      distribution: CountPoint[];
    };
  };
};

export type DateRange = {
  from: Date;
  to: Date;
};

export function toDateInput(value: Date) {
  return format(value, "yyyy-MM-dd");
}

export function presetRange(days: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from, to };
}

export function thisYearRange(): DateRange {
  const to = new Date();
  return { from: new Date(to.getFullYear(), 0, 1), to };
}

export function hasClientPermission(
  userPermissions: Array<{ name: string }> | undefined,
  permission: string,
) {
  const permissions = userPermissions?.map((item) => item.name) ?? [];
  return permissions.includes("admin") || permissions.includes(permission);
}

export function statusChartData(statusCounts: Record<string, number>) {
  return Object.entries(statusCounts).map(([label, value]) => ({
    label: label.charAt(0).toUpperCase() + label.slice(1),
    value,
  }));
}
