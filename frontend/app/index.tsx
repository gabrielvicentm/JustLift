import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { useRouter } from "expo-router";
import { api } from "@/app/config/api";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const bootstrapAuth = async () => {
      try {
        const refreshToken = await AsyncStorage.getItem("refreshToken");
        const accessToken = await AsyncStorage.getItem("accessToken");

        if (refreshToken) {
          const response = await api.post("/user/refresh", { refreshToken });

          const newAccess = response.data?.accessToken;
          const newRefresh = response.data?.refreshToken;

          if (newAccess) await AsyncStorage.setItem("accessToken", newAccess);
          if (newRefresh) await AsyncStorage.setItem("refreshToken", newRefresh);

          if (!cancelled) router.replace("/(tabs)/home_tab");
          return;
        }

        if (accessToken) {
          if (!cancelled) router.replace("/(tabs)/home_tab");
          return;
        }

        if (!cancelled) router.replace("/screens/auth/Login");
      } catch {
        await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
        if (!cancelled) router.replace("/screens/auth/Login");
      }
    };

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
