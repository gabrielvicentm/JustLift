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
  reason?: string;
};

export async function registerPushTokenIfPossible(): Promise<PushRegisterResult> {
  if (!Device.isDevice) {
    return { status: "not_device", reason: "not_physical_device" };
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const request = await Notifications.requestPermissionsAsync();
    finalStatus = request.status;
  }

  if (finalStatus !== "granted") {
    return { status: "permission_denied", reason: "permission_not_granted" };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const projectId = getExpoProjectId();
  if (!projectId) {
    return { status: "token_error", reason: "missing_project_id" };
  }
  let tokenResponse: Notifications.ExpoPushToken | null = null;
  try {
    tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  } catch (err: any) {
    return {
      status: "token_error",
      reason: err?.message ? `expo:${err.message}` : "expo_push_token_failed",
    };
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
  } catch (err: any) {
    return {
      status: "backend_error",
      token,
      reason: err?.message ? `backend:${err.message}` : "backend_request_failed",
    };
  }
}
