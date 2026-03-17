import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import { useRouter } from "expo-router";
import Purchases, { LOG_LEVEL, PurchasesPackage } from "react-native-purchases";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/app/config/api";
import { fetchMyProfile } from "@/app/features/profile/service";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

type PremiumStatusResponse = {
  isPremium: boolean;
  premiumUpdatedAt?: string | null;
  message?: string;
};

const GOLD_BORDER = ["#FDE68A", "#F8C84A", "#B45309"] as const;
const GOLD_GLOW = ["rgba(253, 230, 138, 0.45)", "rgba(245, 158, 11, 0.15)", "transparent"] as const;
const DARK_PANEL = ["#120804", "#1B0C03", "#090401"] as const;
const NOISE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAJ0lEQVR4Ae3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAA4G8G9o0AAaI31xkAAAAASUVORK5CYII=";
const BENEFITS = [
  "Sem anúncios",
  "Banners exclusivos",
  "Mudar a cor do seu perfil",
  "Exercícios personalizados ilimitados",
  "Treinos ilimitados (grátis: 3x por semana)",
  "Boost de pontos 2x",
  "Retrospectiva semanal, mensal e anual",
];

export default function PremiumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const ctaPulse = useRef(new Animated.Value(1)).current;
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

  const toggleFakePremium = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const headers = await getAuthHeader();
      const response = await api.post<PremiumStatusResponse>(
        "/premium/fake",
        { enabled: !isPremium },
        { headers },
      );
      setIsPremium(Boolean(response.data.isPremium));
      setUpdatedAt(response.data.premiumUpdatedAt ?? null);
      setMessage(response.data.message ?? "Status atualizado.");
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

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaPulse, {
          toValue: 1.03,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(ctaPulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [ctaPulse]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Image source={{ uri: NOISE_DATA_URI }} style={styles.noiseOverlay} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={GOLD_BORDER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroBorder}>
          <View style={styles.heroCard}>
            <LinearGradient colors={GOLD_GLOW} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.glow} />

            <Text style={styles.kicker}>PREMIUM</Text>
            <Text style={styles.title}>Viva o auge dos seus treinos</Text>
            <Text style={styles.subtitle}>O pacote completo para evoluir mais rápido.</Text>

            <View style={styles.priceRow}>
              <Text style={styles.price}>R$ 12,89</Text>
              <Text style={styles.priceSuffix}>/mês</Text>
            </View>
            <Text style={styles.priceNote}>Plano mensal único • Cancele quando quiser</Text>
          </View>
        </LinearGradient>

        <LinearGradient colors={GOLD_BORDER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.benefitsBorder}>
          <LinearGradient colors={DARK_PANEL} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.benefitsCard}>
            <Text style={styles.sectionTitle}>Benefícios Premium</Text>
            <View style={styles.benefitsList}>
              {BENEFITS.map((benefit) => (
                <LinearGradient
                  key={benefit}
                  colors={GOLD_BORDER}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.benefitBorder}
                >
                  <View style={styles.benefitRow}>
                    <View style={styles.benefitIconWrap}>
                      <Ionicons name="sparkles" size={16} color="#1B0C03" />
                    </View>
                    <Text style={styles.benefitText}>{benefit}</Text>
                  </View>
                </LinearGradient>
              ))}
            </View>
          </LinearGradient>
        </LinearGradient>

        <LinearGradient colors={GOLD_BORDER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statusBorder}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Status atual</Text>
            <Text style={[styles.statusValue, isPremium ? styles.premiumOn : styles.premiumOff]}>
              {isPremium ? "Premium ativo" : "Premium inativo"}
            </Text>
            {updatedAt ? (
              <Text style={styles.updatedAt}>Ultima atualizacao: {new Date(updatedAt).toLocaleString()}</Text>
            ) : null}
          </View>
        </LinearGradient>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}

        <Animated.View style={[styles.ctaPulse, { transform: [{ scale: ctaPulse }] }]}>
          <LinearGradient colors={GOLD_BORDER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaBorder}>
            <Pressable
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={purchasePremium}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#0B0B0B" />
              ) : (
                <Text style={styles.primaryButtonText}>Assinar Premium</Text>
              )}
            </Pressable>
          </LinearGradient>
        </Animated.View>

        <Pressable
          style={[styles.secondaryButton, loading && styles.buttonDisabled]}
          onPress={syncPremium}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Sincronizar Status</Text>
        </Pressable>

        <Pressable
          style={[styles.ghostButton, loading && styles.buttonDisabled]}
          onPress={toggleFakePremium}
          disabled={loading}
        >
          <Text style={styles.ghostButtonText}>
            {isPremium ? "Desativar premium falso" : "Virar premium falso"}
          </Text>
        </Pressable>

        <Pressable style={styles.backButton} onPress={() => router.back()} disabled={loading}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#070506",
    },
    noiseOverlay: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.06,
      pointerEvents: "none",
    },
    scrollContent: {
      padding: 16,
      gap: 16,
      paddingBottom: 32,
    },
    heroBorder: {
      borderRadius: 24,
      padding: 2,
      shadowColor: "#FDE68A",
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    heroCard: {
      borderRadius: 22,
      padding: 20,
      overflow: "hidden",
      backgroundColor: "#120804",
    },
    glow: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.85,
    },
    kicker: {
      color: "#FDE68A",
      letterSpacing: 3,
      fontWeight: "800",
      fontSize: 12,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: "#FFF7E0",
      marginTop: 8,
    },
    subtitle: {
      color: "#F8D37A",
      fontSize: 15,
      fontWeight: "600",
      marginTop: 4,
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 6,
      marginTop: 16,
    },
    price: {
      color: "#FDE68A",
      fontSize: 36,
      fontWeight: "800",
    },
    priceSuffix: {
      color: "#FDE68A",
      fontSize: 16,
      fontWeight: "700",
      marginBottom: 6,
    },
    priceNote: {
      color: "rgba(253, 230, 138, 0.75)",
      fontSize: 12,
      marginTop: 4,
    },
    benefitsBorder: {
      borderRadius: 20,
      padding: 1.5,
    },
    benefitsCard: {
      borderRadius: 18,
      padding: 16,
      gap: 12,
    },
    sectionTitle: {
      color: "#FDE68A",
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 1,
    },
    benefitsList: {
      gap: 10,
    },
    benefitBorder: {
      borderRadius: 14,
      padding: 1.2,
      shadowColor: "#FDE68A",
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    benefitRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: "rgba(18, 8, 4, 0.95)",
    },
    benefitIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: "#FDE68A",
      alignItems: "center",
      justifyContent: "center",
    },
    benefitText: {
      color: "#FFF7E0",
      fontSize: 15,
      fontWeight: "700",
      flex: 1,
    },
    statusBorder: {
      borderRadius: 16,
      padding: 1.5,
    },
    statusCard: {
      borderRadius: 14,
      padding: 14,
      backgroundColor: "rgba(18, 8, 4, 0.95)",
      borderWidth: 1,
      borderColor: "rgba(253, 230, 138, 0.25)",
      gap: 6,
    },
    statusLabel: {
      color: "rgba(253, 230, 138, 0.75)",
      fontWeight: "700",
      fontSize: 12,
    },
    statusValue: {
      fontSize: 18,
      fontWeight: "800",
      color: "#FFF7E0",
    },
    premiumOn: {
      color: "#34d399",
    },
    premiumOff: {
      color: "#f87171",
    },
    updatedAt: {
      color: "rgba(253, 230, 138, 0.65)",
      fontSize: 12,
    },
    ctaBorder: {
      borderRadius: 16,
      padding: 1.5,
      shadowColor: "#FDE68A",
      shadowOpacity: 0.5,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
      marginTop: 4,
    },
    ctaPulse: {
      shadowColor: "#FDE68A",
      shadowOpacity: 0.4,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 10,
    },
    primaryButton: {
      height: 52,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FDE68A",
    },
    primaryButtonText: {
      color: "#120804",
      fontWeight: "700",
      fontSize: 16,
    },
    secondaryButton: {
      height: 48,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(253, 230, 138, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(253, 230, 138, 0.25)",
    },
    secondaryButtonText: {
      color: "#FDE68A",
      fontWeight: "700",
      fontSize: 15,
    },
    ghostButton: {
      height: 48,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(127, 231, 255, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(127, 231, 255, 0.28)",
    },
    ghostButtonText: {
      color: "#7FE7FF",
      fontWeight: "700",
      fontSize: 15,
    },
    backButton: {
      marginTop: 6,
      height: 42,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    backButtonText: {
      color: "rgba(253, 230, 138, 0.7)",
      fontWeight: "600",
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    error: {
      color: "#f87171",
      fontWeight: "600",
      textAlign: "center",
    },
    success: {
      color: "#34d399",
      fontWeight: "600",
      textAlign: "center",
    },
  });
}
