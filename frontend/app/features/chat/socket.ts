import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, type Socket } from "socket.io-client";
import { api } from "@/app/config/api";

let socketInstance: Socket | null = null;

function getSocketBaseUrl() {
  const baseUrl = String(api.defaults.baseURL || "").trim();
  return baseUrl.replace(/\/api\/?$/, "");
}

export async function getChatSocket() {
  const token = await AsyncStorage.getItem("accessToken");
  if (!token) {
    throw new Error("NOT_AUTHENTICATED");
  }

  if (!socketInstance) {
    socketInstance = io(getSocketBaseUrl(), {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }

  socketInstance.auth = { token };

  if (!socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
}
