import axios from "axios";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
/* CODIGO DO RICHARD NAO COLOCA A MAO!!!!!!
type RateLimitPayload = {
  message?: string;
  retryAfterSeconds?: number;
  cooldownLevel?: "seconds" | "hours";
};

type RateLimitHandler = (payload: RateLimitPayload) => void;
*/

const devMachineHost = process.env.EXPO_PUBLIC_DEV_MACHINE_IP ?? "192.168.15.86";
const fallbackBaseURL = Platform.select({
  // Dispositivo fisico (Android/iOS) precisa do IP da maquina na rede local.
  android: `http://${devMachineHost}:3000/api`,
  ios: `http://${devMachineHost}:3000/api`,
  default: "http://localhost:3000/api",
});

const baseURL = fallbackBaseURL;

export const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

type RefreshResponse = {
  accessToken?: string;
  refreshToken?: string;
};

type RetryableRequestConfig = {
  _retry?: boolean;
  headers?: Record<string, string>;
  url?: string;
};

let refreshPromise: Promise<string | null> | null = null;

const clearSession = async () => {
  await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
};

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = await AsyncStorage.getItem("refreshToken");
  if (!refreshToken) {
    return null;
  }

  const response = await axios.post<RefreshResponse>(
    `${baseURL}/user/refresh`,
    { refreshToken },
    { timeout: 10000 }
  );

  const newAccessToken = response.data?.accessToken;
  const newRefreshToken = response.data?.refreshToken;

  if (!newAccessToken) {
    return null;
  }

  await AsyncStorage.setItem("accessToken", newAccessToken);
  if (newRefreshToken) {
    await AsyncStorage.setItem("refreshToken", newRefreshToken);
  }

  return newAccessToken;
};

api.interceptors.request.use(async (config) => {
  const hasAuthorizationHeader = Boolean(
    (config.headers as Record<string, string> | undefined)?.Authorization
  );

  if (!hasAuthorizationHeader) {
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (accessToken) {
      config.headers = {
        ...(config.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      };
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalConfig = (error?.config || {}) as RetryableRequestConfig;
    const isRefreshRequest = (originalConfig.url || "").includes("/user/refresh");

    if (status !== 401 || originalConfig._retry || isRefreshRequest) {
      return Promise.reject(error);
    }

    originalConfig._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newAccessToken = await refreshPromise;
      if (!newAccessToken) {
        await clearSession();
        return Promise.reject(error);
      }

      originalConfig.headers = {
        ...(originalConfig.headers || {}),
        Authorization: `Bearer ${newAccessToken}`,
      };

      return api(originalConfig as any);
    } catch (refreshError) {
      await clearSession();
      return Promise.reject(refreshError);
    }
  }
);

/*  CODIGO DO RICHARD NAO COLOCA A MAO!!!!!!
let onRateLimit: RateLimitHandler | null = null;

export function setRateLimitHandler(handler: RateLimitHandler | null) {
  onRateLimit = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 429) {
      const payload: RateLimitPayload = {
        message:
          error.response.data?.message ??
          "Muitas tentativas. Tente novamente em instantes.",
        retryAfterSeconds:
          Number(error.response.data?.retryAfterSeconds) ||
          Number(error.response.headers?.["retry-after"]) ||
          0,
        cooldownLevel: error.response.data?.cooldownLevel,
      };

      onRateLimit?.(payload);
    }

    return Promise.reject(error);
  }
);
*/
