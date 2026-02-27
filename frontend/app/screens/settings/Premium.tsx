import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import { useRouter } from "expo-router";
import { api } from "@/app/config/api";
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
      return "Faça login para testar o premium.";
    }

    if (!axiosError.response) {
      return `Sem conexão com o servidor (${api.defaults.baseURL}).`;
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

  const updatePremium = async (activate: boolean) => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const endpoint = activate ? "/premium/activate" : "/premium/deactivate";
      const response = await api.post<PremiumStatusResponse>(endpoint, {}, { headers });

      setIsPremium(Boolean(response.data.isPremium));
      setUpdatedAt(response.data.premiumUpdatedAt ?? null);
      setMessage(response.data.message ?? (activate ? "Premium ativado." : "Premium desativado."));
    } catch (err) {
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
      <Text style={styles.title}>Premium (Teste)</Text>
      <Text style={styles.subtitle}>Ative ou desative o premium fake para testar funcionalidades.</Text>

      <View style={styles.card}>
        <Text style={styles.statusLabel}>Status atual</Text>
        <Text style={[styles.statusValue, isPremium ? styles.premiumOn : styles.premiumOff]}>
          {isPremium ? "Premium ativo" : "Premium inativo"}
        </Text>
        {updatedAt ? <Text style={styles.updatedAt}>Última atualização: {new Date(updatedAt).toLocaleString()}</Text> : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}

      <Pressable
        style={[styles.primaryButton, loading && styles.buttonDisabled]}
        onPress={() => updatePremium(true)}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color={theme.colors.buttonText} /> : <Text style={styles.primaryButtonText}>Virar Premium</Text>}
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, loading && styles.buttonDisabled]}
        onPress={() => updatePremium(false)}
        disabled={loading}
      >
        <Text style={styles.secondaryButtonText}>Deixar de ser Premium</Text>
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
