import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import { useRouter } from "expo-router";
import Svg, { Circle, G } from "react-native-svg";
import { api } from "@/app/config/api";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

type PeriodKey = "7d" | "30d" | "1y" | "all";

type GraficoItem = {
  musculo: string;
  total_series: number;
  percentual: number;
};

type GraficoResponse = {
  periodo: PeriodKey;
  totais: {
    total_series: number;
    total_treinos: number;
    duracao_total_minutos: number;
  };
  distribuicao: GraficoItem[];
};

type Slice = {
  musculo: string;
  totalSeries: number;
  percentual: number;
  color: string;
};

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "7d", label: "7 Dias" },
  { key: "30d", label: "30 Dias" },
  { key: "1y", label: "1 Ano" },
  { key: "all", label: "Tudo" },
];

const CHART_COLORS = ["#4f8cff", "#f7a945", "#48c774", "#ff4d5a", "#a855f7", "#06b6d4", "#f43f5e", "#84cc16"];

function colorByMuscle(muscle: string, index: number) {
  const normalized = muscle.toLowerCase();

  if (normalized.includes("peito")) return "#4f8cff";
  if (normalized.includes("costas")) return "#f7a945";
  if (normalized.includes("bra") || normalized.includes("bice") || normalized.includes("trice")) return "#48c774";
  if (normalized.includes("perna") || normalized.includes("quad") || normalized.includes("glut") || normalized.includes("pant")) return "#ff4d5a";
  if (normalized.includes("abd") || normalized.includes("core")) return "#a855f7";

  return CHART_COLORS[index % CHART_COLORS.length];
}

function getApiErrorMessage(err: unknown) {
  const axiosError = err as AxiosError<{ message?: string } | string>;

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

  return `Erro ${status} ao carregar gráfico.`;
}

function formatDuration(totalMinutes: number) {
  if (totalMinutes <= 0) return "0 min";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}min`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}min`;
}

export default function GraficoVolumeTreinoScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<GraficoResponse | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const token = await AsyncStorage.getItem("accessToken");
        if (!token) {
          throw new Error("NOT_AUTH");
        }

        const response = await api.get<GraficoResponse>("/diario/graficos/volume-treino", {
          params: { period },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!active) return;
        setData(response.data);
      } catch (err) {
        if (!active) return;
        if ((err as Error).message === "NOT_AUTH") {
          setError("Faça login para visualizar o gráfico.");
        } else {
          setError(getApiErrorMessage(err));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load().catch(() => {
      if (active) {
        setLoading(false);
        setError("Erro ao carregar gráfico.");
      }
    });

    return () => {
      active = false;
    };
  }, [period]);

  const slices = useMemo<Slice[]>(() => {
    const items = data?.distribuicao ?? [];
    return items.map((item, index) => ({
      musculo: item.musculo,
      totalSeries: item.total_series,
      percentual: item.percentual,
      color: colorByMuscle(item.musculo, index),
    }));
  }, [data]);

  const totalSeries = data?.totais.total_series ?? 0;
  const totalTreinos = data?.totais.total_treinos ?? 0;
  const duracaoTotalMinutos = data?.totais.duracao_total_minutos ?? 0;

  const chartSize = 260;
  const strokeWidth = 38;
  const radius = (chartSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const segmentGap = 10;
  let accumulatedLength = 0;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable style={styles.backIcon} onPress={() => router.back()}>
          <Text style={styles.backIconText}>{"<"}</Text>
        </Pressable>

        <Text style={styles.title}>Distribuição de Volume</Text>
        <Text style={styles.subtitle}>Volume de séries por grupo muscular.</Text>

        <View style={styles.filtersCard}>
          {PERIODS.map((item) => {
            const selected = period === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.filterButton, selected && styles.filterButtonSelected]}
                onPress={() => setPeriod(item.key)}
                disabled={loading}
              >
                <Text style={[styles.filterButtonText, selected && styles.filterButtonTextSelected]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centeredState}>
            <ActivityIndicator color={theme.colors.text} />
            <Text style={styles.loadingText}>Carregando gráfico...</Text>
          </View>
        ) : null}

        {!loading && error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && !error ? (
          <>
            <View style={styles.chartWrap}>
              <Svg width={chartSize} height={chartSize}>
                <G rotation={-90} origin={`${chartSize / 2}, ${chartSize / 2}`}>
                  <Circle
                    cx={chartSize / 2}
                    cy={chartSize / 2}
                    r={radius}
                    stroke={`${theme.colors.border}80`}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                  />

                  {slices.map((slice, idx) => {
                    const fraction = totalSeries > 0 ? slice.totalSeries / totalSeries : 0;
                    const fullLength = circumference * fraction;
                    const visibleLength = Math.max(fullLength - segmentGap, 0);
                    const dashArray = `${visibleLength} ${circumference}`;
                    const dashOffset = -accumulatedLength;

                    accumulatedLength += fullLength;

                    return (
                      <Circle
                        key={`${slice.musculo}-${idx}`}
                        cx={chartSize / 2}
                        cy={chartSize / 2}
                        r={radius}
                        stroke={slice.color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                        fill="transparent"
                      />
                    );
                  })}
                </G>
              </Svg>

              <View style={styles.chartCenter}>
                <Text style={styles.seriesValue}>{totalSeries}</Text>
                <Text style={styles.seriesLabel}>Séries</Text>
              </View>
            </View>

            {slices.length > 0 ? (
              <View style={styles.legendWrap}>
                {slices.map((slice) => (
                  <View key={slice.musculo} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                    <Text style={styles.legendText}>
                      {slice.musculo} ({slice.percentual.toFixed(1)}%)
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>Sem dados para o período selecionado.</Text>
            )}

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Treinos</Text>
                <Text style={styles.metricValue}>{totalTreinos}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Duração</Text>
                <Text style={styles.metricValue}>{formatDuration(duracaoTotalMinutos)}</Text>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 28,
    },
    backIcon: {
      width: 38,
      height: 38,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 18,
    },
    backIconText: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    title: {
      fontSize: 38,
      fontWeight: "800",
      color: theme.colors.text,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 18,
      color: theme.colors.mutedText,
      marginBottom: 16,
    },
    filtersCard: {
      flexDirection: "row",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 18,
      padding: 6,
      gap: 6,
      marginBottom: 24,
    },
    filterButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    filterButtonSelected: {
      backgroundColor: theme.colors.button,
    },
    filterButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
    filterButtonTextSelected: {
      color: theme.colors.buttonText,
    },
    centeredState: {
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 160,
    },
    loadingText: {
      color: theme.colors.mutedText,
      fontWeight: "600",
    },
    error: {
      color: theme.colors.error,
      backgroundColor: `${theme.colors.error}20`,
      borderRadius: 10,
      padding: 12,
      fontWeight: "600",
    },
    chartWrap: {
      width: 260,
      height: 260,
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
      marginBottom: 22,
    },
    chartCenter: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      width: 120,
      height: 120,
      borderRadius: 999,
      backgroundColor: `${theme.colors.surface}99`,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    seriesValue: {
      fontSize: 42,
      lineHeight: 46,
      fontWeight: "800",
      color: theme.colors.text,
    },
    seriesLabel: {
      marginTop: 2,
      color: theme.colors.mutedText,
      fontSize: 17,
      fontWeight: "700",
    },
    legendWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 12,
      marginBottom: 24,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      minWidth: "45%",
    },
    legendDot: {
      width: 14,
      height: 14,
      borderRadius: 999,
    },
    legendText: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: "600",
    },
    emptyText: {
      textAlign: "center",
      color: theme.colors.mutedText,
      marginBottom: 24,
      fontSize: 16,
      fontWeight: "600",
    },
    metricsRow: {
      flexDirection: "row",
      gap: 12,
    },
    metricCard: {
      flex: 1,
      minHeight: 100,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      justifyContent: "center",
      alignItems: "center",
      padding: 12,
    },
    metricLabel: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.mutedText,
      marginBottom: 8,
    },
    metricValue: {
      fontSize: 24,
      fontWeight: "800",
      color: theme.colors.text,
    },
  });
}
