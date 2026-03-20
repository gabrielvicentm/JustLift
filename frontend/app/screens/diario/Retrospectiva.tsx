import { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";
import { api } from "@/app/config/api";
import PremiumAdModal from "@/app/components/PremiumAdModal";

const PERIOD_OPTIONS = [
  { key: "weekly", label: "Semanal" },
  { key: "monthly", label: "Mensal" },
  { key: "yearly", label: "Anual" },
] as const;

type PeriodKey = (typeof PERIOD_OPTIONS)[number]["key"];

type RetrospectivaTreino = {
  treino_id: number;
  data: string;
  duracao: number | null;
  peso_total: number | null;
  total_series: number | null;
  finalizado: boolean | null;
  exercicios: {
    exercicio_treino_id: number;
    nome: string;
    imagem_url: string | null;
    anotacoes: string | null;
    ordem: number | null;
    series: {
      serie_id: number;
      numero: number | null;
      kg: number | null;
      repeticoes: number | null;
      concluido: boolean | null;
    }[];
  }[];
};

type RetrospectivaResponse = {
  period: PeriodKey;
  start_date: string;
  end_date: string;
  summary: {
    total_treinos: number;
    total_series: number;
    total_exercicios: number;
    duracao_total: number;
    peso_total: number;
  };
  treinos: RetrospectivaTreino[];
};

type PremiumStatusResponse = {
  isPremium: boolean;
  premiumUpdatedAt?: string | null;
  message?: string;
};

const PROGRESS_GRADIENT = ["#5BE7FF", "#7C5CFF", "#FF4BD8"] as const;

export default function RetrospectivaScreen() {
  const router = useRouter();
  const language = "pt";
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [period, setPeriod] = useState<PeriodKey>("yearly");
  const [data, setData] = useState<RetrospectivaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [checkingPremium, setCheckingPremium] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const canAccess = useCallback(
    (target: PeriodKey) => target === "yearly" || Boolean(isPremium),
    [isPremium],
  );

  const fetchPremiumStatus = useCallback(async () => {
    if (isPremium !== null || checkingPremium) return;
    setCheckingPremium(true);
    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        setIsPremium(false);
        return;
      }
      const response = await api.get<PremiumStatusResponse>("/premium/status", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setIsPremium(Boolean(response.data?.isPremium));
    } catch {
      setIsPremium(false);
    } finally {
      setCheckingPremium(false);
    }
  }, [checkingPremium, isPremium]);

  const loadRetrospectiva = useCallback(
    async (targetPeriod: PeriodKey) => {
      setLoading(true);
      setError(null);
      try {
        const accessToken = await AsyncStorage.getItem("accessToken");
        if (!accessToken) {
          setError("Faça login para ver a retrospectiva.");
          setData(null);
          return;
        }

        const response = await api.get<RetrospectivaResponse>("/detalhe-treino/retrospectiva", {
          params: { period: targetPeriod, lang: language },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        setData(response.data);
      } catch (err: any) {
        if (err?.response?.status === 403) {
          setShowPremiumModal(true);
          setError("Retrospectiva semanal e mensal é exclusiva para Premium.");
        } else {
          setError("Erro ao carregar retrospectiva.");
        }
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [language],
  );

  useEffect(() => {
    fetchPremiumStatus().catch(() => undefined);
  }, [fetchPremiumStatus]);

  useEffect(() => {
    if (!canAccess(period)) return;
    loadRetrospectiva(period).catch(() => undefined);
  }, [canAccess, loadRetrospectiva, period]);

  const handleSelectPeriod = (target: PeriodKey) => {
    if (!canAccess(target)) {
      setShowPremiumModal(true);
      return;
    }
    setPeriod(target);
  };

  const formatDate = (value: string) => {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("pt-BR");
  };

  const formatDuration = (seconds: number | null) => {
    const safe = Number(seconds || 0);
    const minutes = Math.round(safe / 60);
    return `${minutes} min`;
  };

  const summary = data?.summary;
  const exerciseRanking = useMemo(() => {
    if (!data?.treinos?.length) return [];
    const map = new Map<string, { name: string; count: number; image: string | null }>();
    data.treinos.forEach((treino) => {
      treino.exercicios.forEach((exercicio) => {
        const key = String(exercicio.nome || "").trim() || String(exercicio.exercicio_treino_id);
        const current = map.get(key) ?? { name: exercicio.nome, count: 0, image: exercicio.imagem_url };
        current.count += 1;
        if (!current.image && exercicio.imagem_url) current.image = exercicio.imagem_url;
        map.set(key, current);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [data?.treinos]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={[styles.header, { paddingTop: 16 + insets.top }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Retrospectiva</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((option) => {
          const active = period === option.key;
          const locked = !canAccess(option.key);
          return (
            <Pressable
              key={option.key}
              style={[styles.periodButton, active && styles.periodButtonActive, locked && styles.periodButtonLocked]}
              onPress={() => handleSelectPeriod(option.key)}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>{option.label}</Text>
              {locked ? <Ionicons name="lock-closed" size={14} color="#FDE68A" /> : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}>
        {loading ? (
          <View style={styles.centeredBlock}>
            <ActivityIndicator color={theme.colors.text} />
            <Text style={styles.loadingText}>Carregando retrospectiva...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {summary ? (
          <LinearGradient
            colors={PROGRESS_GRADIENT}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.neonBorder}
          >
            <View style={styles.neonInner}>
              <Text style={styles.sectionTitle}>Resumo</Text>
              <Text style={styles.summaryPeriod}>
                {formatDate(data?.start_date ?? "")} - {formatDate(data?.end_date ?? "")}
              </Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.total_treinos}</Text>
                  <Text style={styles.summaryLabel}>Treinos</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.total_exercicios}</Text>
                  <Text style={styles.summaryLabel}>Exercícios</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{summary.total_series}</Text>
                  <Text style={styles.summaryLabel}>Séries</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{formatDuration(summary.duracao_total)}</Text>
                  <Text style={styles.summaryLabel}>Duração</Text>
                </View>
                <View style={styles.summaryItemWide}>
                  <Text style={styles.summaryValue}>
                    {Number(summary.peso_total || 0).toFixed(1)} kg
                  </Text>
                  <Text style={styles.summaryLabel}>Carga total</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        ) : null}

        {exerciseRanking.length ? (
          <LinearGradient
            colors={PROGRESS_GRADIENT}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.neonBorder}
          >
            <View style={styles.neonInner}>
              <Text style={styles.sectionTitle}>Ranking de Exercícios</Text>
            <View style={styles.rankingList}>
              {exerciseRanking.map((item, index) => (
                <View key={`${item.name}-${index}`} style={styles.rankingRow}>
                    <Text style={styles.rankingPosition}>{index + 1}</Text>
                    {item.image ? <Image source={{ uri: item.image }} style={styles.rankingImage} /> : null}
                    <View style={styles.rankingInfo}>
                      <Text style={styles.rankingName}>{item.name}</Text>
                      <Text style={styles.rankingMeta}>{item.count}x feito</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </LinearGradient>
        ) : null}

        {!loading && !error && data && data.treinos.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={22} color={theme.colors.mutedText} />
            <Text style={styles.emptyText}>Nenhum treino encontrado nesse período.</Text>
          </View>
        ) : null}
      </ScrollView>

      <PremiumAdModal
        visible={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        onUpgrade={() => {
          setShowPremiumModal(false);
          router.push("/screens/settings/Premium");
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#0B0E18",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      gap: 8,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.06)",
    },
    headerSpacer: {
      width: 36,
      height: 36,
    },
    title: {
      flex: 1,
      textAlign: "center",
      fontSize: 20,
      fontWeight: "800",
      color: "#E0E0E0",
    },
    periodRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 10,
    },
    periodButton: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(127, 231, 255, 0.08)",
      borderWidth: 1,
      borderColor: "rgba(127, 231, 255, 0.2)",
      gap: 4,
    },
    periodButtonActive: {
      backgroundColor: "rgba(127, 231, 255, 0.18)",
      borderColor: "#7FE7FF",
    },
    periodButtonLocked: {
      borderColor: "rgba(253, 230, 138, 0.45)",
    },
    periodText: {
      color: "#E0E0E0",
      fontWeight: "600",
      fontSize: 13,
    },
    periodTextActive: {
      color: "#7FE7FF",
    },
    content: {
      padding: 16,
      gap: 16,
    },
    centeredBlock: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 24,
    },
    loadingText: {
      color: theme.colors.text,
      fontSize: 13,
    },
    error: {
      backgroundColor: `${theme.colors.error}20`,
      color: theme.colors.error,
      padding: 12,
      borderRadius: 8,
      fontSize: 13,
      fontWeight: "600",
    },
    neonBorder: {
      borderRadius: 22,
      padding: 2,
      shadowColor: "#FF4BD8",
      shadowOpacity: 0.5,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: 0 },
    },
    neonInner: {
      borderRadius: 20,
      padding: 18,
      backgroundColor: "rgba(11, 14, 24, 0.94)",
      borderWidth: 1,
      borderColor: "rgba(127, 231, 255, 0.22)",
      gap: 14,
      alignItems: "center",
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: "#7FE7FF",
      letterSpacing: 0.4,
      textAlign: "center",
    },
    summaryPeriod: {
      color: "rgba(127, 231, 255, 0.9)",
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
    },
    summaryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
      justifyContent: "center",
    },
    summaryItem: {
      width: "46%",
      paddingVertical: 14,
      paddingHorizontal: 10,
      borderRadius: 14,
      backgroundColor: "rgba(5, 8, 16, 0.75)",
      borderWidth: 1,
      borderColor: "rgba(127, 231, 255, 0.18)",
      gap: 6,
      alignItems: "center",
    },
    summaryItemWide: {
      width: "96%",
      paddingVertical: 16,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: "rgba(5, 8, 16, 0.8)",
      borderWidth: 1,
      borderColor: "rgba(127, 231, 255, 0.22)",
      gap: 6,
      alignItems: "center",
    },
    summaryLabel: {
      fontSize: 12,
      textTransform: "uppercase",
      color: "rgba(127, 231, 255, 0.78)",
      fontWeight: "700",
      letterSpacing: 0.6,
    },
    summaryValue: {
      fontSize: 20,
      fontWeight: "900",
      color: "#E0E0E0",
    },
    rankingList: {
      gap: 12,
      width: "90%",
      alignSelf: "center",
    },
    rankingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: "rgba(5, 8, 16, 0.8)",
      borderWidth: 1,
      borderColor: "rgba(127, 231, 255, 0.22)",
      shadowColor: "#7FE7FF",
      shadowOpacity: 0.35,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    rankingPosition: {
      width: 30,
      textAlign: "center",
      color: "#7FE7FF",
      fontWeight: "800",
      fontSize: 16,
    },
    rankingImage: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
    rankingInfo: {
      flex: 1,
      gap: 2,
    },
    rankingName: {
      color: "#E0E0E0",
      fontWeight: "700",
      fontSize: 17,
    },
    rankingMeta: {
      color: "rgba(127, 231, 255, 0.7)",
      fontSize: 13,
    },
    emptyState: {
      alignItems: "center",
      gap: 8,
      paddingVertical: 32,
    },
    emptyText: {
      color: theme.colors.mutedText,
      fontSize: 13,
      textAlign: "center",
    },
  });
}
