import axios from "axios";
import { Platform } from "react-native";
/* CODIGO DO RICHARD NAO COLOCA A MAO!!!!!!
type RateLimitPayload = {
  message?: string;
  retryAfterSeconds?: number;
  cooldownLevel?: "seconds" | "hours";
};

type RateLimitHandler = (payload: RateLimitPayload) => void;
*/

const devMachineHost = process.env.EXPO_PUBLIC_DEV_MACHINE_IP ?? "192.168.0.11";
const fallbackBaseURL = Platform.select({
  // Dispositivo fisico (Android/iOS) precisa do IP da maquina na rede local.
  android: `http://${devMachineHost}:3000/api`,
  ios: `http://${devMachineHost}:3000/api`,
  default: "http://localhost:3000/api",
});

const baseURL = process.env.EXPO_PUBLIC_API_URL ?? fallbackBaseURL;

export const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

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
