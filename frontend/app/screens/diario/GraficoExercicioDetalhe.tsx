import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import * as d3Shape from "d3-shape";
import { api } from "@/app/config/api";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

type Ponto = {
  treino_id: number;
  data: string;
  peso_maximo: number;
};

type EvolucaoResponse = {
  exercicio: {
    source: "api" | "custom";
    exercise_id: string | null;
    custom_exercise_id: number | null;
    nome: string;
  };
  pontos: Ponto[];
  estatisticas: {
    total_treinos: number;
    recorde_kg: number;
    peso_inicial_kg: number;
    peso_final_kg: number;
    variacao_kg: number;
    variacao_percentual: number;
  };
};

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

  return `Erro ${status} ao carregar evolução.`;
}

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

export default function GraficoExercicioDetalheScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    source?: string;
    exercise_id?: string;
    custom_exercise_id?: string;
    nome?: string;
  }>();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<EvolucaoResponse | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  const source = params.source === "custom" ? "custom" : "api";
  const exerciseId = typeof params.exercise_id === "string" ? params.exercise_id : "";
  const customExerciseId = Number(params.custom_exercise_id || 0);
  const exerciseName = typeof params.nome === "string" ? params.nome : "Exercício";

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

        const response = await api.get<EvolucaoResponse>("/diario/graficos/exercicios/evolucao", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            source,
            exercise_id: source === "api" ? exerciseId : undefined,
            custom_exercise_id: source === "custom" ? customExerciseId : undefined,
          },
        });

        if (!active) return;
        const payload = response.data;
        setData(payload);
        setSelectedPointIndex(payload?.pontos?.length ? payload.pontos.length - 1 : null);
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
  }, [customExerciseId, exerciseId, source]);

  const pontos = data?.pontos ?? [];
  const stats = data?.estatisticas;
  const chartWidth = Math.max(Dimensions.get("window").width - 32, 300);
  const chartHeight = 240;
  const padding = { top: 20, right: 16, bottom: 36, left: 42 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const yDomain = useMemo(() => {
    if (pontos.length === 0) {
      return { min: 0, max: 1 };
    }

    const values = pontos.map((p) => Number(p.peso_maximo || 0));
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      return { min: Math.max(0, min - 1), max: max + 1 };
    }
    const gap = (max - min) * 0.15;
    return {
      min: Math.max(0, min - gap),
      max: max + gap,
    };
  }, [pontos]);

  const pointsForSvg = useMemo(() => {
    if (pontos.length === 0) return [] as Array<{ x: number; y: number; data: Ponto }>;

    return pontos.map((point, index) => {
      const x = padding.left + (pontos.length === 1 ? plotWidth / 2 : (index / (pontos.length - 1)) * plotWidth);
      const normalized = (Number(point.peso_maximo || 0) - yDomain.min) / (yDomain.max - yDomain.min || 1);
      const y = padding.top + (1 - normalized) * plotHeight;
      return { x, y, data: point };
    });
  }, [pontos, plotHeight, plotWidth, yDomain.max, yDomain.min]);

  const linePath = useMemo(() => {
    if (pointsForSvg.length === 0) return "";
    const line = d3Shape
      .line()
      .x((d: any) => d.x)
      .y((d: any) => d.y)
      .curve(d3Shape.curveMonotoneX);
    return line(pointsForSvg as any) || "";
  }, [pointsForSvg]);

  const trendUp = (stats?.peso_final_kg ?? 0) >= (stats?.peso_inicial_kg ?? 0);
  const lineColor = trendUp ? "#16A34A" : "#DC2626";
  const selectedPoint = selectedPointIndex !== null ? pointsForSvg[selectedPointIndex] : null;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable style={styles.backIcon} onPress={() => router.back()}>
          <Text style={styles.backIconText}>{"<"}</Text>
        </Pressable>

        <Text style={styles.title}>{data?.exercicio?.nome || exerciseName}</Text>
        <Text style={styles.subtitle}>Peso máximo por treino (evolução).</Text>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={theme.colors.text} />
            <Text style={styles.loadingText}>Carregando gráfico...</Text>
          </View>
        ) : null}

        {!loading && error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && !error ? (
          pontos.length === 0 ? (
            <Text style={styles.emptyText}>Sem séries concluídas para este exercício.</Text>
          ) : (
            <>
              <View style={styles.chartCard}>
                <Svg width={chartWidth} height={chartHeight}>
                  <Line
                    x1={padding.left}
                    y1={padding.top + plotHeight}
                    x2={padding.left + plotWidth}
                    y2={padding.top + plotHeight}
                    stroke={`${theme.colors.border}`}
                    strokeWidth={1}
                  />
                  <Line
                    x1={padding.left}
                    y1={padding.top}
                    x2={padding.left}
                    y2={padding.top + plotHeight}
                    stroke={`${theme.colors.border}`}
                    strokeWidth={1}
                  />

                  <Path d={linePath} stroke={lineColor} strokeWidth={3} fill="none" />

                  {pointsForSvg.map((p, index) => {
                    const isSelected = selectedPointIndex === index;
                    return (
                      <Circle
                        key={`${p.data.treino_id}-${index}`}
                        cx={p.x}
                        cy={p.y}
                        r={isSelected ? 5.5 : 4}
                        fill={isSelected ? lineColor : theme.colors.background}
                        stroke={lineColor}
                        strokeWidth={2}
                        onPress={() => setSelectedPointIndex(index)}
                      />
                    );
                  })}

                  {selectedPoint ? (
                    <>
                      <Line
                        x1={selectedPoint.x}
                        y1={selectedPoint.y}
                        x2={selectedPoint.x}
                        y2={padding.top + plotHeight}
                        stroke={`${lineColor}55`}
                        strokeWidth={1}
                      />
                      <SvgText
                        x={selectedPoint.x}
                        y={selectedPoint.y - 12}
                        fontSize="12"
                        fontWeight="700"
                        fill={theme.colors.text}
                        textAnchor="middle"
                      >
                        {selectedPoint.data.peso_maximo.toFixed(1)}kg
                      </SvgText>
                    </>
                  ) : null}
                </Svg>
              </View>

              {selectedPoint ? (
                <View style={styles.detailCard}>
                  <Text style={styles.detailTitle}>Treino selecionado</Text>
                  <Text style={styles.detailText}>Data: {formatDate(selectedPoint.data.data)}</Text>
                  <Text style={styles.detailText}>
                    Peso máximo: {Number(selectedPoint.data.peso_maximo || 0).toFixed(1)} kg
                  </Text>
                </View>
              ) : null}

              <View style={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Recorde</Text>
                  <Text style={styles.metricValue}>{Number(stats?.recorde_kg || 0).toFixed(1)}kg</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>Variação</Text>
                  <Text style={[styles.metricValue, { color: lineColor }]}>
                    {Number(stats?.variacao_kg || 0).toFixed(1)}kg ({Number(stats?.variacao_percentual || 0).toFixed(1)}%)
                  </Text>
                </View>
              </View>
            </>
          )
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
      fontSize: 30,
      fontWeight: "800",
      color: theme.colors.text,
    },
    subtitle: {
      marginTop: 4,
      marginBottom: 14,
      color: theme.colors.mutedText,
      fontSize: 14,
    },
    centerState: {
      minHeight: 180,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
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
    emptyText: {
      color: theme.colors.mutedText,
      textAlign: "center",
      marginTop: 30,
      fontSize: 14,
      fontWeight: "600",
    },
    chartCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      paddingVertical: 8,
      alignItems: "center",
      marginBottom: 12,
    },
    detailCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
    },
    detailTitle: {
      color: theme.colors.mutedText,
      fontWeight: "700",
      fontSize: 12,
      marginBottom: 4,
    },
    detailText: {
      color: theme.colors.text,
      fontWeight: "600",
      fontSize: 14,
    },
    metricsRow: {
      flexDirection: "row",
      gap: 12,
    },
    metricCard: {
      flex: 1,
      minHeight: 92,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      justifyContent: "center",
      alignItems: "center",
      padding: 12,
    },
    metricLabel: {
      color: theme.colors.mutedText,
      fontWeight: "700",
      fontSize: 13,
      marginBottom: 6,
    },
    metricValue: {
      color: theme.colors.text,
      fontWeight: "800",
      fontSize: 16,
      textAlign: "center",
    },
  });
}
