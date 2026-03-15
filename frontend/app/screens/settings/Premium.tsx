import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import { useRouter } from "expo-router";
import Purchases, { LOG_LEVEL, PurchasesPackage } from "react-native-purchases";
import { api } from "@/app/config/api";
import { fetchMyProfile } from "@/app/features/profile/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

type PremiumStatusResponse = {
  isPremium: boolean;
  premiumUpdatedAt?: string | null;
  message?: string;
};

export default function PremiumScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [loading, setLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const productId = useMemo(() => null, []);

  const getAuthHeader = async () => {
    const token = await AsyncStorage.getItem("accessToken");
    if (!token) {
      throw new Error("NOT_AUTHENTICATED");
    }
    return { Authorization: `Bearer ${token}` };
  };

  const getErrorMessage = (err: unknown) => {
    const axiosError = err as AxiosError<{ message?: string } | string>;

    if ((err as Error).message === "NOT_AUTHENTICATED") {
      return "Faca login para testar o premium.";
    }

    if (!axiosError.response) {
      return `Sem conexao com o servidor (${api.defaults.baseURL}).`;
    }

    const { status, data } = axiosError.response;
    if (typeof data === "string" && data.trim().length > 0) {
      return `Erro ${status}: ${data}`;
    }

    if (data && typeof data === "object" && "message" in data && data.message) {
      return String(data.message);
    }

    return `Erro ${status} ao processar premium.`;
  };

  const ensureRevenueCat = useCallback(async () => {
    const iosKey = "test_AmyGfiVBsMOcTimVWsefmSIpecG";
    const androidKey = "goog_hbNibBpVLOEEPcClyHueXOKyllM";
    const apiKey = Platform.OS === "ios" ? iosKey : androidKey;
    if (!apiKey) {
      throw new Error("REVENUECAT_NOT_CONFIGURED");
    }

    const profile = await fetchMyProfile();
    const profileUserId = String(profile.user_id || "").trim();
    if (!profileUserId) {
      throw new Error("USER_NOT_FOUND");
    }

    Purchases.setLogLevel(LOG_LEVEL.INFO);
    Purchases.configure({ apiKey });
    await Purchases.logIn(profileUserId);
  }, []);

  const loadStatus = useCallback(async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const response = await api.get<PremiumStatusResponse>("/premium/status", { headers });
      setIsPremium(Boolean(response.data.isPremium));
      setUpdatedAt(response.data.premiumUpdatedAt ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const syncPremium = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const response = await api.post<PremiumStatusResponse>("/premium/sync", {}, { headers });

      setIsPremium(Boolean(response.data.isPremium));
      setUpdatedAt(response.data.premiumUpdatedAt ?? null);
      setMessage(response.data.message ?? "Premium sincronizado.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const purchasePremium = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await ensureRevenueCat();

      const offerings = await Purchases.getOfferings();
      const current = offerings.current;
      if (!current) {
        throw new Error("NO_OFFERINGS");
      }

      if (!current.availablePackages.length) {
        throw new Error("NO_PACKAGES");
      }

      const matchPackage = productId
        ? current.availablePackages.find(
            (pkg: PurchasesPackage) => pkg.product.identifier === productId
          )
        : undefined;

      const selectedPackage = matchPackage ?? current.availablePackages[0];

      await Purchases.purchasePackage(selectedPackage);
      await syncPremium();
      setMessage("Compra concluida e premium sincronizado.");
    } catch (err) {
      if ((err as Error).message === "REVENUECAT_NOT_CONFIGURED") {
        setError("RevenueCat nao configurado no app.");
        return;
      }

      if ((err as Error).message === "NO_OFFERINGS") {
        setError("Nenhuma oferta encontrada no RevenueCat.");
        return;
      }

      if ((err as Error).message === "NO_PACKAGES") {
        setError("Nenhum pacote disponivel na Offering atual.");
        return;
      }

      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus().catch(() => undefined);
  }, [loadStatus]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Premium</Text>
      <Text style={styles.subtitle}>Assine e sincronize seu status com o RevenueCat.</Text>

      <View style={styles.card}>
        <Text style={styles.statusLabel}>Status atual</Text>
        <Text style={[styles.statusValue, isPremium ? styles.premiumOn : styles.premiumOff]}>
          {isPremium ? "Premium ativo" : "Premium inativo"}
        </Text>
        {updatedAt ? <Text style={styles.updatedAt}>Ultima atualizacao: {new Date(updatedAt).toLocaleString()}</Text> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Pressable
        style={[styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={purchasePremium}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color={theme.colors.buttonText} /> : <Text style={styles.primaryButtonText}>Assinar Premium</Text>}
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, loading && styles.buttonDisabled]}
        onPress={syncPremium}
        disabled={loading}
      >
        <Text style={styles.secondaryButtonText}>Sincronizar Status</Text>
      </Pressable>

      <Pressable style={styles.backButton} onPress={() => router.back()} disabled={loading}>
        <Text style={styles.backButtonText}>Voltar</Text>
      </Pressable>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      padding: 16,
      gap: 12,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.text,
    },
    subtitle: {
      color: theme.colors.mutedText,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      gap: 6,
    },
    statusLabel: {
      color: theme.colors.mutedText,
      fontWeight: "600",
    },
    statusValue: {
      fontSize: 18,
      fontWeight: "700",
    },
    premiumOn: {
      color: theme.colors.success,
    },
    premiumOff: {
      color: theme.colors.error,
    },
    updatedAt: {
      color: theme.colors.mutedText,
      fontSize: 12,
    },
    primaryButton: {
      height: 46,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.button,
    },
    primaryButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "700",
      fontSize: 16,
    },
    secondaryButton: {
      height: 46,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 15,
    },
    backButton: {
      marginTop: 6,
      height: 44,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    backButtonText: {
      color: theme.colors.link,
      fontWeight: "600",
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    error: {
      color: theme.colors.error,
      fontWeight: "600",
    },
    success: {
      color: theme.colors.success,
      fontWeight: "600",
    },
  });
}

