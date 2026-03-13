import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { api } from "@/app/config/api";
import { getAuthHeader } from "@/app/features/profile/service";

function getExpoProjectId() {
  const fromExpo = Constants.expoConfig?.extra?.eas?.projectId;
  const fromEas = Constants.easConfig?.projectId;
  return fromExpo || fromEas || undefined;
}

export type PushRegisterStatus =
  | "ok"
  | "not_device"
  | "permission_denied"
  | "token_error"
  | "backend_error";

export type PushRegisterResult = {
  status: PushRegisterStatus;
  token?: string;
};

export async function registerPushTokenIfPossible(): Promise<PushRegisterResult> {
  if (!Device.isDevice) {
    return { status: "not_device" };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status;
  }

  if (finalStatus !== "granted") {
    return { status: "permission_denied" };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const projectId = getExpoProjectId();
  let tokenResponse: Notifications.ExpoPushToken | null = null;
  try {
    tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  } catch {
    return { status: "token_error" };
  }

  const token = tokenResponse.data;
  const headers = await getAuthHeader();

  try {
    await api.post(
      "/notifications/push-token",
      {
        token,
        platform: Platform.OS,
        deviceId: Device.modelId ?? null,
      },
      { headers },
    );
    return { status: "ok", token };
  } catch {
    return { status: "backend_error", token };
  }
}
