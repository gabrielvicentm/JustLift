import { api } from "@/app/config/api";
import { getAuthHeader } from "@/app/features/profile/service";
import type { DailyItem, DailyMediaPayload, DailySummary } from "./types";

type CreateDailyPayload = {
  midias: DailyMediaPayload[];
};

export async function createDailyBatch(payload: CreateDailyPayload): Promise<DailyItem[]> {
  const headers = await getAuthHeader();
  const response = await api.post<{ dailies: DailyItem[] }>("/daily", payload, { headers });
  return response.data.dailies ?? [];
}

export async function fetchActiveDailiesByUser(userId: string): Promise<DailyItem[]> {
  const headers = await getAuthHeader();
  const response = await api.get<{ dailies: DailyItem[] }>(`/daily/user/${encodeURIComponent(userId)}`, { headers });
  return response.data.dailies ?? [];
}

export async function fetchDailySummaryByUser(userId: string): Promise<DailySummary> {
  const headers = await getAuthHeader();
  const response = await api.get<{ summary: DailySummary }>(`/daily/user/${encodeURIComponent(userId)}/summary`, { headers });
  return (
    response.data.summary ?? {
      total_active: 0,
      unseen_count: 0,
      has_active_daily: false,
      has_unseen_daily: false,
    }
  );
}

export async function toggleDailyLike(dailyId: number): Promise<{ liked: boolean; likes_count: number }> {
  const headers = await getAuthHeader();
  const response = await api.post<{ liked: boolean; likes_count: number }>(`/daily/${dailyId}/like`, {}, { headers });
  return response.data;
}

export async function markDailyViewed(dailyId: number): Promise<{ viewed: boolean }> {
  const headers = await getAuthHeader();
  const response = await api.post<{ viewed: boolean }>(`/daily/${dailyId}/view`, {}, { headers });
  return response.data;
}
