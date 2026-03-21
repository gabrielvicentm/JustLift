import { api } from "@/app/config/api";
import { getAuthHeader } from "@/app/features/profile/service";
import type { NotificationItem } from "./types";

export async function fetchNotifications(limit = 30, offset = 0): Promise<NotificationItem[]> {
  const headers = await getAuthHeader();
  const response = await api.get<{ notifications: NotificationItem[] }>("/notifications", {
    headers,
    params: { limit, offset },
  });
  return response.data.notifications ?? [];
}

export async function markNotificationAsRead(notificationId: number): Promise<void> {
  const headers = await getAuthHeader();
  await api.patch(`/notifications/${notificationId}/read`, {}, { headers });
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const headers = await getAuthHeader();
  await api.patch("/notifications/read-all", {}, { headers });
}

export async function fetchUnreadNotificationsCount(): Promise<number> {
  const headers = await getAuthHeader();
  const response = await api.get<{ unreadCount: number }>("/notifications/unread-count", { headers });
  return Number(response.data.unreadCount || 0);
}

export async function sendTestPush(title?: string, body?: string) {
  const headers = await getAuthHeader();
  const response = await api.post(
    "/notifications/test",
    {
      title: title ?? "Teste Push",
      body: body ?? "Se chegou, esta ok.",
    },
    { headers },
  );
  return response.data;
}
