import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
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

type PremiumStatusResponse = {
  isPremium: boolean;
  premiumUpdatedAt?: string | null;
  message?: string;
};

const NOISE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAQAAADZc7J/AAAAJ0lEQVR4Ae3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAA4G8G9o0AAaI31xkAAAAASUVORK5CYII=";

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
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exercicios, setExercicios] = useState<ExerciseItem[]>([]);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [checkingPremium, setCheckingPremium] = useState(false);

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

  const fetchPremiumStatus = async () => {
    if (isPremium !== null) return isPremium;
    setCheckingPremium(true);
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (!token) {
        setIsPremium(false);
        return false;
      }

      const response = await api.get<PremiumStatusResponse>("/premium/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const premium = Boolean(response.data?.isPremium);
      setIsPremium(premium);
      return premium;
    } catch {
      setIsPremium(false);
      return false;
    } finally {
      setCheckingPremium(false);
    }
  };

  const handleOpenExercise = async (item: ExerciseItem) => {
    const premium = await fetchPremiumStatus();
    router.push({
      pathname: "/screens/diario/GraficoExercicioDetalhe",
      params: {
        source: item.source,
        exercise_id: item.exercise_id ?? "",
        custom_exercise_id: item.custom_exercise_id ? String(item.custom_exercise_id) : "",
        nome: item.nome,
        premium_blocked: premium ? "0" : "1",
      },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <LinearGradient
          colors={theme.colors.buttonGradient}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 1, y: 0.8 }}
          style={styles.backIconBorder}
        >
          <Pressable style={styles.backIcon} onPress={() => router.back()}>
            <Text style={styles.backIconText}>{"<"}</Text>
          </Pressable>
        </LinearGradient>

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
                <LinearGradient
                  colors={["#5BE7FF", "#7C5CFF", "#FF4BD8"]}
                  start={{ x: 0, y: 0.2 }}
                  end={{ x: 1, y: 0.8 }}
                  style={styles.cardBorder}
                >
                  <View style={styles.cardInner}>
                    <Image source={{ uri: NOISE_DATA_URI }} style={styles.noiseOverlay} />
                    <Pressable style={styles.itemCard} onPress={() => handleOpenExercise(item)}>
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
                  </View>
                </LinearGradient>
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
    backIconBorder: {
      width: 38,
      height: 38,
      borderRadius: 999,
      padding: 1.5,
      shadowColor: "#7C5CFF",
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
      marginBottom: 18,
    },
    backIcon: {
      width: "100%",
      height: "100%",
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(11, 14, 24, 0.92)",
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
    cardBorder: {
      borderRadius: 14,
      padding: 1.5,
      shadowColor: "#FF4BD8",
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    cardInner: {
      borderRadius: 12,
      backgroundColor: "rgba(11, 14, 24, 0.92)",
      overflow: "hidden",
    },
    noiseOverlay: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.035,
    },
    itemCard: {
      backgroundColor: "transparent",
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
