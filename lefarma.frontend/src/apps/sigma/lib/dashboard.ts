import { get } from "@/apps/sigma/lib/httpClient";

export interface DashboardStatistics {
  documentsPendingAuthorization: number;
  documentsAuthorized: number;
  averageDocumentsPerDay: number;
}

export interface UserStatistics {
  samAccountName: string;
  userName: string;
  authorizedThisMonth: number;
  pendingThisMonth: number;
  rejectedThisMonth: number;
}

export interface DashboardActivityPoint {
  date: string;
  uploaded: number;
  authorized: number;
  rejected: number;
}

export interface DashboardUserContext {
  displayName: string;
  samAccountName: string;
  canViewAll: boolean;
}

export interface DashboardData {
  user: DashboardUserContext;
  statistics: DashboardStatistics;
  userStats: UserStatistics[];
  activitySeries: DashboardActivityPoint[];
}

interface RawDashboardResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Fetch dashboard statistics from the API (mismo endpoint del backend que en SIGMA).
 */
export async function fetchDashboardData(): Promise<DashboardData> {
  const result = await get<RawDashboardResponse>("/documentos/dashboard");

  if (!result.success || !result.data) {
    throw new Error(result.error || "Error al cargar datos del dashboard");
  }

  const asRecord = (value: unknown): Record<string, unknown> =>
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const asArray = (value: unknown): unknown[] =>
    Array.isArray(value) ? value : [];

  const raw = asRecord(result.data);

  const rawUser = asRecord(raw.user ?? raw.User);
  const rawStatistics = asRecord(raw.statistics ?? raw.Statistics);
  const rawUserStats = asArray(raw.userStats ?? raw.UserStats);
  const rawActivitySeries = asArray(raw.activitySeries ?? raw.ActivitySeries);

  const data: DashboardData = {
    user: {
      displayName: String(rawUser.displayName ?? rawUser.DisplayName ?? ""),
      samAccountName: String(
        rawUser.samAccountName ?? rawUser.SamAccountName ?? ""
      ),
      canViewAll: (rawUser.canViewAll ?? rawUser.CanViewAll ?? false) === true,
    },
    statistics: {
      documentsPendingAuthorization: Number(
        rawStatistics.documentsPendingAuthorization ??
          rawStatistics.DocumentsPendingAuthorization ??
          0
      ),
      documentsAuthorized: Number(
        rawStatistics.documentsAuthorized ??
          rawStatistics.DocumentsAuthorized ??
          0
      ),
      averageDocumentsPerDay: Number(
        rawStatistics.averageDocumentsPerDay ??
          rawStatistics.AverageDocumentsPerDay ??
          0
      ),
    },
    userStats: rawUserStats.map((item) => {
      const row = asRecord(item);
      return {
        samAccountName: String(row.samAccountName ?? row.SamAccountName ?? ""),
        userName: String(row.userName ?? row.UserName ?? ""),
        authorizedThisMonth: Number(
          row.authorizedThisMonth ?? row.AuthorizedThisMonth ?? 0
        ),
        pendingThisMonth: Number(
          row.pendingThisMonth ?? row.PendingThisMonth ?? 0
        ),
        rejectedThisMonth: Number(
          row.rejectedThisMonth ?? row.RejectedThisMonth ?? 0
        ),
      };
    }),
    activitySeries: rawActivitySeries
      .map((item) => {
        const row = asRecord(item);
        return {
          date: String(row.date ?? row.Date ?? ""),
          uploaded: Number(row.uploaded ?? row.Uploaded ?? 0),
          authorized: Number(row.authorized ?? row.Authorized ?? 0),
          rejected: Number(row.rejected ?? row.Rejected ?? 0),
        };
      })
      .filter((item) => Boolean(item.date)),
  };

  return data;
}
