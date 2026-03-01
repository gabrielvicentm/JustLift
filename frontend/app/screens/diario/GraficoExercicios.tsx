import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import { useRouter } from "expo-router";
import { api } from "@/app/config/api";
import { useAppTheme } from "@/providers/ThemeProvider";
import type { AppTheme } from "@/theme/theme";

type ExerciseItem = {
  source: "api" | "custom";
  exercise_id: string | null;
  custom_exercise_id: number | null;
  nome: string;
  imagem_url: string | null;
  total_treinos: number;
  recorde_kg: number;
  ultima_data: string | null;
};

type ExercisesResponse = {
  exercicios: ExerciseItem[];
  meta: {
    count: number;
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

  return `Erro ${status} ao carregar exercícios.`;
}

export default function GraficoExerciciosScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exercicios, setExercicios] = useState<ExerciseItem[]>([]);

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

        const response = await api.get<ExercisesResponse>("/diario/graficos/exercicios", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!active) return;
        setExercicios(response.data?.exercicios ?? []);
      } catch (err) {
        if (!active) return;
        if ((err as Error).message === "NOT_AUTH") {
          setError("Faça login para visualizar os gráficos.");
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
        setError("Erro ao carregar exercícios.");
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Pressable style={styles.backIcon} onPress={() => router.back()}>
          <Text style={styles.backIconText}>{"<"}</Text>
        </Pressable>

        <Text style={styles.title}>Evolução por Exercício</Text>
        <Text style={styles.subtitle}>Selecione um exercício para ver o gráfico de peso máximo.</Text>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={theme.colors.text} />
            <Text style={styles.loadingText}>Carregando exercícios...</Text>
          </View>
        ) : null}

        {!loading && error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && !error ? (
          exercicios.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum exercício com treino finalizado encontrado.</Text>
          ) : (
            <FlatList
              data={exercicios}
              keyExtractor={(item) =>
                item.source === "api" ? `api:${item.exercise_id}` : `custom:${item.custom_exercise_id}`
              }
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.itemCard}
                  onPress={() =>
                    router.push({
                      pathname: "/screens/diario/GraficoExercicioDetalhe",
                      params: {
                        source: item.source,
                        exercise_id: item.exercise_id ?? "",
                        custom_exercise_id: item.custom_exercise_id ? String(item.custom_exercise_id) : "",
                        nome: item.nome,
                      },
                    })
                  }
                >
                  <View style={styles.itemRow}>
                    {item.imagem_url ? (
                      <Image source={{ uri: item.imagem_url }} style={styles.itemImage} />
                    ) : (
                      <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                        <Text style={styles.itemImagePlaceholderText}>IMG</Text>
                      </View>
                    )}

                    <View style={styles.itemInfo}>
                      <View style={styles.itemHeader}>
                        <Text style={styles.itemName}>{item.nome}</Text>
                        <View style={[styles.badge, item.source === "custom" ? styles.badgeCustom : styles.badgeApi]}>
                          <Text style={styles.badgeText}>{item.source === "custom" ? "Custom" : "API"}</Text>
                        </View>
                      </View>
                      <Text style={styles.itemMeta}>
                        Treinos: {item.total_treinos} • Recorde: {Number(item.recorde_kg || 0).toFixed(1)} kg
                      </Text>
                    </View>
                  </View>
                </Pressable>
              )}
            />
          )
        ) : null}
      </View>
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
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
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
    listContent: {
      paddingBottom: 16,
      gap: 10,
    },
    itemCard: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    itemImage: {
      width: 58,
      height: 58,
      borderRadius: 10,
      backgroundColor: theme.colors.inputBackground,
    },
    itemImagePlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    itemImagePlaceholderText: {
      color: theme.colors.mutedText,
      fontSize: 11,
      fontWeight: "700",
    },
    itemInfo: {
      flex: 1,
      gap: 6,
    },
    itemHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    itemName: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "800",
    },
    itemMeta: {
      color: theme.colors.mutedText,
      fontSize: 13,
      fontWeight: "600",
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderWidth: 1,
    },
    badgeApi: {
      backgroundColor: `${theme.colors.button}22`,
      borderColor: theme.colors.button,
    },
    badgeCustom: {
      backgroundColor: `${theme.colors.success}22`,
      borderColor: theme.colors.success,
    },
    badgeText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: "700",
    },
  });
}
