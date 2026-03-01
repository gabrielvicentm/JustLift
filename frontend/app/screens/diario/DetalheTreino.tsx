import { useCallback, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "@/app/config/api";
import { useI18n } from "@/providers/I18nProvider";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

type Serie = {
  serie_id: number;
  numero: number;
  kg: number;
  repeticoes: number;
  concluido: boolean;
};

type ExercicioTreino = {
  exercicio_treino_id: number;
  source: "api" | "custom";
  exercise_id: string | null;
  custom_exercise_id: number | null;
  nome: string;
  imagem_url: string | null;
  anotacoes: string | null;
  ordem: number;
  series: Serie[];
};

type Treino = {
  treino_id: number;
  data: string;
  duracao: number | null;
  peso_total: number | null;
  total_series: number | null;
  finalizado: boolean;
  exercicios: ExercicioTreino[];
};

type DetalheTreinoResponse = {
  data: string;
  treinos: Treino[];
};

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

function formatDuration(totalSeconds: number | null) {
  if (!totalSeconds || totalSeconds <= 0) return "0min";
  const totalMinutes = Math.floor(totalSeconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

export default function DetalheTreinoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ data?: string }>();
  const { theme } = useAppTheme();
  const { language } = useI18n();
  const isEn = language === "en";
  const styles = useMemo(() => createStyles(theme), [theme]);

  const data = typeof params.data === "string" ? params.data : "";
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregarDetalhe = useCallback(async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      setError(isEn ? "Invalid workout date." : "Data do treino inválida.");
      setTreinos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const accessToken = await AsyncStorage.getItem("accessToken");
      if (!accessToken) {
        setError(isEn ? "Sign in to view workout details." : "Faça login para ver os detalhes.");
        setTreinos([]);
        return;
      }

      const response = await api.get<DetalheTreinoResponse>("/detalhe-treino/detalhe", {
        params: {
          data,
          lang: language,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      setTreinos(response.data?.treinos ?? []);
    } catch (err) {
      console.error("Erro ao carregar detalhe de treino:", err);
      setTreinos([]);
      setError(isEn ? "Failed to load workout details." : "Falha ao carregar detalhes do treino.");
    } finally {
      setLoading(false);
    }
  }, [data, isEn, language]);

  useFocusEffect(
    useCallback(() => {
      carregarDetalhe().catch(() => undefined);
    }, [carregarDetalhe]),
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>{isEn ? "Workout details" : "Detalhes do treino"}</Text>
          <Text style={styles.subtitle}>{formatDate(data)}</Text>
        </View>

        {loading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator color={theme.colors.button} />
          </View>
        ) : error ? (
          <View style={styles.stateContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : treinos.length === 0 ? (
          <View style={styles.stateContainer}>
            <Text style={styles.emptyText}>
              {isEn ? "No workouts saved for this date." : "Nenhum treino salvo para esta data."}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {treinos.map((treino, index) => (
              <View key={treino.treino_id} style={styles.workoutCard}>
                <View style={styles.workoutHeader}>
                  <Text style={styles.workoutTitle}>{isEn ? "Workout" : "Treino"} #{index + 1}</Text>
                  <View style={[styles.statusBadge, treino.finalizado ? styles.statusDone : styles.statusDraft]}>
                    <Text style={styles.statusBadgeText}>
                      {treino.finalizado
                        ? (isEn ? "Finished" : "Finalizado")
                        : (isEn ? "Draft" : "Rascunho")}
                    </Text>
                  </View>
                </View>

                <View style={styles.metricsRow}>
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>{isEn ? "Duration" : "Duração"}</Text>
                    <Text style={styles.metricValue}>{formatDuration(treino.duracao)}</Text>
                  </View>
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>{isEn ? "Total weight" : "Peso total"}</Text>
                    <Text style={styles.metricValue}>{Number(treino.peso_total ?? 0).toFixed(1)}kg</Text>
                  </View>
                  <View style={styles.metricBlock}>
                    <Text style={styles.metricLabel}>{isEn ? "Sets" : "Séries"}</Text>
                    <Text style={styles.metricValue}>{treino.total_series ?? 0}</Text>
                  </View>
                </View>

                {treino.exercicios.map((exercicio) => (
                  <View key={exercicio.exercicio_treino_id} style={styles.exerciseCard}>
                    <View style={styles.exerciseHeader}>
                      {exercicio.imagem_url ? (
                        <Image source={{ uri: exercicio.imagem_url }} style={styles.exerciseImage} />
                      ) : (
                        <View style={[styles.exerciseImage, styles.imagePlaceholder]}>
                          <Text style={styles.imagePlaceholderText}>IMG</Text>
                        </View>
                      )}

                      <View style={styles.exerciseHeaderText}>
                        <Text style={styles.exerciseTitle}>{exercicio.nome}</Text>
                        <Text style={styles.exerciseSubtitle}>
                          {exercicio.source === "custom"
                            ? (isEn ? "Custom exercise" : "Exercício personalizado")
                            : (isEn ? "ExerciseDB" : "ExerciseDB")}
                        </Text>
                      </View>
                    </View>

                    {exercicio.anotacoes ? (
                      <View style={styles.noteCard}>
                        <Text style={styles.noteLabel}>{isEn ? "Notes" : "Anotações"}</Text>
                        <Text style={styles.noteText}>{exercicio.anotacoes}</Text>
                      </View>
                    ) : null}

                    <View style={styles.seriesHeader}>
                      <Text style={[styles.seriesHeaderText, styles.seriesColSet]}>{isEn ? "SET" : "SÉRIE"}</Text>
                      <Text style={[styles.seriesHeaderText, styles.seriesColKg]}>KG</Text>
                      <Text style={[styles.seriesHeaderText, styles.seriesColReps]}>REPS</Text>
                      <Text style={[styles.seriesHeaderText, styles.seriesColOk]}>OK</Text>
                    </View>

                    {exercicio.series.length === 0 ? (
                      <Text style={styles.noSeriesText}>{isEn ? "No sets in this exercise." : "Sem séries neste exercício."}</Text>
                    ) : (
                      exercicio.series.map((serie) => (
                        <View key={serie.serie_id} style={[styles.seriesRow, serie.concluido && styles.seriesRowDone]}>
                          <Text style={[styles.seriesValue, styles.seriesColSet]}>{serie.numero}</Text>
                          <Text style={[styles.seriesValue, styles.seriesColKg]}>{serie.kg}</Text>
                          <Text style={[styles.seriesValue, styles.seriesColReps]}>{serie.repeticoes}</Text>
                          <Text style={[styles.seriesValue, styles.seriesColOk]}>{serie.concluido ? "✓" : "-"}</Text>
                        </View>
                      ))
                    )}
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        )}

        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{isEn ? "Back" : "Voltar"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.safeArea,
      paddingTop: 10,
      paddingBottom: 10,
    },
    screen: {
      flex: 1,
      backgroundColor: theme.mode === "dark" ? "#070b13" : theme.colors.background,
      paddingHorizontal: 14,
      gap: 10,
    },
    header: {
      paddingTop: 4,
      gap: 2,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: theme.colors.text,
      textAlign: "center",
    },
    subtitle: {
      color: theme.colors.mutedText,
      textAlign: "center",
      fontWeight: "600",
    },
    stateContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    errorText: {
      color: theme.colors.error,
      textAlign: "center",
      fontWeight: "700",
    },
    emptyText: {
      color: theme.colors.mutedText,
      textAlign: "center",
      fontWeight: "600",
    },
    content: {
      paddingTop: 4,
      paddingBottom: 14,
      gap: 12,
    },
    workoutCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      padding: 12,
      gap: 10,
    },
    workoutHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    workoutTitle: {
      color: theme.colors.text,
      fontSize: 19,
      fontWeight: "800",
    },
    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderWidth: 1,
    },
    statusDone: {
      backgroundColor: "rgba(34, 197, 94, 0.15)",
      borderColor: "rgba(34, 197, 94, 0.55)",
    },
    statusDraft: {
      backgroundColor: "rgba(234, 179, 8, 0.15)",
      borderColor: "rgba(234, 179, 8, 0.55)",
    },
    statusBadgeText: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: "700",
    },
    metricsRow: {
      flexDirection: "row",
      gap: 8,
    },
    metricBlock: {
      flex: 1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      paddingVertical: 8,
      paddingHorizontal: 6,
      alignItems: "center",
      gap: 2,
    },
    metricLabel: {
      color: theme.colors.mutedText,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    metricValue: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "800",
      textAlign: "center",
    },
    exerciseCard: {
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
      paddingTop: 10,
      gap: 10,
    },
    exerciseHeader: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },
    exerciseImage: {
      width: 68,
      height: 68,
      borderRadius: 10,
      backgroundColor: theme.colors.inputBackground,
    },
    imagePlaceholder: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    imagePlaceholderText: {
      color: theme.colors.mutedText,
      fontWeight: "700",
      fontSize: 12,
    },
    exerciseHeaderText: {
      flex: 1,
      gap: 2,
    },
    exerciseTitle: {
      color: theme.colors.text,
      fontSize: 20,
      fontWeight: "800",
    },
    exerciseSubtitle: {
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: "600",
    },
    noteCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      padding: 8,
      gap: 3,
    },
    noteLabel: {
      color: theme.colors.mutedText,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    noteText: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 18,
    },
    seriesHeader: {
      flexDirection: "row",
      paddingHorizontal: 6,
      paddingBottom: 3,
    },
    seriesHeaderText: {
      color: theme.colors.mutedText,
      fontSize: 10,
      fontWeight: "700",
      textAlign: "center",
    },
    seriesRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 10,
      backgroundColor: theme.colors.background,
      paddingVertical: 8,
      paddingHorizontal: 6,
      marginBottom: 6,
    },
    seriesRowDone: {
      backgroundColor: "rgba(34, 197, 94, 0.18)",
      borderColor: "rgba(34, 197, 94, 0.45)",
    },
    seriesValue: {
      color: theme.colors.text,
      fontWeight: "800",
      textAlign: "center",
      fontSize: 14,
    },
    seriesColSet: {
      width: "22%",
    },
    seriesColKg: {
      width: "26%",
    },
    seriesColReps: {
      width: "30%",
    },
    seriesColOk: {
      width: "22%",
      color: theme.colors.success,
    },
    noSeriesText: {
      color: theme.colors.mutedText,
      fontWeight: "600",
      fontSize: 13,
      paddingVertical: 4,
      textAlign: "center",
    },
    backButton: {
      height: 46,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.button,
      alignItems: "center",
      justifyContent: "center",
      marginTop: "auto",
      marginBottom: 4,
    },
    backButtonText: {
      color: theme.colors.buttonText,
      fontWeight: "800",
      fontSize: 15,
    },
  });
}
