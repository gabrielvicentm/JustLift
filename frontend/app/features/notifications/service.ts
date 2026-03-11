import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { api } from "@/app/config/api";

export type NotificationItem = {
  id: number;
  recipient_id: string;
  actor_id: string | null;
  actor_username?: string | null;
  actor_nome_exibicao?: string | null;
  actor_foto_perfil?: string | null;
  type: string;
  data: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export async function registerAndSyncPushToken(): Promise<boolean> {
  if (Platform.OS === "web") {
    console.log("[notifications] web platform, skipping");
    return false;
  }

  const accessToken = await AsyncStorage.getItem("accessToken");
  if (!accessToken) {
    console.log("[notifications] no access token, skipping");
    return false;
  }

  console.log("[notifications] requesting permissions");
  const currentPermissions = await Notifications.getPermissionsAsync();
  let status = currentPermissions.status;
  console.log("[notifications] current permission", status);

  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
    console.log("[notifications] requested permission", status);
  }

  if (status !== "granted") {
    console.log("[notifications] permission not granted");
    return false;
  }

  console.log("[notifications] generating expo token");
  let token: string | null = null;
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId ||
      undefined;
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    token = tokenResponse?.data ?? null;
  } catch (err) {
    console.log("[notifications] token error", err);
  }
  console.log("[notifications] token result", token ? "ok" : "empty");
  if (!token) {
    console.log("[notifications] token not generated");
    return false;
  }

  console.log("[notifications] expoPushToken", token);
  console.log("[notifications] posting token to backend", api.defaults.baseURL);

  try {
    const response = await api.post(
      "/notifications/push-token",
      {
        expoPushToken: token,
        platform: Platform.OS,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    console.log("[notifications] backend response", response.status);
  } catch (err) {
    console.log("[notifications] failed to save token", err);
    return false;
  }

  return true;
}

export async function fetchNotifications(limit = 20, offset = 0) {
  const response = await api.get<NotificationItem[]>("/notifications", {
    params: { limit, offset },
  });
  return response.data ?? [];
}

export async function fetchUnreadNotificationsCount() {
  const response = await api.get<{ unreadCount: number }>("/notifications/unread-count");
  return response.data?.unreadCount ?? 0;
}

export async function markNotificationAsRead(notificationId: number) {
  await api.patch(`/notifications/${notificationId}/read`);
}
