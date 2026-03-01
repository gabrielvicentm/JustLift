import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import { useRouter } from "expo-router";
import Svg, { G, Path, Text as SvgText } from "react-native-svg";
import * as d3Shape from "d3-shape";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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
  color: string;
};

type PieArc = {
  data: Slice;
  value: number;
  index: number;
  startAngle: number;
  endAngle: number;
  padAngle: number;
};

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "7d", label: "7 Dias" },
  { key: "30d", label: "30 Dias" },
  { key: "1y", label: "1 Ano" },
  { key: "all", label: "Tudo" },
];

const CHART_COLORS = ["#8B5CF6", "#22C55E", "#F97316", "#0EA5E9", "#EAB308", "#EC4899", "#EF4444", "#14B8A6"];

function normalizeMuscleLabel(label: string) {
  const normalized = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized.includes("glute")) return "Pernas";
  return label;
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

function formatDuration(totalSeconds: number) {
  if (totalSeconds <= 0) return "0 min";

  const totalMinutes = Math.floor(totalSeconds / 60);

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
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [period, setPeriod] = useState<PeriodKey>("7d");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<GraficoResponse | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [selectedSliceMuscle, setSelectedSliceMuscle] = useState<string | null>(null);

  const handleToggleSliceSelection = (musculo: string) => {
    setSelectedSliceMuscle((prev) => (prev === musculo ? null : musculo));
  };

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
    const grouped = new Map<string, number>();

    items.forEach((item) => {
      const muscleLabel = normalizeMuscleLabel(item.musculo);
      grouped.set(muscleLabel, (grouped.get(muscleLabel) ?? 0) + Number(item.total_series || 0));
    });

    return Array.from(grouped.entries()).map(([musculo, totalSeries], index) => ({
      musculo,
      totalSeries,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }));
  }, [data]);

  const totalSeries = data?.totais.total_series ?? 0;
  const totalTreinos = data?.totais.total_treinos ?? 0;
  const duracaoTotalSegundos = data?.totais.duracao_total_minutos ?? 0;
  const filteredSlices = useMemo(() => slices.filter((slice) => slice.totalSeries > 0), [slices]);
  const totalSeriesForLegend = filteredSlices.reduce((sum, slice) => sum + slice.totalSeries, 0);

  const chartSize = 280;
  const radius = chartSize / 2;
  const center = { x: radius, y: radius };
  const outerRadius = radius * 0.85;
  const innerRadius = radius * 0.52;

  const arcs = useMemo<PieArc[]>(() => {
    const pieGenerator = d3Shape
      .pie()
      .value((slice: Slice) => slice.totalSeries)
      .sort(null);
    return pieGenerator(filteredSlices) as PieArc[];
  }, [filteredSlices]);

  const arcGenerator = useMemo(
    () =>
      d3Shape
        .arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .cornerRadius(8),
    [innerRadius, outerRadius],
  );
  const selectedArcGenerator = useMemo(
    () =>
      d3Shape
        .arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius + 10)
        .cornerRadius(10),
    [innerRadius, outerRadius],
  );

  useEffect(() => {
    setAnimationProgress(0);
    if (filteredSlices.length === 0) {
      setSelectedSliceMuscle(null);
      return;
    }

    if (selectedSliceMuscle && !filteredSlices.some((slice) => slice.musculo === selectedSliceMuscle)) {
      setSelectedSliceMuscle(null);
    }

    const durationMs = 650;
    const start = Date.now();
    let frame = 0;

    const tick = () => {
      const elapsed = Date.now() - start;
      const next = Math.min(elapsed / durationMs, 1);
      const eased = 1 - (1 - next) * (1 - next);
      setAnimationProgress(eased);

      if (next < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [filteredSlices]);

  const selectedArc = useMemo(
    () => arcs.find((arc: PieArc) => arc.data.musculo === selectedSliceMuscle) ?? null,
    [arcs, selectedSliceMuscle],
  );
  const selectedSlice = useMemo(
    () => filteredSlices.find((slice) => slice.musculo === selectedSliceMuscle) ?? null,
    [filteredSlices, selectedSliceMuscle],
  );

  const tooltipData = useMemo(() => {
    if (!selectedArc || totalSeriesForLegend <= 0) return null;

    const [cx, cy] = arcGenerator.centroid(selectedArc as any);
    const percentual = (selectedArc.data.totalSeries / totalSeriesForLegend) * 100;

    return {
      musculo: selectedArc.data.musculo,
      valor: selectedArc.data.totalSeries,
      percentual,
      x: center.x + cx,
      y: center.y + cy - 58,
    };
  }, [arcGenerator, center.x, center.y, selectedArc, totalSeriesForLegend]);

  const contentContainerStyle = useMemo(
    () => ({
      ...styles.container,
      paddingTop: insets.top + 72,
      paddingBottom: Math.max(insets.bottom, 16) + 24,
    }),
    [insets.bottom, insets.top, styles.container],
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <Pressable style={[styles.backIcon, { top: insets.top + 10 }]} onPress={() => router.back()}>
        <Text style={styles.backIconText}>{"←"}</Text>
      </Pressable>

      <ScrollView contentContainerStyle={contentContainerStyle}>

        <Text style={styles.title}>Distribuição de Volume</Text>
        <Text style={styles.subtitle}>Volume de séries por grupo muscular.</Text>
        <Text style={styles.hintText}>Toque em uma fatia ou item da legenda para ver detalhes.</Text>

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
              <Svg width={chartSize} height={chartSize} viewBox={`0 0 ${chartSize} ${chartSize}`}>
                <G x={center.x} y={center.y}>
                  {arcs.map((arc: PieArc, index: number) => {
                    const isSelected = arc.data.musculo === selectedSliceMuscle;
                    const progressArc: PieArc = {
                      ...arc,
                      endAngle: arc.startAngle + (arc.endAngle - arc.startAngle) * animationProgress,
                    };
                    const path = (isSelected ? selectedArcGenerator : arcGenerator)(progressArc);
                    const midAngle = (arc.startAngle + arc.endAngle) / 2;
                    const offset = isSelected ? 7 : 0;
                    const translateX = Math.cos(midAngle - Math.PI / 2) * offset;
                    const translateY = Math.sin(midAngle - Math.PI / 2) * offset;
                    return (
                      <Path
                        key={`${arc.data.musculo}-${index}`}
                        d={path ?? ""}
                        fill={arc.data.color}
                        stroke={theme.colors.background}
                        strokeWidth={3}
                        opacity={isSelected ? 1 : 0.9}
                        transform={`translate(${translateX}, ${translateY})`}
                        onPress={() => handleToggleSliceSelection(arc.data.musculo)}
                      />
                    );
                  })}
                </G>

                <G x={center.x} y={center.y}>
                  <SvgText
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fill={theme.colors.text}
                    fontSize="34"
                    fontWeight="800"
                  >
                    {totalSeries}
                  </SvgText>
                  <SvgText
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    fill={theme.colors.mutedText}
                    fontSize="14"
                    dy="24"
                  >
                    Séries
                  </SvgText>
                </G>
              </Svg>

              {tooltipData ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.tooltip,
                    {
                      left: Math.min(Math.max(tooltipData.x - 68, 12), chartSize - 136),
                      top: Math.min(Math.max(tooltipData.y, 12), chartSize - 74),
                    },
                  ]}
                >
                  <Text style={styles.tooltipTitle}>{tooltipData.musculo}</Text>
                  <Text style={styles.tooltipText}>
                    {tooltipData.valor} séries ({tooltipData.percentual.toFixed(1)}%)
                  </Text>
                </View>
              ) : null}
            </View>

            {filteredSlices.length > 0 ? (
              <View style={styles.legendWrap}>
                {filteredSlices.map((slice) => (
                  <Pressable
                    key={slice.musculo}
                    style={[
                      styles.legendItem,
                      selectedSliceMuscle === slice.musculo && styles.legendItemSelected,
                    ]}
                    onPress={() => handleToggleSliceSelection(slice.musculo)}
                  >
                    <View style={[styles.legendDot, { backgroundColor: slice.color }]} />
                    <Text style={styles.legendText}>
                      {slice.musculo} ({((slice.totalSeries / totalSeriesForLegend) * 100).toFixed(1)}%)
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyText}>Sem dados para o período selecionado.</Text>
            )}

            <View style={styles.detailCard}>
              <Text style={styles.detailTitle}>Detalhes do grupo</Text>
              {selectedSlice ? (
                <>
                  <Text style={styles.detailMain}>{selectedSlice.musculo}</Text>
                  <Text style={styles.detailSub}>
                    {selectedSlice.totalSeries} séries
                    {" • "}
                    {((selectedSlice.totalSeries / totalSeriesForLegend) * 100).toFixed(1)}% do volume
                  </Text>
                  <Pressable style={styles.detailCloseButton} onPress={() => setSelectedSliceMuscle(null)}>
                    <Text style={styles.detailCloseButtonText}>Fechar detalhe</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={styles.detailSub}>Selecione uma fatia para ver os detalhes.</Text>
              )}
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Treinos</Text>
                <Text style={styles.metricValue}>{totalTreinos}</Text>
              </View>

              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Duração</Text>
                <Text style={styles.metricValue}>{formatDuration(duracaoTotalSegundos)}</Text>
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
    },
    backIcon: {
      position: "absolute",
      left: 16,
      zIndex: 20,
      width: 42,
      height: 42,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    backIconText: {
      color: theme.colors.text,
      fontSize: 22,
      lineHeight: 22,
      fontWeight: "800",
      textAlign: "center",
      includeFontPadding: false,
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
      marginBottom: 8,
    },
    hintText: {
      color: theme.colors.mutedText,
      marginBottom: 16,
      fontSize: 13,
      fontWeight: "600",
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
      width: 300,
      height: 300,
      alignSelf: "center",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      marginTop: 6,
      marginBottom: 20,
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 14,
      elevation: 6,
    },
    tooltip: {
      position: "absolute",
      width: 136,
      minHeight: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      paddingHorizontal: 10,
      paddingVertical: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.16,
      shadowRadius: 8,
      elevation: 4,
    },
    tooltipTitle: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "800",
      marginBottom: 2,
    },
    tooltipText: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    legendWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 12,
      marginBottom: 22,
      paddingHorizontal: 6,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: `${theme.colors.surface}CC`,
      borderRadius: 9999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    legendItemSelected: {
      borderColor: theme.colors.button,
      backgroundColor: `${theme.colors.button}1F`,
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 999,
      marginRight: 8,
    },
    legendText: {
      color: theme.colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    emptyText: {
      textAlign: "center",
      color: theme.colors.mutedText,
      marginBottom: 24,
      fontSize: 16,
      fontWeight: "600",
    },
    detailCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 16,
    },
    detailTitle: {
      color: theme.colors.mutedText,
      fontWeight: "700",
      fontSize: 12,
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    detailMain: {
      color: theme.colors.text,
      fontWeight: "800",
      fontSize: 19,
      marginBottom: 4,
    },
    detailSub: {
      color: theme.colors.mutedText,
      fontWeight: "600",
      fontSize: 14,
    },
    detailCloseButton: {
      marginTop: 10,
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    detailCloseButtonText: {
      color: theme.colors.text,
      fontWeight: "700",
      fontSize: 12,
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
